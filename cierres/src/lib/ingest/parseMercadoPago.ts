// Lector del reporte "collection" de Mercado Pago — la liquidación de Mercado
// Delivery (lado plata/app). MP lo entrega en .xlsx O en .csv (mismo contenido):
// `parseMpFile` detecta el formato por los bytes y usa el lector que corresponde.
// Cada fila es una operación con el local identificado (store_id + nombre), bruto,
// neto, comisión implícita, estado (approved/refunded) y fecha. Lo agregamos a
// (store_id, fecha de venta).
//
// Diseño: lectores de I/O (`readMpSheet` exceljs / `readMpCsv` papaparse) separados
// de `aggregateMp` (puro, testeable). Se matchean las columnas por la CLAVE de API
// entre paréntesis del encabezado (date_created, status, transaction_amount,
// net_received_amount, store_id…), estable aunque MP reordene o cambie el texto.
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { round2 } from '@/lib/money'

export interface MpRawRow {
  fecha: string // YYYY-MM-DD (fecha de venta = date_created)
  estado: string // approved | refunded | ...
  storeId: string
  storeName: string
  bruto: number // transaction_amount (lo que pagó el cliente)
  neto: number // net_received_amount (lo que entra a la cuenta, post comisión)
  devuelto: number // amount_refunded
}

export interface MpStoreDay {
  storeId: string
  storeName: string
  fecha: string
  brutoCobrado: number // bruto de operaciones aprobadas = lo que se cobró
  netoLiquidado: number // neto de aprobadas = lo que entra a la cuenta
  comision: number // bruto - neto de aprobadas
  pedidos: number // cantidad de aprobadas
  devoluciones: number // cantidad de operaciones refunded
  devueltoMonto: number // suma de amount_refunded
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>
    if ('text' in o) return String(o.text)
    if ('result' in o) return String(o.result)
    if ('richText' in o && Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((t) => t.text).join('')
    }
    return ''
  }
  return String(v)
}

function num(v: ExcelJS.CellValue): number {
  if (typeof v === 'number') return v
  let s = cellText(v).replace(/[^\d.,-]/g, '').trim()
  if (!s) return 0
  // Soporta en-US ("1,519,950.00") y es-AR ("1.519.950,00"): el separador decimal
  // es el ÚLTIMO . o , ; el otro símbolo son miles y se descarta.
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const dec = lastComma > lastDot ? ',' : lastDot > lastComma ? '.' : ''
  if (dec) {
    const mil = dec === ',' ? '.' : ','
    s = s.split(mil).join('').replace(dec, '.')
  } else {
    s = s.replace(/[.,]/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// Resuelve a qué campo corresponde un encabezado: por la CLAVE de API entre
// paréntesis (estable) con respaldo en el texto en español. Sirve para .xlsx y .csv.
function matchField(headerLower: string): keyof MpRawRow | null {
  if (headerLower.includes('date_created') || headerLower.includes('fecha de compra')) return 'fecha'
  if (headerLower.includes('(status)')) return 'estado'
  if (headerLower.includes('transaction_amount') || headerLower.includes('valor del producto')) return 'bruto'
  if (headerLower.includes('net_received_amount') || headerLower.includes('monto recibido')) return 'neto'
  if (headerLower.includes('amount_refunded') || headerLower.includes('monto devuelto')) return 'devuelto'
  if (headerLower.includes('(store_id)') || headerLower.includes('mero de local')) return 'storeId'
  if (headerLower.includes('nombre del local')) return 'storeName'
  return null
}

function parseFecha(v: ExcelJS.CellValue): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = cellText(v).trim()
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/) // 28/05/2026 22:11:02
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/) // 2026-05-28
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  return s.slice(0, 10)
}

export async function readMpSheet(buffer: ArrayBuffer | Buffer): Promise<MpRawRow[]> {
  const wb = new ExcelJS.Workbook()
  // exceljs.load acepta Buffer; el .xlsx de MP rompe a openpyxl por el stylesheet,
  // pero exceljs lo lee bien. (cast por el Buffer genérico de @types/node moderno)
  const data: Buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0])
  const ws = wb.worksheets[0]
  if (!ws) return []

  const idx: Record<string, number> = {}
  ws.getRow(1).eachCell((cell, col) => {
    const field = matchField(cellText(cell.value).toLowerCase())
    if (field) idx[field] = col
  })
  for (const req of ['fecha', 'estado', 'bruto', 'neto', 'storeId'] as const) {
    if (!idx[req]) {
      throw new Error(
        'El Excel no parece un reporte "collection" de Mercado Pago (falta alguna columna esperada: Fecha de compra, Estado, Valor del producto, Monto recibido o Número de local).',
      )
    }
  }

  const rows: MpRawRow[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const storeId = cellText(row.getCell(idx.storeId).value).trim()
    if (!storeId) continue
    rows.push({
      fecha: parseFecha(row.getCell(idx.fecha).value),
      estado: cellText(row.getCell(idx.estado).value).trim().toLowerCase(),
      storeId,
      storeName: idx.storeName ? cellText(row.getCell(idx.storeName).value).trim() : '',
      bruto: num(row.getCell(idx.bruto).value),
      neto: num(row.getCell(idx.neto).value),
      devuelto: idx.devuelto ? num(row.getCell(idx.devuelto).value) : 0,
    })
  }
  return rows
}

// Lee el reporte de MP en formato CSV (mismo contenido que el .xlsx). papaparse
// auto-detecta el delimitador (coma o punto y coma).
export function readMpCsv(text: string): MpRawRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const headers = parsed.meta.fields ?? []
  const keyOf: Partial<Record<keyof MpRawRow, string>> = {}
  for (const h of headers) {
    const field = matchField(h.toLowerCase())
    if (field && !keyOf[field]) keyOf[field] = h
  }
  for (const req of ['fecha', 'estado', 'bruto', 'neto', 'storeId'] as const) {
    if (!keyOf[req]) {
      throw new Error(
        'El CSV no parece un reporte "collection" de Mercado Pago (falta alguna columna esperada: Fecha de compra, Estado, Valor del producto, Monto recibido o Número de local).',
      )
    }
  }
  const rows: MpRawRow[] = []
  for (const r of parsed.data) {
    const storeId = (r[keyOf.storeId!] ?? '').trim()
    if (!storeId) continue
    rows.push({
      fecha: parseFecha(r[keyOf.fecha!] ?? ''),
      estado: (r[keyOf.estado!] ?? '').trim().toLowerCase(),
      storeId,
      storeName: keyOf.storeName ? (r[keyOf.storeName] ?? '').trim() : '',
      bruto: num(r[keyOf.bruto!] ?? '0'),
      neto: num(r[keyOf.neto!] ?? '0'),
      devuelto: keyOf.devuelto ? num(r[keyOf.devuelto] ?? '0') : 0,
    })
  }
  return rows
}

// Detecta el formato por los bytes: el .xlsx es un zip (empieza con "PK"); cualquier
// otra cosa la tratamos como CSV (texto). Así el importador acepta los dos.
export async function parseMpFile(buffer: ArrayBuffer | Buffer): Promise<MpRawRow[]> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return readMpSheet(buffer) // PK → .xlsx (zip)
  }
  // CSV (texto). TextDecoder descarta el BOM si lo trae.
  return readMpCsv(new TextDecoder('utf-8').decode(bytes))
}

// Agrega por (store_id, fecha). Solo las operaciones APROBADAS cuentan como plata
// cobrada (las refunded son devoluciones: se reportan aparte, no suman ingreso).
export function aggregateMp(rows: MpRawRow[]): MpStoreDay[] {
  const map = new Map<string, MpStoreDay>()
  for (const r of rows) {
    const key = `${r.storeId}|${r.fecha}`
    let g = map.get(key)
    if (!g) {
      g = {
        storeId: r.storeId, storeName: r.storeName, fecha: r.fecha,
        brutoCobrado: 0, netoLiquidado: 0, comision: 0,
        pedidos: 0, devoluciones: 0, devueltoMonto: 0,
      }
      map.set(key, g)
    }
    if (!g.storeName && r.storeName) g.storeName = r.storeName
    if (r.estado === 'approved') {
      g.brutoCobrado += r.bruto
      g.netoLiquidado += r.neto
      g.pedidos += 1
    } else if (r.estado === 'refunded') {
      g.devoluciones += 1
      g.devueltoMonto += r.devuelto
    }
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      brutoCobrado: round2(g.brutoCobrado),
      netoLiquidado: round2(g.netoLiquidado),
      comision: round2(g.brutoCobrado - g.netoLiquidado),
      devueltoMonto: round2(g.devueltoMonto),
    }))
    .sort((a, b) => b.brutoCobrado - a.brutoCobrado)
}
