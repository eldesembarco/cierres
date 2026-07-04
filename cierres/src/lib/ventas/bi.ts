// Consultas del BI de ventas (/ventas) sobre los agregados sincronizados de Tango
// (venta_tango_hora / venta_tango_articulo). La facturación "oficial" del BI es la
// suma de venta_tango_hora (misma definición que el Z: comprobantes netos de NC).
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

export interface FiltroBi {
  desde: string // YYYY-MM-DD inclusive
  hasta: string
  localId?: number // undefined = todos los locales
}

export interface LocalBi {
  localId: number
  nombre: string
  marca: string
  monto: number
  tickets: number
  ticketPromedio: number
  share: number // 0..1 sobre el total del período
  variacion: number | null // vs período anterior; null si no hay base
}

export interface HoraBi {
  hora: number
  monto: number
  tickets: number
}

export interface ArticuloBi {
  codigo: string
  descripcion: string
  rubro: string | null
  cantidad: number
  monto: number
}

export interface ResumenBi {
  monto: number
  tickets: number
  ticketPromedio: number
  variacion: number | null
  locales: LocalBi[]
  horas: HoraBi[]
  topPorMonto: ArticuloBi[]
  topPorCantidad: ArticuloBi[]
  ultimaSync: { fecha: string; sincronizadoEn: Date } | null
  diasSinDatos: string[] // fechas del rango sin fila de sync (cobertura incompleta)
  sinDatos: boolean
}

const fechaDb = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Rango de igual longitud inmediatamente anterior a [desde, hasta]. */
export function rangoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = fechaDb(desde)
  const h = fechaDb(hasta)
  const dias = Math.round((h.getTime() - d.getTime()) / 86_400_000) + 1
  return {
    desde: ymd(new Date(d.getTime() - dias * 86_400_000)),
    hasta: ymd(new Date(d.getTime() - 86_400_000)),
  }
}

function whereRango(f: FiltroBi) {
  return {
    fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) },
    ...(f.localId != null ? { localId: f.localId } : {}),
  }
}

const variacionPct = (actual: number, base: number): number | null =>
  base > 0 ? (actual - base) / base : null

export async function resumenBi(f: FiltroBi, topN = 15): Promise<ResumenBi> {
  const anterior = rangoAnterior(f.desde, f.hasta)

  const [porLocal, porLocalAnt, porHora, porArticulo, locales, syncs, ultima] = await Promise.all([
    prisma.ventaTangoHora.groupBy({
      by: ['localId'],
      where: whereRango(f),
      _sum: { monto: true, tickets: true },
    }),
    prisma.ventaTangoHora.groupBy({
      by: ['localId'],
      where: whereRango({ ...anterior, localId: f.localId }),
      _sum: { monto: true },
    }),
    prisma.ventaTangoHora.groupBy({
      by: ['hora'],
      where: whereRango(f),
      _sum: { monto: true, tickets: true },
      orderBy: { hora: 'asc' },
    }),
    prisma.ventaTangoArticulo.groupBy({
      by: ['codigo'],
      where: whereRango(f),
      _sum: { cantidad: true, monto: true },
      _max: { descripcion: true, rubro: true },
    }),
    prisma.local.findMany({
      where: { tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, marca: { select: { nombre: true } } },
    }),
    prisma.ventaTangoSync.findMany({
      where: { fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) } },
      select: { fecha: true },
    }),
    prisma.ventaTangoSync.findFirst({ orderBy: { fecha: 'desc' } }),
  ])

  const nombrePorLocal = new Map(locales.map((l) => [l.id, { nombre: l.nombre, marca: l.marca.nombre }]))
  const antPorLocal = new Map(porLocalAnt.map((r) => [r.localId, Number(r._sum.monto ?? 0)]))

  const montoTotal = round2(porLocal.reduce((s, r) => s + Number(r._sum.monto ?? 0), 0))
  const ticketsTotal = porLocal.reduce((s, r) => s + Number(r._sum.tickets ?? 0), 0)
  const montoTotalAnt = round2(porLocalAnt.reduce((s, r) => s + Number(r._sum.monto ?? 0), 0))

  const localesBi: LocalBi[] = porLocal
    .map((r) => {
      const monto = round2(Number(r._sum.monto ?? 0))
      const tickets = Number(r._sum.tickets ?? 0)
      const info = nombrePorLocal.get(r.localId)
      return {
        localId: r.localId,
        nombre: info?.nombre ?? `Local ${r.localId}`,
        marca: info?.marca ?? '',
        monto,
        tickets,
        ticketPromedio: tickets > 0 ? round2(monto / tickets) : 0,
        share: montoTotal > 0 ? monto / montoTotal : 0,
        variacion: variacionPct(monto, antPorLocal.get(r.localId) ?? 0),
      }
    })
    .sort((a, b) => b.monto - a.monto)

  const horas: HoraBi[] = porHora.map((r) => ({
    hora: r.hora,
    monto: round2(Number(r._sum.monto ?? 0)),
    tickets: Number(r._sum.tickets ?? 0),
  }))

  const articulos: ArticuloBi[] = porArticulo.map((r) => ({
    codigo: r.codigo,
    descripcion: r._max.descripcion ?? r.codigo,
    rubro: r._max.rubro ?? null,
    cantidad: Number(r._sum.cantidad ?? 0),
    monto: round2(Number(r._sum.monto ?? 0)),
  }))

  const sincronizadas = new Set(syncs.map((s) => ymd(s.fecha)))
  const diasSinDatos: string[] = []
  for (let d = fechaDb(f.desde); d <= fechaDb(f.hasta); d = new Date(d.getTime() + 86_400_000)) {
    if (!sincronizadas.has(ymd(d))) diasSinDatos.push(ymd(d))
  }

  return {
    monto: montoTotal,
    tickets: ticketsTotal,
    ticketPromedio: ticketsTotal > 0 ? round2(montoTotal / ticketsTotal) : 0,
    variacion: variacionPct(montoTotal, montoTotalAnt),
    locales: localesBi,
    horas,
    topPorMonto: [...articulos].sort((a, b) => b.monto - a.monto).slice(0, topN),
    topPorCantidad: [...articulos].sort((a, b) => b.cantidad - a.cantidad).slice(0, topN),
    ultimaSync: ultima ? { fecha: ymd(ultima.fecha), sincronizadoEn: ultima.sincronizadoEn } : null,
    diasSinDatos,
    sinDatos: porLocal.length === 0,
  }
}
