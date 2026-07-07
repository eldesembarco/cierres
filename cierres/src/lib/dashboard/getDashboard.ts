import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { CANAL_LABEL } from '@/lib/informes/report'
import { getTableroGlobalBatch, type TableroGlobal, type LocalDashRow } from '@/lib/dashboard/getTableroGlobalBatch'
import { estadoTango } from '@/lib/dashboard/controlTango'
import { getCuentaCorrienteResumen, type CtaCteResumen } from '@/lib/ctacte/getCuentaCorrienteResumen'
import { getSaldosFondoFijoTodos, type SaldoFondoFijoLocal } from '@/lib/cierre/getSaldoFondoFijo'
import type { Canal } from '@/lib/cierre/types'

export type Severidad = 'alta' | 'media'
export interface Alerta {
  tipo: string
  severidad: Severidad
  localNombre: string
  detalle: string
  monto: number | null
  href: string
}

export interface MarcaRow {
  marca: string
  ventaTotal: number
  diferenciaCaja: number
  localesCargados: number
  localesTotal: number
}

export interface DashboardData {
  fecha: string
  tablero: TableroGlobal
  porMarca: MarcaRow[]
  ventaPorCanal: { canal: Canal; label: string; total: number; porcentaje: number }[]
  alertas: Alerta[]
  ctaCte: CtaCteResumen
  fondoFijo: { totalAReponer: number; cantidad: number; filas: SaldoFondoFijoLocal[] }
  serie: { fecha: string; total: number }[]
}

const UMBRAL_DIF = 1000
const UMBRAL_FACTURA = 200000

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function getDashboard(fechaStr: string): Promise<DashboardData> {
  const fecha = new Date(`${fechaStr}T00:00:00.000Z`)
  const desde = new Date(fecha)
  desde.setUTCDate(desde.getUTCDate() - 6)

  const [tablero, ctaCte, fondoSaldos, gastosDia, cierresSerie] = await Promise.all([
    getTableroGlobalBatch(fecha),
    getCuentaCorrienteResumen(),
    getSaldosFondoFijoTodos(),
    // Facturas sospechosas del día (rubro "Otros"/vacío con monto grande).
    prisma.cierreGasto.findMany({
      where: { cierre: { fecha }, formaPago: { not: 'cuenta_corriente' } },
      select: { tipo: true, monto: true, descripcion: true, cierre: { select: { localId: true, local: { select: { nombre: true } } } } },
    }),
    // Serie de venta del grupo: últimos 7 días.
    prisma.cierre.findMany({
      where: { fecha: { gte: desde, lte: fecha } },
      select: { fecha: true, ventas: { select: { monto: true } } },
    }),
  ])

  // --- Por marca ---
  const marcaMap = new Map<string, MarcaRow>()
  for (const l of tablero.porLocal) {
    const m = marcaMap.get(l.marca) ?? { marca: l.marca, ventaTotal: 0, diferenciaCaja: 0, localesCargados: 0, localesTotal: 0 }
    m.ventaTotal = round2(m.ventaTotal + l.ventaTotal)
    m.diferenciaCaja = round2(m.diferenciaCaja + l.diferenciaCaja)
    m.localesTotal += 1
    if (!l.faltaCierre) m.localesCargados += 1
    marcaMap.set(l.marca, m)
  }
  const porMarca = [...marcaMap.values()].sort((a, b) => b.ventaTotal - a.ventaTotal)

  // --- Venta por canal (con label y %) ---
  const totalCanal = tablero.ventaPorCanal.reduce((s, v) => s + v.monto, 0)
  const ventaPorCanal = tablero.ventaPorCanal.map((v) => ({
    canal: v.canal,
    label: CANAL_LABEL[v.canal] ?? v.canal,
    total: v.monto,
    porcentaje: totalCanal > 0 ? round2((v.monto / totalCanal) * 100) : 0,
  }))

  // --- Alertas ---
  const alertas: Alerta[] = []
  for (const l of tablero.porLocal) {
    const cargo = !l.faltaCierre
    if (cargo && Math.abs(l.diferenciaCaja) > UMBRAL_DIF) {
      alertas.push({ tipo: 'Diferencia de caja', severidad: 'alta', localNombre: l.localNombre, detalle: `Diferencia de ${fmt(l.diferenciaCaja)}`, monto: l.diferenciaCaja, href: `/cierres/${fechaStr}` })
    }
    if (cargo && l.montoZ === 0 && l.ventaTotal > 0) {
      alertas.push({ tipo: 'Caja incompleta', severidad: 'media', localNombre: l.localNombre, detalle: 'Cerró sin cargar el Cierre Z', monto: null, href: `/cierres/${fechaStr}` })
    }
    if (cargo && l.totalDepositado === 0 && l.ventaEfectivo > 0) {
      alertas.push({ tipo: 'Caja incompleta', severidad: 'media', localNombre: l.localNombre, detalle: 'Venta en efectivo sin depósito cargado', monto: l.ventaEfectivo, href: `/cierres/${fechaStr}` })
    }
    if (l.manana === 'borrador' || l.tarde === 'borrador') {
      alertas.push({ tipo: 'Turno sin cerrar', severidad: 'media', localNombre: l.localNombre, detalle: 'Tiene un turno en borrador (sin cerrar)', monto: null, href: `/cierres/${fechaStr}` })
    }
    // Control automático contra la facturación real de Tango: gap > 5% = alerta.
    // (Los gaps leves quedan en ámbar en la columna "vs Tango" del ranking.)
    if (cargo && l.ventaTango != null && l.difTango != null && l.ventaTango > 0 && estadoTango(l.difTango, l.ventaTango) === 'grave') {
      const declaroMenos = l.difTango < 0
      alertas.push({
        tipo: 'Declarado ≠ Tango',
        severidad: 'alta',
        localNombre: l.localNombre,
        detalle: `Declaró ${fmt(l.ventaTotal)} pero Tango facturó ${fmt(l.ventaTango)} (${declaroMenos ? 'faltan' : 'sobran'} ${fmt(Math.abs(l.difTango))})`,
        monto: l.difTango,
        href: `/cierres/${fechaStr}`,
      })
    }
  }
  // Facturas sospechosas cargadas como "Otros" con monto grande.
  for (const g of gastosDia) {
    const rubro = (g.tipo || '').trim().toLowerCase()
    if ((rubro === 'otros' || rubro === '') && Number(g.monto) >= UMBRAL_FACTURA) {
      alertas.push({ tipo: 'Factura mal cargada', severidad: 'alta', localNombre: g.cierre.local.nombre, detalle: `Gasto de ${fmt(Number(g.monto))} en "Otros"${g.descripcion ? ` (${g.descripcion})` : ''}`, monto: Number(g.monto), href: `/cierres/${fechaStr}` })
    }
  }
  // Fondo fijo en negativo (saldo por debajo de 0 = gastos mal cargados / a reponer fuerte).
  for (const f of fondoSaldos) {
    if (f.saldoActual < 0) {
      alertas.push({ tipo: 'Fondo fijo negativo', severidad: 'alta', localNombre: f.localNombre, detalle: `Saldo de fondo fijo en ${fmt(f.saldoActual)}`, monto: f.saldoActual, href: `/fondo-fijo` })
    }
  }
  alertas.sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === 'alta' ? -1 : 1))

  // --- Fondo fijo (KPI + filas que necesitan reposición) ---
  const totalAReponer = round2(fondoSaldos.reduce((s, f) => s + f.aReponer, 0))
  const filasFF = fondoSaldos
    .filter((f) => f.aReponer > 0 || f.saldoActual < 0)
    .sort((a, b) => b.aReponer - a.aReponer)

  // --- Serie de venta últimos 7 días ---
  const serieMap = new Map<string, number>()
  for (const c of cierresSerie) {
    const k = ymd(c.fecha)
    const v = c.ventas.reduce((s, x) => s + Number(x.monto), 0)
    serieMap.set(k, (serieMap.get(k) ?? 0) + v)
  }
  const serie: { fecha: string; total: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(fecha)
    d.setUTCDate(d.getUTCDate() - i)
    const k = ymd(d)
    serie.push({ fecha: k, total: round2(serieMap.get(k) ?? 0) })
  }

  return {
    fecha: fechaStr,
    tablero,
    porMarca,
    ventaPorCanal,
    alertas,
    ctaCte,
    fondoFijo: { totalAReponer, cantidad: filasFF.filter((f) => f.aReponer > 0).length, filas: filasFF },
    serie,
  }
}

// helper local (evita importar formatMoney solo para los detalles de alerta)
function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-AR')
}

export type { LocalDashRow }
