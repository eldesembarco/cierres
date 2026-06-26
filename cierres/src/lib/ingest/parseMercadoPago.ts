// Lector del reporte "collection" de Mercado Pago (.xlsx) — la liquidación de
// Mercado Delivery (lado plata/app). El export trae una fila por operación con el
// local identificado (store_id + nombre), bruto, neto, comisión implícita, estado
// (approved/refunded) y fecha. Acá lo agregamos a (store_id, fecha de venta).
//
// Diseño: `readMpSheet` (exceljs, I/O) separado de `aggregateMp` (puro, testeable).
// Se matchean las columnas por la CLAVE de API entre paréntesis del encabezado
// (date_created, status, transaction_amount, net_received_amount, store_id…), que
// es estable aunque MP reordene o cambie el texto en español.
import ExcelJS from 'exceljs'
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
  const s = cellText(v).replace(/[^\d.,-]/g, '')
  // formato es-AR o en-US: el reporte viene "15000.00" (punto decimal).
  const n = Number(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
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
    const h = cellText(cell.value).toLowerCase()
    if (h.includes('date_created')) idx.fecha = col
    else if (h.includes('(status)')) idx.estado = col
    else if (h.includes('transaction_amount')) idx.bruto = col
    else if (h.includes('net_received_amount')) idx.neto = col
    else if (h.includes('amount_refunded')) idx.devuelto = col
    else if (h.includes('(store_id)')) idx.storeId = col
    else if (h.includes('nombre del local')) idx.storeName = col
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
