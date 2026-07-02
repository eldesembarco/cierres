// Lector de los reportes de Mercado Pago (lado plata/app). MP entrega DOS formatos
// con la misma idea (cobros por local), y este módulo soporta ambos, en .xlsx o .csv:
//
//   1) "collection" (detalle de cobros): una fila por operación, local por store_id,
//      columnas con la clave de API entre paréntesis (transaction_amount, net_received…).
//   2) "settlement"/Liberaciones: una fila por operación, local por NOMBRE, con
//      TIPO DE OPERACIÓN (Pago aprobado / Devolución / Reclamo / PAYOUTS / Pago de envío),
//      VALOR DE LA COMPRA, COMISIONES + IVA y MONTO NETO.
//
// `parseMpFile` lee el archivo (exceljs/papaparse), detecta cuál de los dos es por sus
// encabezados, y devuelve filas normalizadas (MpRawRow). `aggregateMp` (puro) las agrega
// a (local, fecha de venta): sólo los cobros aprobados suman; las devoluciones se cuentan
// aparte; los retiros (PAYOUTS) y la logística (Pago de envío) se descartan.
import ExcelJS from 'exceljs'
import Papa from 'papaparse'
import { round2 } from '@/lib/money'

export interface MpRawRow {
  fecha: string // YYYY-MM-DD (fecha de venta)
  estado: string // approved | refunded | (otros → ignorados)
  storeId: string // de "collection" (vacío en "settlement")
  storeName: string // de "settlement" (puede venir también en "collection")
  bruto: number // valor de la compra / transaction_amount
  neto: number // monto neto / net_received_amount
  devuelto: number // monto devuelto (positivo)
  canal?: string // CANAL DE VENTA del settlement (Delivery / QR / Presencial…) para la conciliación
  idPaquete?: string // ID DEL PAQUETE del settlement — distingue operaciones de igual monto en el dedup
  fechaAprobacion?: string // FECHA DE APROBACIÓN del settlement — idem (dedup fino)
}

export interface MpStoreDay {
  storeId: string
  storeName: string
  fecha: string
  brutoCobrado: number // bruto de aprobadas = lo que se cobró
  netoLiquidado: number // neto de aprobadas = lo que entra a la cuenta
  comision: number // bruto - neto de aprobadas
  pedidos: number // cantidad de aprobadas
  devoluciones: number // cantidad de devoluciones/reclamos
  devueltoMonto: number // suma de lo devuelto (positivo)
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

export function num(v: string): number {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '').trim()
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

function parseFecha(v: string): string {
  const s = String(v ?? '').trim()
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/) // 28/05/2026 22:11:02
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/) // 2026-05-28 / 2026-05-28T22:11:02-03:00
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  return s.slice(0, 10)
}

// ── Lector unificado: cualquier reporte (xlsx o csv) → {headers, filas-objeto} ──
export async function readTabular(
  buffer: ArrayBuffer | Buffer,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // .xlsx (zip). exceljs lee bien aun el .xlsx de MP que rompe a openpyxl.
    const wb = new ExcelJS.Workbook()
    const data: Buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
    await wb.xlsx.load(data as unknown as Parameters<typeof wb.xlsx.load>[0])
    const ws = wb.worksheets[0]
    if (!ws) return { headers: [], rows: [] }
    const headers: string[] = []
    ws.getRow(1).eachCell((cell, col) => {
      headers[col - 1] = cellText(cell.value).trim()
    })
    const cols = headers.map((h, i) => ({ h, i })).filter((c) => c.h)
    const rows: Record<string, string>[] = []
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const obj: Record<string, string> = {}
      for (const { h, i } of cols) obj[h] = cellText(row.getCell(i + 1).value)
      rows.push(obj)
    }
    return { headers: cols.map((c) => c.h), rows }
  }
  // CSV (texto). papaparse auto-detecta el delimitador (coma o ;); TextDecoder saca el BOM.
  const parsed = Papa.parse<Record<string, string>>(new TextDecoder('utf-8').decode(bytes), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return { headers: parsed.meta.fields ?? [], rows: parsed.data }
}

// ── Reporte "collection" ──
function matchCollection(h: string): keyof MpRawRow | null {
  if (h.includes('date_created') || h.includes('fecha de compra')) return 'fecha'
  if (h.includes('(status)')) return 'estado'
  if (h.includes('transaction_amount') || h.includes('valor del producto')) return 'bruto'
  if (h.includes('net_received_amount') || h.includes('monto recibido')) return 'neto'
  if (h.includes('amount_refunded') || h.includes('monto devuelto')) return 'devuelto'
  if (h.includes('(store_id)') || h.includes('mero de local')) return 'storeId'
  if (h.includes('nombre del local')) return 'storeName'
  return null
}

function interpretCollection(headers: string[], rows: Record<string, string>[]): MpRawRow[] {
  const k: Partial<Record<keyof MpRawRow, string>> = {}
  for (const h of headers) {
    const f = matchCollection(h.toLowerCase())
    if (f && !k[f]) k[f] = h
  }
  for (const req of ['fecha', 'estado', 'bruto', 'neto', 'storeId'] as const) {
    if (!k[req]) {
      throw new Error(
        'El archivo no parece un reporte "collection" de Mercado Pago (falta Fecha de compra, Estado, Valor del producto, Monto recibido o Número de local).',
      )
    }
  }
  const out: MpRawRow[] = []
  for (const r of rows) {
    const storeId = (r[k.storeId!] ?? '').trim()
    if (!storeId) continue
    out.push({
      fecha: parseFecha(r[k.fecha!] ?? ''),
      estado: (r[k.estado!] ?? '').trim().toLowerCase(),
      storeId,
      storeName: k.storeName ? (r[k.storeName] ?? '').trim() : '',
      bruto: num(r[k.bruto!] ?? '0'),
      neto: num(r[k.neto!] ?? '0'),
      devuelto: k.devuelto ? num(r[k.devuelto] ?? '0') : 0,
    })
  }
  return out
}

// ── Reporte "settlement" / Liberaciones ──
// Mapea el TIPO DE OPERACIÓN a nuestro estado. PAYOUTS (retiros) y Pago de envío
// (logística) NO son ventas → se descartan.
function settlementEstado(tipoLower: string): 'approved' | 'refunded' | 'ignore' {
  if (tipoLower.includes('pago aprobado') || tipoLower.includes('aprobado')) return 'approved'
  if (tipoLower.includes('devoluci') || tipoLower.includes('reclamo') || tipoLower.includes('contracargo')) {
    return 'refunded'
  }
  return 'ignore' // PAYOUTS, Pago de envío, etc.
}

function matchSettlement(
  h: string,
): 'storeName' | 'fecha' | 'tipo' | 'bruto' | 'neto' | 'canal' | 'idPaquete' | 'fechaAprobacion' | null {
  if (h.includes('nombre de local')) return 'storeName'
  if (h.includes('fecha de origen')) return 'fecha'
  if (h.includes('fecha de aprobaci')) return 'fechaAprobacion'
  if (h.includes('tipo de operaci')) return 'tipo'
  if (h.includes('id del paquete')) return 'idPaquete'
  if (h.includes('valor de la compra')) return 'bruto'
  if (h.includes('monto neto')) return 'neto'
  if (h.includes('canal de venta')) return 'canal'
  return null
}

function interpretSettlement(headers: string[], rows: Record<string, string>[]): MpRawRow[] {
  const k: Partial<
    Record<'storeName' | 'fecha' | 'tipo' | 'bruto' | 'neto' | 'canal' | 'idPaquete' | 'fechaAprobacion', string>
  > = {}
  for (const h of headers) {
    const f = matchSettlement(h.toLowerCase())
    if (f && !k[f]) k[f] = h
  }
  for (const req of ['storeName', 'fecha', 'tipo', 'bruto', 'neto'] as const) {
    if (!k[req]) {
      throw new Error(
        'El archivo no parece un reporte de Liberaciones de Mercado Pago (falta Nombre de local, Fecha de origen, Tipo de operación, Valor de la compra o Monto neto).',
      )
    }
  }
  const out: MpRawRow[] = []
  for (const r of rows) {
    const storeName = (r[k.storeName!] ?? '').trim()
    if (!storeName) continue
    const estado = settlementEstado((r[k.tipo!] ?? '').toLowerCase())
    if (estado === 'ignore') continue // retiros / logística: no son ventas
    const bruto = num(r[k.bruto!] ?? '0')
    const neto = num(r[k.neto!] ?? '0')
    out.push({
      fecha: parseFecha(r[k.fecha!] ?? ''),
      estado,
      storeId: '',
      storeName,
      bruto,
      neto,
      devuelto: estado === 'refunded' ? Math.abs(bruto) : 0,
      canal: k.canal ? (r[k.canal] ?? '').trim() : undefined,
      idPaquete: k.idPaquete ? (r[k.idPaquete] ?? '').trim() : undefined,
      fechaAprobacion: k.fechaAprobacion ? (r[k.fechaAprobacion] ?? '').trim() : undefined,
    })
  }
  return out
}

function isSettlement(headers: string[]): boolean {
  const hl = headers.map((h) => h.toLowerCase())
  return hl.some((h) => h.includes('tipo de operaci')) && hl.some((h) => h.includes('valor de la compra'))
}

// Punto de entrada: lee el archivo, detecta el tipo de reporte y normaliza.
export async function parseMpFile(buffer: ArrayBuffer | Buffer): Promise<MpRawRow[]> {
  const { headers, rows } = await readTabular(buffer)
  return isSettlement(headers) ? interpretSettlement(headers, rows) : interpretCollection(headers, rows)
}

// Wrapper sobre texto CSV (lo usan los tests). Detecta collection vs settlement igual.
export function readMpCsv(text: string): MpRawRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const headers = parsed.meta.fields ?? []
  return isSettlement(headers) ? interpretSettlement(headers, parsed.data) : interpretCollection(headers, parsed.data)
}

// Agrega por (local, fecha). Sólo las operaciones APROBADAS cuentan como plata cobrada;
// las devoluciones/reclamos se cuentan aparte (no restan del bruto, igual que en collection).
export function aggregateMp(rows: MpRawRow[]): MpStoreDay[] {
  const map = new Map<string, MpStoreDay>()
  for (const r of rows) {
    const ident = r.storeId || r.storeName // collection usa store_id; settlement usa nombre
    const key = `${ident}|${r.fecha}`
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
    if (!g.storeId && r.storeId) g.storeId = r.storeId
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
