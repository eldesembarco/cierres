// Consultas del BI de ventas (/) sobre los agregados sincronizados de Tango
// (venta_tango_hora / venta_tango_articulo). La facturación "oficial" del BI es la
// suma de venta_tango_hora (misma definición que el Z: comprobantes netos de NC).
// Todo se agrupa por SUCURSAL de Tango (dimensión sucursal_tango), con alcance
// Propios / Franquicias / Todos.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

export type Alcance = 'propios' | 'franquicias' | 'todos'

export interface SucursalOpcion {
  id: number
  nombre: string
  marca: string // etiqueta legible
  esPropia: boolean
}

export interface FiltroBi {
  desde: string // YYYY-MM-DD inclusive
  hasta: string
  alcance: Alcance
  sucursalId?: number // undefined = todas las del alcance
}

export interface LocalBi {
  sucursalId: number
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

const etiquetaMarca = (m: string) => (m === 'T' ? 'Tasty' : 'Desembarco')

/** Sucursales de la dimensión, con etiqueta de marca, ordenadas para selects. */
export async function sucursalesBi(): Promise<SucursalOpcion[]> {
  const rows = await prisma.sucursalTango.findMany({
    select: { id: true, nombre: true, marca: true, esPropia: true },
    orderBy: [{ esPropia: 'desc' }, { marca: 'asc' }, { nombre: 'asc' }],
  })
  return rows.map((s) => ({ id: s.id, nombre: s.nombre, marca: etiquetaMarca(s.marca), esPropia: s.esPropia }))
}

export const filtraAlcance = (sucursales: SucursalOpcion[], alcance: Alcance): SucursalOpcion[] =>
  alcance === 'todos' ? sucursales : sucursales.filter((s) => s.esPropia === (alcance === 'propios'))

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

function whereRango(desde: string, hasta: string, sucursalIds: number[] | undefined) {
  return {
    fecha: { gte: fechaDb(desde), lte: fechaDb(hasta) },
    ...(sucursalIds ? { sucursalId: { in: sucursalIds } } : {}),
  }
}

const variacionPct = (actual: number, base: number): number | null =>
  base > 0 ? (actual - base) / base : null

export async function resumenBi(f: FiltroBi, topN = 15): Promise<ResumenBi> {
  const anterior = rangoAnterior(f.desde, f.hasta)
  const sucursales = await sucursalesBi()
  const delAlcance = filtraAlcance(sucursales, f.alcance)
  // Con sucursal puntual manda esa; si no, las del alcance; "todos" sin filtro.
  const ids =
    f.sucursalId != null ? [f.sucursalId] : f.alcance === 'todos' ? undefined : delAlcance.map((s) => s.id)

  const [porSucursal, porSucursalAnt, porHora, porArticulo, syncs, ultima] = await Promise.all([
    prisma.ventaTangoHora.groupBy({
      by: ['sucursalId'],
      where: whereRango(f.desde, f.hasta, ids),
      _sum: { monto: true, tickets: true },
    }),
    prisma.ventaTangoHora.groupBy({
      by: ['sucursalId'],
      where: whereRango(anterior.desde, anterior.hasta, ids),
      _sum: { monto: true },
    }),
    prisma.ventaTangoHora.groupBy({
      by: ['hora'],
      where: whereRango(f.desde, f.hasta, ids),
      _sum: { monto: true, tickets: true },
      orderBy: { hora: 'asc' },
    }),
    prisma.ventaTangoArticulo.groupBy({
      by: ['codigo'],
      where: whereRango(f.desde, f.hasta, ids),
      _sum: { cantidad: true, monto: true },
      _max: { descripcion: true, rubro: true },
    }),
    prisma.ventaTangoSync.findMany({
      where: { fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) } },
      select: { fecha: true },
    }),
    prisma.ventaTangoSync.findFirst({ orderBy: { fecha: 'desc' } }),
  ])

  const infoPorSucursal = new Map(sucursales.map((s) => [s.id, s]))
  const antPorSucursal = new Map(porSucursalAnt.map((r) => [r.sucursalId, Number(r._sum.monto ?? 0)]))

  const montoTotal = round2(porSucursal.reduce((s, r) => s + Number(r._sum.monto ?? 0), 0))
  const ticketsTotal = porSucursal.reduce((s, r) => s + Number(r._sum.tickets ?? 0), 0)
  const montoTotalAnt = round2(porSucursalAnt.reduce((s, r) => s + Number(r._sum.monto ?? 0), 0))

  const localesBi: LocalBi[] = porSucursal
    .filter((r) => r.sucursalId != null)
    .map((r) => {
      const sucursalId = r.sucursalId as number
      const monto = round2(Number(r._sum.monto ?? 0))
      const tickets = Number(r._sum.tickets ?? 0)
      const info = infoPorSucursal.get(sucursalId)
      return {
        sucursalId,
        nombre: info?.nombre ?? `Sucursal #${sucursalId}`,
        marca: info?.marca ?? '',
        monto,
        tickets,
        ticketPromedio: tickets > 0 ? round2(monto / tickets) : 0,
        share: montoTotal > 0 ? monto / montoTotal : 0,
        variacion: variacionPct(monto, antPorSucursal.get(sucursalId) ?? 0),
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
    sinDatos: porSucursal.length === 0,
  }
}
