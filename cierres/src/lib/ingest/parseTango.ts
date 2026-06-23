import Papa from 'papaparse'
import { parseMoney, round2 } from '@/lib/money'
import type { Canal, Turno } from '@/lib/cierre/types'

const MEDIO_A_CANAL: Record<string, Canal> = {
  'efectivo': 'efectivo',
  'tarjetas': 'tarjetas', 'tarjeta': 'tarjetas', 'tarjeta de credito': 'tarjetas', 'tarjeta de debito': 'tarjetas',
  'mercado pago': 'mercadopago', 'mercadopago': 'mercadopago', 'qr': 'mercadopago',
  'pedidosya': 'pedidosya', 'pedidos ya': 'pedidosya',
  'mercado pedidos': 'mercado_pedidos',
  'rappi': 'rappi',
  'uber': 'uber', 'uber eats': 'uber',
  'delivery propio': 'delivery_propio',
}

function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export interface TangoParseResult {
  fecha: string | null
  ventas: { canal: Canal; monto: number }[]
  turnos: { turno: Turno; montoZ: number }[]
  cantidadTickets: number | null
}

export function parseTango(csv: string): TangoParseResult {
  const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })
  const ventasMap = new Map<Canal, number>()
  const turnoMap = new Map<Turno, number>()
  let fecha: string | null = null
  let tickets = 0
  for (const r of data) {
    if (!fecha && (r['Fecha'] ?? '').trim()) fecha = r['Fecha'].trim()
    const medio = norm(r['MedioPago'] ?? r['Medio de pago'] ?? r['Medio'] ?? '')
    if (!medio) continue
    const importe = parseMoney(r['Importe'] ?? '0')
    const canal: Canal = MEDIO_A_CANAL[medio] ?? 'varios'
    ventasMap.set(canal, round2((ventasMap.get(canal) ?? 0) + importe))
    const tRaw = (r['Turno'] ?? '').trim().toUpperCase()
    const turno: Turno | null = tRaw === 'T1' || tRaw === '1' ? 'T1' : tRaw === 'T2' || tRaw === '2' ? 'T2' : null
    if (turno) turnoMap.set(turno, round2((turnoMap.get(turno) ?? 0) + importe))
    const comp = Number((r['Comprobantes'] ?? r['Tickets'] ?? '').toString().trim())
    if (Number.isFinite(comp)) tickets += comp
  }
  return {
    fecha,
    ventas: [...ventasMap.entries()].map(([canal, monto]) => ({ canal, monto })),
    turnos: [...turnoMap.entries()].map(([turno, montoZ]) => ({ turno, montoZ })),
    cantidadTickets: tickets > 0 ? tickets : null,
  }
}
