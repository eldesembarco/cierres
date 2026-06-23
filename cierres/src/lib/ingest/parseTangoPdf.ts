import { parseMoney, round2 } from '@/lib/money'
import type { Canal, Turno } from '@/lib/cierre/types'

export interface TangoPdfResult {
  fecha: string | null
  turno: Turno | null
  ventas: { canal: Canal; monto: number }[]
  montoZ: number
  cantidadTickets: number | null
}

// Mapea la descripción de la forma de cobro del PDF de Tango (en MAYÚSCULAS, sin
// espacios sobrantes) al canal interno de la app. Default → 'varios'.
const MEDIO_TANGO_A_CANAL: Record<string, Canal> = {
  EFECTIVO: 'efectivo',
  VISA: 'tarjetas',
  MASTERCARD: 'tarjetas',
  'VISA DEBITO': 'tarjetas',
  'MASTERCARD DEBITO': 'tarjetas',
  'AMERICAN EXPRESS': 'tarjetas',
  CABAL: 'tarjetas',
  NARANJA: 'tarjetas',
  'MERCADO PAGO': 'mercadopago',
  'QR NAVE': 'mercadopago',
  'MERCADO PAGO DELIVERY': 'mercado_pedidos',
  'PEYA TARJETA': 'pedidosya',
  'PEDIDOS YA EFECTIVO': 'pedidosya',
  RAPPI: 'rappi',
  MORFY: 'varios',
}

function mapMedio(desc: string): Canal {
  const key = desc.trim().toUpperCase().replace(/\s+/g, ' ')
  return MEDIO_TANGO_A_CANAL[key] ?? 'varios'
}

export function parseTangoPdf(text: string): TangoPdfResult {
  // --- Turno ---
  let turno: Turno | null = null
  const mTurno = text.match(/TURNO\s+(TARDE|NOCHE|MA[ÑN]ANA)/i)
  if (mTurno) {
    const t = mTurno[1].toUpperCase()
    turno = t === 'MAÑANA' || t === 'MANANA' ? 'manana' : 'tarde'
  }

  // --- Fecha: primer DD/MM/YYYY → YYYY-MM-DD ---
  let fecha: string | null = null
  const mFecha = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (mFecha) {
    const [, dd, mm, yyyy] = mFecha
    fecha = `${yyyy}-${mm}-${dd}`
  }

  // --- Cantidad de tickets ---
  let cantidadTickets: number | null = null
  const mTicketsCtx = text.match(/TOTAL\s+VENTAS:[\s\S]*?CANT\.?\s*VENTAS:\s*(\d+)/i)
  const mTicketsAny = mTicketsCtx ?? text.match(/CANT\.?\s*VENTAS:\s*(\d+)/i)
  if (mTicketsAny) cantidadTickets = Number(mTicketsAny[1])

  // --- Ventas por forma de cobro + montoZ ---
  const ventasMap = new Map<Canal, number>()
  let montoZ = 0

  const secIdx = text.search(/VENTAS\s+POR\s+FORMA\s+DE\s+COBRO/i)
  if (secIdx !== -1) {
    const section = text.slice(secIdx)
    const lines = section.split(/\r?\n/)
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (line === '') continue
      // El header de la sección (la línea con "VENTAS POR FORMA DE COBRO") no es una fila.
      if (/VENTAS\s+POR\s+FORMA\s+DE\s+COBRO/i.test(line)) continue

      // El TOTAL: de la sección cierra el bloque y define el montoZ.
      const mTotal = line.match(/^TOTAL:\s*([\d.,]+)\s*$/i)
      if (mTotal) {
        montoZ = parseMoney(mTotal[1])
        break
      }

      // Fila "<desc> <monto>": el monto es el último token tipo 126,200.00.
      const mRow = line.match(/^(.+?)\s+([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*$/)
      if (!mRow) continue
      const desc = mRow[1]
      const monto = parseMoney(mRow[2])
      if (monto === 0) continue
      const canal = mapMedio(desc)
      ventasMap.set(canal, round2((ventasMap.get(canal) ?? 0) + monto))
    }
  }

  const ventas = [...ventasMap.entries()].map(([canal, monto]) => ({ canal, monto }))

  return { fecha, turno, ventas, montoZ, cantidadTickets }
}
