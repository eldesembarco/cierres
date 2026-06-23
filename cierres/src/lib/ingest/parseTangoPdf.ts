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
  // El texto real que extrae unpdf del PDF de Tango viene en UNA sola línea (las
  // celdas separadas por espacios, sin saltos). El sample de los tests viene con
  // saltos de línea. Para soportar AMBOS, aislamos la sección "VENTAS POR FORMA
  // DE COBRO" hasta su "TOTAL:" y parseamos pares "<descripción> <monto>".
  const ventasMap = new Map<Canal, number>()
  let montoZ = 0

  const mHeader = text.match(/VENTAS\s+POR\s+FORMA\s+DE\s+COBRO/i)
  if (mHeader && mHeader.index !== undefined) {
    // Desde justo después del header de la sección (sin comernos el resto del
    // documento: el texto real de unpdf no tiene saltos de línea).
    const afterHeader = text.slice(mHeader.index + mHeader[0].length)
    // El "TOTAL:" de la sección cierra el bloque y define el montoZ.
    const mTotal = afterHeader.match(/TOTAL:\s*([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/i)
    if (mTotal) montoZ = parseMoney(mTotal[1])

    // Cuerpo: lo que hay entre el header y el "TOTAL:" de la sección.
    const bodyEnd = mTotal ? afterHeader.indexOf(mTotal[0]) : afterHeader.length
    let body = afterHeader.slice(0, bodyEnd)
    // Sacamos separadores de líneas (corridas de guiones bajos) y el encabezado
    // de columnas ("Descripción"/"Total") que no son filas de datos.
    body = body
      .replace(/_+/g, ' ')
      .replace(/Descripci[oó]n/gi, ' ')
      .replace(/\bTotal\b/gi, ' ')

    // Fila "<descripción> <monto>": capturamos el texto (no numérico) seguido del
    // monto. Global: funciona tanto en línea única como con saltos de línea.
    const rowRe = /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .]*?)\s+([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?=\s|$)/g
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(body)) !== null) {
      const desc = m[1]
      const monto = parseMoney(m[2])
      if (monto === 0) continue
      const canal = mapMedio(desc)
      ventasMap.set(canal, round2((ventasMap.get(canal) ?? 0) + monto))
    }
  }

  const ventas = [...ventasMap.entries()].map(([canal, monto]) => ({ canal, monto }))

  return { fecha, turno, ventas, montoZ, cantidadTickets }
}
