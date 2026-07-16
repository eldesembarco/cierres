// Consultas del informe de insumos (/insumos): cuánto insumo consume cada
// sucursal (propias y franquicias), sobre los agregados sincronizados de Tango
// (consumo_insumo_tango). El detalle por sucursal se normaliza por facturación
// (venta_tango_hora) para poder comparar locales de distinto tamaño.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { type Alcance, sucursalesBi, filtraAlcance } from '@/lib/bi'

export interface FiltroInsumos {
  desde: string // YYYY-MM-DD inclusive
  hasta: string
  alcance: Alcance
  sucursalId?: number // undefined = todas las del alcance
  rubro?: string
  q?: string // búsqueda por descripción
}

export interface InsumoBi {
  codigo: string
  descripcion: string
  rubro: string | null
  unidad: string | null
  cantidad: number
  /** Costo de reposición total del período (null si el insumo no tiene costo en Tango). */
  costoTotal: number | null
}

export interface InsumoLocalBi {
  sucursalId: number
  nombre: string
  marca: string
  cantidad: number
  costoTotal: number | null
  facturacion: number
  /** Cantidad de insumo por cada $1.000.000 facturados (null si no hay venta sincronizada). */
  porMillon: number | null
}

export interface DetalleInsumo {
  codigo: string
  descripcion: string
  unidad: string | null
  totalCantidad: number
  totalCosto: number | null
  locales: InsumoLocalBi[]
}

export interface ResumenInsumos {
  insumos: InsumoBi[]
  rubros: string[]
  detalle: DetalleInsumo | null
  /** Costo de reposición total del período con los filtros activos. */
  costoTotal: number
  /** Cuántos insumos del listado tienen costo cargado (para avisar cobertura). */
  insumosConCosto: number
  ultimaSyncInsumos: string | null // última fecha con filas de insumos
  diasSinInsumos: number // días del rango sin datos de insumos
  sinDatos: boolean // no hay NINGÚN dato de insumos en la base
}

const fechaDb = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const ymd = (d: Date) => d.toISOString().slice(0, 10)

export async function resumenInsumos(f: FiltroInsumos, insumoDetalle?: string): Promise<ResumenInsumos> {
  const sucursales = await sucursalesBi()
  const delAlcance = filtraAlcance(sucursales, f.alcance)
  const ids =
    f.sucursalId != null ? [f.sucursalId] : f.alcance === 'todos' ? undefined : delAlcance.map((s) => s.id)

  const whereRango = {
    fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) },
    ...(ids ? { sucursalId: { in: ids } } : {}),
    ...(f.rubro ? { rubro: f.rubro } : {}),
    ...(f.q ? { descripcion: { contains: f.q, mode: 'insensitive' as const } } : {}),
  }

  const [porInsumo, rubrosRaw, ultimaConInsumos, syncsRango, totalFilas] = await Promise.all([
    prisma.consumoInsumoTango.groupBy({
      by: ['codigo'],
      where: whereRango,
      _sum: { cantidad: true, costoTotal: true },
      _max: { descripcion: true, rubro: true, unidad: true },
    }),
    prisma.consumoInsumoTango.findMany({
      where: { rubro: { not: null } },
      select: { rubro: true },
      distinct: ['rubro'],
      orderBy: { rubro: 'asc' },
    }),
    prisma.ventaTangoSync.findFirst({ where: { filasInsumos: { gt: 0 } }, orderBy: { fecha: 'desc' } }),
    prisma.ventaTangoSync.count({
      where: { fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) }, filasInsumos: { gt: 0 } },
    }),
    prisma.consumoInsumoTango.count(),
  ])

  const insumos: InsumoBi[] = porInsumo
    .map((r) => ({
      codigo: r.codigo,
      descripcion: r._max.descripcion ?? r.codigo,
      rubro: r._max.rubro ?? null,
      unidad: r._max.unidad ?? null,
      cantidad: Number(r._sum.cantidad ?? 0),
      costoTotal: r._sum.costoTotal != null ? round2(Number(r._sum.costoTotal)) : null,
    }))
    // Primero por costo (los que mueven plata arriba), después alfabético.
    .sort((a, b) => (b.costoTotal ?? -1) - (a.costoTotal ?? -1) || a.descripcion.localeCompare(b.descripcion, 'es'))

  const diasRango = Math.round((fechaDb(f.hasta).getTime() - fechaDb(f.desde).getTime()) / 86_400_000) + 1

  let detalle: DetalleInsumo | null = null
  if (insumoDetalle) {
    const whereFechas = { fecha: { gte: fechaDb(f.desde), lte: fechaDb(f.hasta) }, ...(ids ? { sucursalId: { in: ids } } : {}) }
    const [porSucursal, ventaPorSucursal] = await Promise.all([
      prisma.consumoInsumoTango.groupBy({
        by: ['sucursalId'],
        where: { ...whereFechas, codigo: insumoDetalle },
        _sum: { cantidad: true, costoTotal: true },
        _max: { descripcion: true, unidad: true },
      }),
      prisma.ventaTangoHora.groupBy({
        by: ['sucursalId'],
        where: whereFechas,
        _sum: { monto: true },
      }),
    ])
    const infoPorSucursal = new Map(sucursales.map((s) => [s.id, s]))
    const ventaSucursal = new Map(ventaPorSucursal.map((r) => [r.sucursalId, Number(r._sum.monto ?? 0)]))

    const localesBi: InsumoLocalBi[] = porSucursal
      .filter((r) => r.sucursalId != null)
      .map((r) => {
        const sucursalId = r.sucursalId as number
        const cantidad = Number(r._sum.cantidad ?? 0)
        const facturacion = round2(ventaSucursal.get(sucursalId) ?? 0)
        const info = infoPorSucursal.get(sucursalId)
        return {
          sucursalId,
          nombre: info?.nombre ?? `Sucursal #${sucursalId}`,
          marca: info?.marca ?? '',
          cantidad,
          costoTotal: r._sum.costoTotal != null ? round2(Number(r._sum.costoTotal)) : null,
          facturacion,
          porMillon: facturacion > 0 ? cantidad / (facturacion / 1_000_000) : null,
        }
      })
      .sort((a, b) => b.cantidad - a.cantidad)

    if (porSucursal.length > 0) {
      const costos = localesBi.filter((l) => l.costoTotal != null)
      detalle = {
        codigo: insumoDetalle,
        descripcion: porSucursal[0]._max.descripcion ?? insumoDetalle,
        unidad: porSucursal[0]._max.unidad ?? null,
        totalCantidad: localesBi.reduce((s, l) => s + l.cantidad, 0),
        totalCosto: costos.length > 0 ? round2(costos.reduce((s, l) => s + (l.costoTotal as number), 0)) : null,
        locales: localesBi,
      }
    }
  }

  return {
    insumos,
    rubros: rubrosRaw.map((r) => r.rubro as string),
    detalle,
    costoTotal: round2(insumos.reduce((s, i) => s + (i.costoTotal ?? 0), 0)),
    insumosConCosto: insumos.filter((i) => i.costoTotal != null).length,
    ultimaSyncInsumos: ultimaConInsumos ? ymd(ultimaConInsumos.fecha) : null,
    diasSinInsumos: Math.max(0, diasRango - syncsRango),
    sinDatos: totalFilas === 0,
  }
}
