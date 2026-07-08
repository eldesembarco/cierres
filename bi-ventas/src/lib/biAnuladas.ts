// Consultas del informe de anulaciones (/anuladas): comandas anuladas en Tango
// (ESTADO='X') por local, sobre los agregados sincronizados (comanda_anulada_tango).
// El indicador clave es el % anulado sobre la facturación del mismo período: una
// anulación con importe es plata que estuvo cobrada/cargada y se borró.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

export interface FiltroAnuladas {
  desde: string // YYYY-MM-DD inclusive
  hasta: string
  localId?: number // undefined = todos
}

export interface AnuladasLocalBi {
  localId: number
  nombre: string
  marca: string
  cantidad: number
  conImporte: number // anuladas con importe > 0 (las que hay que mirar)
  importe: number
  salon: number // cantidad tipo 'R'
  delivery: number // cantidad tipo 'D'
  facturacion: number
  /** % del importe anulado sobre la facturación del período (null sin venta). */
  pctVenta: number | null
}

export interface AnuladaDetalle {
  localId: number
  nombre: string
  fecha: string
  hora: string // HH:mm
  importe: number
  tipoPedido: string | null
  cubiertos: number
}

export interface ResumenAnuladas {
  totalCantidad: number
  totalConImporte: number
  totalImporte: number
  facturacion: number
  pctVenta: number | null
  porLocal: AnuladasLocalBi[]
  detalle: AnuladaDetalle[] // anuladas con importe, más recientes primero (cap)
  detalleRecortado: boolean
  ultimaSync: string | null
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

  const [filas, ventaPorLocal, locales, ultimaConAnuladas, totalFilas] = await Promise.all([
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
  ])

  const nombrePorLocal = new Map(locales.map((l) => [l.id, { nombre: l.nombre, marca: l.marca.nombre }]))
  const ventaLocal = new Map(ventaPorLocal.map((r) => [r.localId, round2(Number(r._sum.monto ?? 0))]))

  const acc = new Map<number, AnuladasLocalBi>()
  for (const r of filas) {
    const info = nombrePorLocal.get(r.localId)
    const e = acc.get(r.localId) ?? {
      localId: r.localId,
      nombre: info?.nombre ?? `Local ${r.localId}`,
      marca: info?.marca ?? '',
      cantidad: 0,
      conImporte: 0,
      importe: 0,
      salon: 0,
      delivery: 0,
      facturacion: ventaLocal.get(r.localId) ?? 0,
      pctVenta: null,
    }
    const importe = Number(r.importe)
    e.cantidad += 1
    if (importe > 0) {
      e.conImporte += 1
      e.importe = round2(e.importe + importe)
    }
    if (r.tipoPedido === 'R') e.salon += 1
    else if (r.tipoPedido === 'D') e.delivery += 1
    acc.set(r.localId, e)
  }
  const porLocal = [...acc.values()]
    .map((e) => ({ ...e, pctVenta: e.facturacion > 0 ? round2((e.importe / e.facturacion) * 100) : null }))
    .sort((a, b) => b.importe - a.importe)

  const conImporteFilas = filas
    .filter((r) => Number(r.importe) > 0)
    .sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime())
  const detalle: AnuladaDetalle[] = conImporteFilas.slice(0, DETALLE_MAX).map((r) => ({
    localId: r.localId,
    nombre: nombrePorLocal.get(r.localId)?.nombre ?? `Local ${r.localId}`,
    fecha: ymd(r.fecha),
    hora: r.fechaHora.toISOString().slice(11, 16),
    importe: round2(Number(r.importe)),
    tipoPedido: r.tipoPedido,
    cubiertos: r.cubiertos,
  }))

  const totalImporte = round2(porLocal.reduce((s, l) => s + l.importe, 0))
  const facturacion = f.localId != null
    ? ventaLocal.get(f.localId) ?? 0
    : round2([...ventaLocal.values()].reduce((s, v) => s + v, 0))

  return {
    totalCantidad: filas.length,
    totalConImporte: conImporteFilas.length,
    totalImporte,
    facturacion,
    pctVenta: facturacion > 0 ? round2((totalImporte / facturacion) * 100) : null,
    porLocal,
    detalle,
    detalleRecortado: conImporteFilas.length > DETALLE_MAX,
    ultimaSync: ultimaConAnuladas ? ymd(ultimaConAnuladas.fecha) : null,
    sinDatos: totalFilas === 0,
  }
}
