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

function parseTurno(raw: string): Turno | null {
  const t = norm(raw)
  if (t === 't1' || t === '1' || t === 'manana') return 'manana'
  if (t === 't2' || t === '2' || t === 'tarde') return 'tarde'
  return null
}

export interface TangoTurno {
  turno: Turno
  ventas: { canal: Canal; monto: number }[]
  montoZ: number
  cantidadTickets: number | null
}

export interface TangoParseResult {
  fecha: string | null
  turnos: TangoTurno[]
}

interface Acc {
  ventas: Map<Canal, number>
  montoZ: number
  tickets: number
}

export function parseTango(csv: string): TangoParseResult {
  const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })
  const turnos = new Map<Turno, Acc>()
  let fecha: string | null = null

  for (const r of data) {
    if (!fecha && (r['Fecha'] ?? '').trim()) fecha = r['Fecha'].trim()
    const medio = norm(r['MedioPago'] ?? r['Medio de pago'] ?? r['Medio'] ?? '')
    if (!medio) continue
    const turno = parseTurno(r['Turno'] ?? '')
    if (!turno) continue

    if (!turnos.has(turno)) turnos.set(turno, { ventas: new Map(), montoZ: 0, tickets: 0 })
    const acc = turnos.get(turno)!

    const importe = parseMoney(r['Importe'] ?? '0')
    const canal: Canal = MEDIO_A_CANAL[medio] ?? 'varios'
    acc.ventas.set(canal, round2((acc.ventas.get(canal) ?? 0) + importe))
    acc.montoZ = round2(acc.montoZ + importe)

    const comp = Number((r['Comprobantes'] ?? r['Tickets'] ?? '').toString().trim())
    if (Number.isFinite(comp)) acc.tickets += comp
  }

  const ordenTurno: Turno[] = ['manana', 'tarde']
  return {
    fecha,
    turnos: ordenTurno
      .filter((t) => turnos.has(t))
      .map((turno) => {
        const acc = turnos.get(turno)!
        return {
          turno,
          ventas: [...acc.ventas.entries()].map(([canal, monto]) => ({ canal, monto })),
          montoZ: acc.montoZ,
          cantidadTickets: acc.tickets > 0 ? acc.tickets : null,
        }
      }),
  }
}
