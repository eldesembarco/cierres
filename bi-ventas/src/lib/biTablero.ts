// Consultas del Tablero ejecutivo (/tablero): KPIs del período, evolución
// semanal y comparativa semana a semana por sucursal. Semanas de lunes a
// domingo, en hora Argentina. Todo respeta el alcance Propios/Franquicias/
// Todos y el filtro de marca.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { hoyAr } from '@/lib/fecha'
import { type Alcance, type SucursalOpcion, sucursalesBi, filtraAlcance } from '@/lib/bi'

export interface FiltroTablero {
  alcance: Alcance
  mes?: string // 'YYYY-MM'; undefined = todo el histórico sincronizado
  marca?: 'D' | 'T'
}

export interface KpisTablero {
  desde: string
  hasta: string
  venta: number
  tickets: number
  ticketPromedio: number
  variacionVenta: number | null // vs período anterior de igual longitud
  mejorDia: { fecha: string; monto: number } | null
  costoInsumos: number
  foodCostPct: number | null // costo teórico / venta (bruta c/IVA)
  sucursalesConVenta: number
}

export interface SemanaBucket {
  desde: string // lunes
  hasta: string // domingo
  etiqueta: string // "15/06 – 21/06"
  parcial: boolean
  monto: number
  tickets: number
}

export interface FilaSemanal {
  sucursalId: number
  nombre: string
  marca: string
  esPropia: boolean
  montos: (number | null)[] // por semana; null = sin datos
  variaciones: (number | null)[] // vs semana anterior; null = sin base
}

export interface Tablero {
  kpis: KpisTablero
  semanas: SemanaBucket[]
  filas: FilaSemanal[]
  ultimaSync: string | null
  sinDatos: boolean
}

const fechaDb = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const DIA_MS = 86_400_000
const INICIO_DATOS = '2026-06-01'

/** Lunes (YYYY-MM-DD) de la semana a la que pertenece la fecha. */
function lunesDe(fecha: string): string {
  const d = fechaDb(fecha)
  const dow = (d.getUTCDay() + 6) % 7 // 0 = lunes
  return ymd(new Date(d.getTime() - dow * DIA_MS))
}

const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

function rangoDelFiltro(f: FiltroTablero): { desde: string; hasta: string } {
  const hoy = hoyAr()
  if (f.mes) {
    const desde = `${f.mes}-01`
    const fin = new Date(Date.UTC(Number(f.mes.slice(0, 4)), Number(f.mes.slice(5, 7)), 0))
    const hasta = ymd(fin) < hoy ? ymd(fin) : hoy
    return { desde, hasta }
  }
  return { desde: INICIO_DATOS, hasta: hoy }
}

export async function tablero(f: FiltroTablero): Promise<Tablero> {
  const { desde, hasta } = rangoDelFiltro(f)
  const sucursales = await sucursalesBi()
  const delAlcance = filtraAlcance(sucursales, f.alcance).filter(
    (s) => !f.marca || s.marca === (f.marca === 'T' ? 'Tasty' : 'Desembarco'),
  )
  const ids = delAlcance.map((s) => s.id)
  const info = new Map(delAlcance.map((s) => [s.id, s]))

  const dias = Math.round((fechaDb(hasta).getTime() - fechaDb(desde).getTime()) / DIA_MS) + 1
  const antDesde = ymd(new Date(fechaDb(desde).getTime() - dias * DIA_MS))
  const antHasta = ymd(new Date(fechaDb(desde).getTime() - DIA_MS))

  // Para la comparativa semanal: 5 semanas hacia atrás desde la semana de `hasta`.
  const lunesActual = lunesDe(hasta)
  const desdeSemanas = ymd(new Date(fechaDb(lunesActual).getTime() - 4 * 7 * DIA_MS))
  const desdeTotal = desdeSemanas < desde ? desdeSemanas : desde

  const wherePeriodo = { fecha: { gte: fechaDb(desde), lte: fechaDb(hasta) }, sucursalId: { in: ids } }

  const [porDia, ventaAnt, costo, ultimaSyncRow] = await Promise.all([
    // Diario por sucursal, cubre el período del filtro Y la ventana de semanas.
    prisma.ventaTangoHora.groupBy({
      by: ['sucursalId', 'fecha'],
      where: { fecha: { gte: fechaDb(desdeTotal), lte: fechaDb(hasta) }, sucursalId: { in: ids } },
      _sum: { monto: true, tickets: true },
    }),
    prisma.ventaTangoHora.aggregate({
      where: { fecha: { gte: fechaDb(antDesde), lte: fechaDb(antHasta) }, sucursalId: { in: ids } },
      _sum: { monto: true },
    }),
    prisma.consumoInsumoTango.aggregate({ where: wherePeriodo, _sum: { costoTotal: true } }),
    prisma.ventaTangoSync.findFirst({ orderBy: { fecha: 'desc' }, select: { fecha: true } }),
  ])

  // ---- KPIs del período ----
  const enPeriodo = porDia.filter((r) => ymd(r.fecha) >= desde && ymd(r.fecha) <= hasta)
  const venta = round2(enPeriodo.reduce((s, r) => s + Number(r._sum.monto ?? 0), 0))
  const tickets = enPeriodo.reduce((s, r) => s + Number(r._sum.tickets ?? 0), 0)
  const porFecha = new Map<string, number>()
  for (const r of enPeriodo) {
    const k = ymd(r.fecha)
    porFecha.set(k, (porFecha.get(k) ?? 0) + Number(r._sum.monto ?? 0))
  }
  let mejorDia: KpisTablero['mejorDia'] = null
  for (const [fch, m] of porFecha) if (!mejorDia || m > mejorDia.monto) mejorDia = { fecha: fch, monto: round2(m) }
  const ventaAntTotal = Number(ventaAnt._sum.monto ?? 0)
  const costoInsumos = round2(Number(costo._sum.costoTotal ?? 0))

  const kpis: KpisTablero = {
    desde,
    hasta,
    venta,
    tickets,
    ticketPromedio: tickets > 0 ? round2(venta / tickets) : 0,
    variacionVenta: ventaAntTotal > 0 ? (venta - ventaAntTotal) / ventaAntTotal : null,
    mejorDia,
    costoInsumos,
    foodCostPct: venta > 0 && costoInsumos > 0 ? round2((100 * costoInsumos) / venta) : null,
    sucursalesConVenta: new Set(enPeriodo.filter((r) => Number(r._sum.monto ?? 0) > 0).map((r) => r.sucursalId)).size,
  }

  // ---- Buckets semanales (últimas 5 semanas) ----
  const ultimaSync = ultimaSyncRow ? ymd(ultimaSyncRow.fecha) : null
  const semanas: SemanaBucket[] = []
  for (let i = 4; i >= 0; i--) {
    const lunes = ymd(new Date(fechaDb(lunesActual).getTime() - i * 7 * DIA_MS))
    const domingo = ymd(new Date(fechaDb(lunes).getTime() + 6 * DIA_MS))
    semanas.push({
      desde: lunes,
      hasta: domingo,
      etiqueta: `${dm(lunes)} – ${dm(domingo)}`,
      parcial: ultimaSync != null ? domingo > ultimaSync : domingo >= hoyAr(),
      monto: 0,
      tickets: 0,
    })
  }
  const idxSemana = new Map(semanas.map((s, i) => [s.desde, i]))

  // ---- Comparativa por sucursal ----
  const porSucursal = new Map<number, (number | null)[]>()
  for (const r of porDia) {
    if (r.sucursalId == null) continue
    const i = idxSemana.get(lunesDe(ymd(r.fecha)))
    if (i == null) continue
    const monto = Number(r._sum.monto ?? 0)
    semanas[i].monto = round2(semanas[i].monto + monto)
    semanas[i].tickets += Number(r._sum.tickets ?? 0)
    let arr = porSucursal.get(r.sucursalId)
    if (!arr) porSucursal.set(r.sucursalId, (arr = [null, null, null, null, null]))
    arr[i] = round2((arr[i] ?? 0) + monto)
  }

  const filas: FilaSemanal[] = [...porSucursal.entries()]
    .map(([sucursalId, montos]) => {
      const s = info.get(sucursalId)
      const variaciones = montos.map((m, i) => {
        if (i === 0 || m == null) return null
        const prev = montos[i - 1]
        return prev != null && prev > 0 ? (m - prev) / prev : null
      })
      return {
        sucursalId,
        nombre: s?.nombre ?? `Sucursal #${sucursalId}`,
        marca: s?.marca ?? '',
        esPropia: s?.esPropia ?? false,
        montos,
        variaciones,
      }
    })
    // Ordena por la última semana completa (la anteúltima si la última es parcial).
    .sort((a, b) => {
      const i = semanas[4]?.parcial ? 3 : 4
      return (b.montos[i] ?? -1) - (a.montos[i] ?? -1)
    })

  return { kpis, semanas, filas, ultimaSync, sinDatos: enPeriodo.length === 0 }
}

/** Meses disponibles para el selector (desde el inicio de datos hasta hoy). */
export function mesesDisponibles(): { valor: string; etiqueta: string }[] {
  const out: { valor: string; etiqueta: string }[] = []
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  let cursor = INICIO_DATOS.slice(0, 7)
  const fin = hoyAr().slice(0, 7)
  while (cursor <= fin) {
    const [a, m] = cursor.split('-').map(Number)
    out.push({ valor: cursor, etiqueta: `${nombres[m - 1]} ${a}` })
    cursor = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
  }
  return out.reverse()
}
