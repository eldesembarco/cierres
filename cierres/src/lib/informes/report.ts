// Cálculo de los informes admin (período + local). Compartido entre la página
// `/informes` (render) y el endpoint de Excel `/api/informes/export` para que
// los números sean SIEMPRE los mismos. Solo lectura: no toca la base.
import { round2, sumMoney } from '@/lib/money'
import { hoyAr, primerDiaDelMesAr } from '@/lib/fecha'
import type { Canal, Turno } from '@/lib/cierre/types'

// Forma mínima de un cierre con sus relaciones, tal cual lo trae el findMany de
// la página/route. Decimales ya vienen como Prisma.Decimal → los pasamos por Number().
export interface CierreParaInforme {
  id: number
  fecha: Date
  turno: Turno
  efectivoDepositado: unknown // Prisma.Decimal
  retiroFondoFijo?: unknown // Prisma.Decimal (recupero de fondo fijo)
  localId: number
  local: { id: number; nombre: string }
  ventas: { canal: Canal; monto: unknown }[]
  gastos: { tipo: string; formaPago: string; monto: unknown }[]
}

const num = (v: unknown): number => Number(v ?? 0)

export const TURNO_LABEL: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' }

// Etiquetas de canal (mismas que usa la planilla / Tango import).
export const CANAL_LABEL: Record<Canal, string> = {
  efectivo: 'Efectivo',
  tarjetas: 'Tarjetas',
  rappi: 'Rappi',
  pedidosya: 'PedidosYa',
  pedidosya_efectivo: 'PedidosYa (efectivo)',
  mercado_pedidos: 'Mercado Delivery',
  mercadopago: 'Mercado Pago / QR',
  pvs_qr: 'PVS QR',
  uber: 'Uber',
  delivery_propio: 'Delivery propio',
  varios: 'Varios',
}

const ORDEN_CANAL: Canal[] = [
  'efectivo', 'tarjetas', 'rappi', 'pedidosya', 'pedidosya_efectivo', 'mercado_pedidos',
  'mercadopago', 'pvs_qr', 'uber', 'delivery_propio', 'varios',
]

export interface KpiResumen {
  ventaTotal: number
  gastosTotal: number
  diferenciaTotal: number
  cantidadCierres: number
}

export interface FilaVentaPorTipo {
  canal: Canal
  label: string
  total: number
  porcentaje: number
}

export interface GastoRubro {
  tipo: string
  total: number
}

export interface GastoPorLocal {
  localId: number
  local: string
  total: number
  rubros: GastoRubro[]
}

export interface FilaDiferencia {
  cierreId: number
  fecha: Date
  turno: Turno
  turnoLabel: string
  local: string
  localId: number
  efectivoDepositado: number
  ventaEfectivo: number
  gastosEfectivo: number
  diferencia: number
}

export interface DiferenciaPorLocal {
  localId: number
  local: string
  total: number
}

export interface Informe {
  kpis: KpiResumen
  ventaPorTipo: { filas: FilaVentaPorTipo[]; total: number }
  gastosPorLocal: { locales: GastoPorLocal[]; total: number }
  diferencias: { filas: FilaDiferencia[]; porLocal: DiferenciaPorLocal[]; total: number }
}

// Diferencia de caja de un cierre: depositado − (ventaEfectivo − gastosEfectivo).
// Misma fórmula que calcularTotales.
function diferenciaCierre(c: CierreParaInforme) {
  const ventaEfectivo = sumMoney(
    c.ventas.filter((v) => v.canal === 'efectivo').map((v) => num(v.monto)),
  )
  const gastosEfectivo = sumMoney(
    c.gastos.filter((g) => g.formaPago === 'efectivo').map((g) => num(g.monto)),
  )
  const efectivoDepositado = num(c.efectivoDepositado)
  const retiroFF = num(c.retiroFondoFijo)
  // El recupero de fondo fijo baja el efectivo esperado igual que un gasto en efectivo.
  const diferencia = round2(efectivoDepositado - (ventaEfectivo - gastosEfectivo - retiroFF))
  return { ventaEfectivo, gastosEfectivo, efectivoDepositado, diferencia }
}

export function construirInforme(cierres: CierreParaInforme[]): Informe {
  // --- A) Venta por tipo de venta ---
  const ventaPorCanal = new Map<Canal, number>()
  for (const c of cierres) {
    for (const v of c.ventas) {
      ventaPorCanal.set(v.canal, round2((ventaPorCanal.get(v.canal) ?? 0) + num(v.monto)))
    }
  }
  const ventaTotal = sumMoney([...ventaPorCanal.values()])
  const filasVenta: FilaVentaPorTipo[] = ORDEN_CANAL
    .filter((canal) => ventaPorCanal.has(canal))
    .map((canal) => {
      const total = ventaPorCanal.get(canal) ?? 0
      return {
        canal,
        label: CANAL_LABEL[canal],
        total,
        porcentaje: ventaTotal > 0 ? round2((total / ventaTotal) * 100) : 0,
      }
    })

  // --- B) Gastos por local (con desglose por rubro) ---
  const localesMap = new Map<
    number,
    { local: string; total: number; rubros: Map<string, number> }
  >()
  for (const c of cierres) {
    let entry = localesMap.get(c.localId)
    if (!entry) {
      entry = { local: c.local.nombre, total: 0, rubros: new Map() }
      localesMap.set(c.localId, entry)
    }
    for (const g of c.gastos) {
      const monto = num(g.monto)
      const tipo = g.tipo || 'Sin rubro'
      entry.total = round2(entry.total + monto)
      entry.rubros.set(tipo, round2((entry.rubros.get(tipo) ?? 0) + monto))
    }
  }
  const gastosLocales: GastoPorLocal[] = [...localesMap.entries()]
    .map(([localId, e]) => ({
      localId,
      local: e.local,
      total: e.total,
      rubros: [...e.rubros.entries()]
        .map(([tipo, total]) => ({ tipo, total }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => a.local.localeCompare(b.local, 'es'))
  const gastosTotal = sumMoney(gastosLocales.map((l) => l.total))

  // --- C) Diferencias de caja (una fila por cierre + total por local) ---
  const filasDif: FilaDiferencia[] = cierres.map((c) => {
    const d = diferenciaCierre(c)
    return {
      cierreId: c.id,
      fecha: c.fecha,
      turno: c.turno,
      turnoLabel: TURNO_LABEL[c.turno],
      local: c.local.nombre,
      localId: c.localId,
      efectivoDepositado: d.efectivoDepositado,
      ventaEfectivo: d.ventaEfectivo,
      gastosEfectivo: d.gastosEfectivo,
      diferencia: d.diferencia,
    }
  })
  const difLocalMap = new Map<number, { local: string; total: number }>()
  for (const f of filasDif) {
    const entry = difLocalMap.get(f.localId) ?? { local: f.local, total: 0 }
    entry.total = round2(entry.total + f.diferencia)
    difLocalMap.set(f.localId, entry)
  }
  const difPorLocal: DiferenciaPorLocal[] = [...difLocalMap.entries()]
    .map(([localId, e]) => ({ localId, local: e.local, total: e.total }))
    .sort((a, b) => a.local.localeCompare(b.local, 'es'))
  const diferenciaTotal = sumMoney(filasDif.map((f) => f.diferencia))

  return {
    kpis: {
      ventaTotal,
      gastosTotal,
      diferenciaTotal,
      cantidadCierres: cierres.length,
    },
    ventaPorTipo: { filas: filasVenta, total: ventaTotal },
    gastosPorLocal: { locales: gastosLocales, total: gastosTotal },
    diferencias: { filas: filasDif, porLocal: difPorLocal, total: diferenciaTotal },
  }
}

// --- Helpers de fechas/filtros compartidos por page y route ---

/** Primer día del mes actual en formato YYYY-MM-DD (zona local del server). */
// Sin argumento usan la fecha en hora Argentina (default de producción); con `now`
// explícito mantienen el cálculo local (lo usan los tests).
export function primerDiaDelMes(now?: Date): string {
  return now ? toYmd(new Date(now.getFullYear(), now.getMonth(), 1)) : primerDiaDelMesAr()
}

export function hoyYmd(now?: Date): string {
  return now ? toYmd(now) : hoyAr()
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Valida y normaliza un YYYY-MM-DD; si es inválido devuelve el fallback. */
export function normalizarFecha(raw: string | undefined, fallback: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return fallback
}

/**
 * Construye el `where` del findMany de cierres a partir de los filtros. La
 * columna `fecha` es @db.Date (sin hora): usamos límites UTC para evitar que el
 * cierre del día `hasta` quede fuera por el desfase de zona horaria.
 */
export function buildWhere(desde: string, hasta: string, localId: number | null) {
  return {
    fecha: {
      gte: new Date(`${desde}T00:00:00.000Z`),
      lte: new Date(`${hasta}T23:59:59.999Z`),
    },
    ...(localId ? { localId } : {}),
  }
}
