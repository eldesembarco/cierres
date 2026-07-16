// Informe de anulaciones (/anulaciones): comandas anuladas en Tango (ESTADO='X')
// por local, sobre la tabla sincronizada por el BI (comanda_anulada_tango, base
// compartida). Es CONTROL DE CAJA: una anulación con importe es una venta que
// estuvo cargada y se borró; el indicador clave es el % sobre la facturación.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

// Motivos que puede elegir el local al justificar una anulación.
export const MOTIVOS_ANULACION = [
  ['error_carga', 'Error de carga / se rehízo la comanda'],
  ['cliente_cancelo', 'El cliente canceló'],
  ['demora', 'Demora / el pedido no salió'],
  ['reclamo', 'Reclamo o devolución'],
  ['prueba', 'Prueba / capacitación'],
  ['otro', 'Otro (detallar)'],
] as const
export const MOTIVO_LABEL: Record<string, string> = Object.fromEntries(MOTIVOS_ANULACION)

// Clave natural que sobrevive a los resyncs (la fila de la anulada se recrea).
export const claveAnulada = (localId: number, fechaHora: Date, importe: number) =>
  `${localId}|${fechaHora.getTime()}|${importe.toFixed(2)}`

export interface FiltroAnuladas {
  desde: string // YYYY-MM-DD inclusive
  hasta: string
  localId?: number // undefined = todos
}

export interface AnuladasLocal {
  localId: number
  nombre: string
  marca: string
  cantidad: number
  conImporte: number // anuladas con importe > 0 (las auditables)
  importe: number
  salon: number // tipo 'R'
  delivery: number // tipo 'D'
  facturacion: number
  /** % del importe anulado sobre la facturación del período (null sin venta). */
  pctVenta: number | null
  sinJustificar: number // anuladas con importe que el local todavía no justificó
  /** Última fecha con venta sincronizada de este local ("hasta cuándo llegó su info"). */
  datosHasta: string | null
}

export interface JustificacionInfo {
  motivo: string
  detalle: string | null
  porNombre: string
}

export interface AnuladaDetalle {
  localId: number
  nombre: string
  fecha: string
  hora: string // HH:mm
  fechaHoraIso: string // clave para justificar (sobrevive resyncs)
  importe: number
  tipoPedido: string | null
  cubiertos: number
  justificacion: JustificacionInfo | null
}

export interface ResumenAnuladas {
  totalCantidad: number
  totalConImporte: number
  totalImporte: number
  totalSinJustificar: number
  facturacion: number
  pctVenta: number | null
  porLocal: AnuladasLocal[]
  detalle: AnuladaDetalle[] // anuladas con importe, más recientes primero (cap)
  detalleRecortado: boolean
  ultimaSync: string | null // última fecha con datos de anuladas
  sincronizadoEn: string | null // ISO: cuándo corrió la última sincronización
  sinDatos: boolean
}

const fechaDb = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const DETALLE_MAX = 120

export async function resumenAnuladas(f: FiltroAnuladas): Promise<ResumenAnuladas> {
  const whereRango = {
    fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) },
    ...(f.localId != null ? { localId: f.localId } : {}),
  }

  const [filas, ventaPorLocal, locales, ultimaConAnuladas, totalFilas, ultimaCorrida, datosPorLocal, justificaciones] = await Promise.all([
    prisma.comandaAnuladaTango.findMany({ where: whereRango }),
    prisma.ventaTangoHora.groupBy({
      by: ['localId'],
      where: { fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) } },
      _sum: { monto: true },
    }),
    prisma.local.findMany({
      where: { tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, marca: { select: { nombre: true } } },
    }),
    prisma.ventaTangoSync.findFirst({ where: { filasAnuladas: { gt: 0 } }, orderBy: { fecha: 'desc' } }),
    prisma.comandaAnuladaTango.count(),
    // Cuándo corrió la última sincronización (la corrida más reciente, cualquier fecha).
    prisma.ventaTangoSync.findFirst({ orderBy: { sincronizadoEn: 'desc' }, select: { sincronizadoEn: true } }),
    // Hasta qué fecha llegó la info de CADA local (última venta sincronizada).
    prisma.ventaTangoHora.groupBy({ by: ['localId'], _max: { fecha: true } }),
    // La fechaHora de la comanda puede caer hasta la madrugada siguiente al día
    // comercial "hasta": margen de 2 días para no perder justificaciones del borde.
    prisma.anulacionJustificacion.findMany({
      where: {
        fechaHora: { gte: fechaDb(f.desde), lt: new Date(fechaDb(f.hasta).getTime() + 2 * 86_400_000) },
        ...(f.localId != null ? { localId: f.localId } : {}),
      },
    }),
  ])

  const nombrePorLocal = new Map(locales.map((l) => [l.id, { nombre: l.nombre, marca: l.marca.nombre }]))
  const ventaLocal = new Map(ventaPorLocal.map((r) => [r.localId, round2(Number(r._sum.monto ?? 0))]))
  const datosLocal = new Map(datosPorLocal.map((r) => [r.localId, r._max.fecha ? ymd(r._max.fecha) : null]))
  const justPorClave = new Map(
    justificaciones.map((j) => [
      claveAnulada(j.localId, j.fechaHora, Number(j.importe)),
      { motivo: j.motivo, detalle: j.detalle, porNombre: j.creadoPorNombre },
    ]),
  )

  const acc = new Map<number, AnuladasLocal>()
  for (const r of filas) {
    // localId es null para las sucursales franquiciadas: esta pantalla es de propios.
    const localId = r.localId
    if (localId == null) continue
    const info = nombrePorLocal.get(localId)
    const e = acc.get(localId) ?? {
      localId,
      nombre: info?.nombre ?? `Local ${localId}`,
      marca: info?.marca ?? '',
      cantidad: 0,
      conImporte: 0,
      importe: 0,
      salon: 0,
      delivery: 0,
      facturacion: ventaLocal.get(localId) ?? 0,
      pctVenta: null,
      sinJustificar: 0,
      datosHasta: datosLocal.get(localId) ?? null,
    }
    const importe = Number(r.importe)
    e.cantidad += 1
    if (importe > 0) {
      e.conImporte += 1
      e.importe = round2(e.importe + importe)
      if (!justPorClave.has(claveAnulada(localId, r.fechaHora, importe))) e.sinJustificar += 1
    }
    if (r.tipoPedido === 'R') e.salon += 1
    else if (r.tipoPedido === 'D') e.delivery += 1
    acc.set(localId, e)
  }
  const porLocal = [...acc.values()]
    .map((e) => ({ ...e, pctVenta: e.facturacion > 0 ? round2((e.importe / e.facturacion) * 100) : null }))
    .sort((a, b) => b.importe - a.importe)

  const conImporteFilas = filas
    .filter((r): r is (typeof filas)[number] & { localId: number } => r.localId != null && Number(r.importe) > 0)
    .sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime())
  const detalle: AnuladaDetalle[] = conImporteFilas.slice(0, DETALLE_MAX).map((r) => ({
    localId: r.localId,
    nombre: nombrePorLocal.get(r.localId)?.nombre ?? `Local ${r.localId}`,
    fecha: ymd(r.fecha),
    hora: r.fechaHora.toISOString().slice(11, 16),
    fechaHoraIso: r.fechaHora.toISOString(),
    importe: round2(Number(r.importe)),
    tipoPedido: r.tipoPedido,
    cubiertos: r.cubiertos,
    justificacion: justPorClave.get(claveAnulada(r.localId, r.fechaHora, Number(r.importe))) ?? null,
  }))

  const totalImporte = round2(porLocal.reduce((s, l) => s + l.importe, 0))
  const facturacion = f.localId != null
    ? ventaLocal.get(f.localId) ?? 0
    : round2([...ventaLocal.values()].reduce((s, v) => s + v, 0))

  return {
    totalCantidad: filas.length,
    totalConImporte: conImporteFilas.length,
    totalImporte,
    totalSinJustificar: porLocal.reduce((s, l) => s + l.sinJustificar, 0),
    facturacion,
    pctVenta: facturacion > 0 ? round2((totalImporte / facturacion) * 100) : null,
    porLocal,
    detalle,
    detalleRecortado: conImporteFilas.length > DETALLE_MAX,
    ultimaSync: ultimaConAnuladas ? ymd(ultimaConAnuladas.fecha) : null,
    sincronizadoEn: ultimaCorrida?.sincronizadoEn.toISOString() ?? null,
    sinDatos: totalFilas === 0,
  }
}
