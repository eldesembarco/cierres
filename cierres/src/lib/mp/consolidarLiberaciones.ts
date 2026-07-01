// Consolida los reportes de Liberaciones de Mercado Pago (uno por cuenta) en UN
// solo Excel para un día: hoja "Detalle" (todas las operaciones crudas de ese día,
// las 12 columnas originales, todos los tipos y todos los locales) + hoja
// "Resumen por local". Es el archivo que se manda por mail cada mañana.
//
// Claves aprendidas de los archivos reales:
//  - Hay 2 variantes de header: el settlement clásico trae COMISIONES + IVA antes que
//    CANAL DE VENTA; el settlement_v2 las trae al revés → mapeamos SIEMPRE por nombre
//    de columna (no por posición) y emitimos en un orden canónico único.
//  - El mismo día aparece en varios reportes (el settlement del día D trae las
//    operaciones con FECHA DE ORIGEN = D−1; y quedan "stragglers" en reportes
//    posteriores). Además los reportes "manual" se pullean a veces 2 veces idénticos.
//    Por eso: filtrar por FECHA DE ORIGEN = día objetivo + dedup de fila completa.
import ExcelJS from 'exceljs'
import { readTabular, num } from '@/lib/ingest/parseMercadoPago'
import { round2, formatMoney } from '@/lib/money'

// Orden canónico de salida (12 columnas). Índices numéricos: VALOR(7), COMISIONES(8),
// MONTO NETO(10), IIBB(11).
const COLUMNAS = [
  'NOMBRE DE LOCAL',
  'FECHA DE ORIGEN',
  'FECHA DE APROBACIÓN',
  'FECHA DE LIQUIDACIÓN DEL DINERO',
  'TIPO DE MEDIO DE PAGO',
  'TIPO DE OPERACIÓN',
  'ID DEL PAQUETE',
  'VALOR DE LA COMPRA',
  'COMISIONES + IVA',
  'CANAL DE VENTA',
  'MONTO NETO DE LA OPERACIÓN',
  'IMPUESTOS COBRADOS POR RETENCIONES DE IIBB',
] as const
const NUM_COLS = new Set([7, 8, 10, 11])

export interface ArchivoLiberacion {
  nombre: string
  buffer: ArrayBuffer | Buffer
}

export interface ResumenLocal {
  local: string
  operaciones: number
  aprobados: number
  bruto: number
  comisiones: number
  neto: number
}

export interface Consolidado {
  fecha: string
  archivoNombre: string
  xlsx: Buffer
  totalOperaciones: number
  resumen: ResumenLocal[]
  total: ResumenLocal
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

// Header de un archivo → índice de columna canónica (o -1 si no la reconoce).
function canonIndex(header: string): number {
  const n = norm(header)
  if (n.includes('nombre de local')) return 0
  if (n.includes('fecha de origen')) return 1
  if (n.includes('fecha de aprobaci')) return 2
  if (n.includes('fecha de liquidaci')) return 3
  if (n.includes('tipo de medio de pago')) return 4
  if (n.includes('tipo de operaci')) return 5
  if (n.includes('id del paquete')) return 6
  if (n.includes('valor de la compra')) return 7
  if (n.includes('comisiones')) return 8
  if (n.includes('canal de venta')) return 9
  if (n.includes('monto neto')) return 10
  if (n.includes('retenciones de iibb') || n.includes('impuestos cobrados por retenciones')) return 11
  return -1
}

type Fila = (string | number | null)[] // longitud 12; numéricas = number|null, resto = string|null

async function leerFilas(archivo: ArchivoLiberacion): Promise<Fila[]> {
  const { headers, rows } = await readTabular(archivo.buffer)
  // Si el archivo no tiene ni NOMBRE DE LOCAL ni FECHA DE ORIGEN, no es un settlement.
  const headerFor: (string | undefined)[] = new Array(12).fill(undefined)
  for (const h of headers) {
    const ci = canonIndex(h)
    if (ci >= 0 && !headerFor[ci]) headerFor[ci] = h
  }
  if (headerFor[0] === undefined && headerFor[1] === undefined) return []

  const out: Fila[] = []
  for (const r of rows) {
    const cells: Fila = new Array(12).fill(null)
    for (let ci = 0; ci < 12; ci++) {
      const hn = headerFor[ci]
      if (!hn) continue
      const raw = (r[hn] ?? '').trim()
      if (raw === '') continue
      cells[ci] = NUM_COLS.has(ci) ? num(raw) : raw
    }
    if (cells.every((c) => c === null)) continue
    out.push(cells)
  }
  return out
}

// Consolida los archivos para un día (YYYY-MM-DD): filtra por FECHA DE ORIGEN, dedup
// de fila completa, y arma el workbook con las 2 hojas.
export async function consolidarLiberaciones(
  archivos: ArchivoLiberacion[],
  fecha: string,
): Promise<Consolidado> {
  const seen = new Set<string>()
  const filas: Fila[] = []
  for (const a of archivos) {
    let fs: Fila[]
    try {
      fs = await leerFilas(a)
    } catch {
      continue // archivo ilegible / no-settlement: se ignora
    }
    for (const f of fs) {
      const origen = String(f[1] ?? '').slice(0, 10)
      if (origen !== fecha) continue
      const key = f.map((c) => (c === null ? '' : String(c))).join('')
      if (seen.has(key)) continue
      seen.add(key)
      filas.push(f)
    }
  }

  // Orden: por local (asc; "(sin nombre)" primero) y luego FECHA DE ORIGEN desc.
  filas.sort((a, b) => {
    const la = String(a[0] ?? ''),
      lb = String(b[0] ?? '')
    if (la !== lb) return la < lb ? -1 : 1
    const fa = String(a[1] ?? ''),
      fb = String(b[1] ?? '')
    return fa < fb ? 1 : fa > fb ? -1 : 0
  })

  // Resumen por local.
  const agg = new Map<string, ResumenLocal>()
  for (const f of filas) {
    const local = (f[0] as string | null) || '(sin nombre)'
    const tipo = norm(String(f[5] ?? ''))
    let g = agg.get(local)
    if (!g) {
      g = { local, operaciones: 0, aprobados: 0, bruto: 0, comisiones: 0, neto: 0 }
      agg.set(local, g)
    }
    g.operaciones += 1
    if (tipo.includes('pago aprobado')) g.aprobados += 1
    g.bruto += typeof f[7] === 'number' ? f[7] : 0
    g.comisiones += typeof f[8] === 'number' ? f[8] : 0
    g.neto += typeof f[10] === 'number' ? f[10] : 0
  }
  const resumen = [...agg.values()]
    .map((r) => ({ ...r, bruto: round2(r.bruto), comisiones: round2(r.comisiones), neto: round2(r.neto) }))
    .sort((a, b) => (a.local < b.local ? -1 : a.local > b.local ? 1 : 0))
  const total: ResumenLocal = {
    local: 'TOTAL',
    operaciones: resumen.reduce((s, r) => s + r.operaciones, 0),
    aprobados: resumen.reduce((s, r) => s + r.aprobados, 0),
    bruto: round2(resumen.reduce((s, r) => s + r.bruto, 0)),
    comisiones: round2(resumen.reduce((s, r) => s + r.comisiones, 0)),
    neto: round2(resumen.reduce((s, r) => s + r.neto, 0)),
  }

  const xlsx = await construirXlsx(fecha, filas, resumen, total)
  return {
    fecha,
    archivoNombre: `MP Liberaciones ${fecha} - COMPLETO (todos los locales).xlsx`,
    xlsx,
    totalOperaciones: filas.length,
    resumen,
    total,
  }
}

const MONEY = '#,##0.00'

async function construirXlsx(
  fecha: string,
  filas: Fila[],
  resumen: ResumenLocal[],
  total: ResumenLocal,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cierres — El Desembarco'

  // Hoja Detalle
  const det = wb.addWorksheet('Detalle')
  const head = det.addRow([...COLUMNAS])
  head.font = { bold: true }
  for (const f of filas) {
    const row = det.addRow(f.map((c) => (c === null ? '' : c)))
    for (const ci of NUM_COLS) row.getCell(ci + 1).numFmt = MONEY
  }
  det.addRow([`TOTALES (${filas.length} operaciones)`])
  const anchos = [26, 26, 26, 30, 20, 20, 20, 16, 15, 14, 18, 16]
  det.columns.forEach((c, i) => (c.width = anchos[i] ?? 14))

  // Hoja Resumen por local
  const res = wb.addWorksheet('Resumen por local')
  const rhead = res.addRow(['Local', 'Operaciones', 'Pagos aprobados', 'Valor compra (bruto)', 'Comisiones + IVA', 'Monto neto'])
  rhead.font = { bold: true }
  const addResRow = (r: ResumenLocal, bold = false) => {
    const row = res.addRow([r.local, r.operaciones, r.aprobados, r.bruto, r.comisiones, r.neto])
    row.getCell(4).numFmt = MONEY
    row.getCell(5).numFmt = MONEY
    row.getCell(6).numFmt = MONEY
    if (bold) row.font = { bold: true }
  }
  for (const r of resumen) addResRow(r)
  addResRow(total, true)
  res.columns.forEach((c, i) => (c.width = i === 0 ? 30 : 18))

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

// ── Mail (asunto + cuerpo HTML) que manda n8n con el Excel adjunto ──

function fechaCorta(fecha: string): string {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha
}

export function mailAsunto(c: Consolidado): string {
  const L = c.resumen.length
  return `Liberaciones Mercado Pago — ${fechaCorta(c.fecha)} — ${c.totalOperaciones} operaciones · ${L} local${L === 1 ? '' : 'es'}`
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const nombreLocal = (s: string) => (s === '(sin nombre)' ? 'Sin local (retiros / ajustes)' : s)

export function mailHtml(c: Consolidado): string {
  const filaTd = 'padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums'
  const filas = c.resumen
    .map(
      (r, i) => `
      <tr style="background:${i % 2 ? '#ffffff' : '#f8fafc'}">
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600">${escapeHtml(nombreLocal(r.local))}</td>
        <td style="${filaTd};color:#475569">${r.operaciones}</td>
        <td style="${filaTd};color:#475569">${r.aprobados}</td>
        <td style="${filaTd};color:#0f172a">${formatMoney(r.bruto)}</td>
        <td style="${filaTd};color:#b45309">${formatMoney(r.comisiones)}</td>
        <td style="${filaTd};color:#047857;font-weight:600">${formatMoney(r.neto)}</td>
      </tr>`,
    )
    .join('')

  const th = 'padding:9px 10px;text-align:right;font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:#e2e8f0;font-weight:600'
  const thL = th.replace('text-align:right', 'text-align:left')

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:0 auto;color:#0f172a">
  <div style="background:#2563eb;border-radius:14px 14px 0 0;padding:18px 22px;color:#fff">
    <div style="font-size:12px;letter-spacing:.06em;opacity:.9">LIBERACIONES MERCADO PAGO · CONSOLIDADO DEL DÍA</div>
    <div style="font-size:23px;font-weight:700;margin-top:2px">${fechaCorta(c.fecha)}</div>
    <div style="font-size:13px;opacity:.9;margin-top:4px">${c.totalOperaciones} operaciones · ${c.resumen.length} locales · detalle completo en el Excel adjunto</div>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#fff">
    <thead>
      <tr style="background:#1e293b">
        <th style="${thL}">Local</th>
        <th style="${th}">Oper.</th>
        <th style="${th}">Aprob.</th>
        <th style="${th}">Valor compra</th>
        <th style="${th}">Comisiones</th>
        <th style="${th}">Monto neto</th>
      </tr>
    </thead>
    <tbody>${filas}
      <tr style="background:#f1f5f9;font-weight:700">
        <td style="padding:10px;color:#0f172a">TOTAL</td>
        <td style="padding:10px;text-align:right;color:#475569;font-variant-numeric:tabular-nums">${c.total.operaciones}</td>
        <td style="padding:10px;text-align:right;color:#475569;font-variant-numeric:tabular-nums">${c.total.aprobados}</td>
        <td style="padding:10px;text-align:right;font-variant-numeric:tabular-nums">${formatMoney(c.total.bruto)}</td>
        <td style="padding:10px;text-align:right;color:#b45309;font-variant-numeric:tabular-nums">${formatMoney(c.total.comisiones)}</td>
        <td style="padding:10px;text-align:right;color:#047857;font-variant-numeric:tabular-nums">${formatMoney(c.total.neto)}</td>
      </tr>
    </tbody>
  </table>
  <div style="padding:13px 22px;background:#f8fafc;border-radius:0 0 14px 14px;font-size:12px;color:#64748b;line-height:1.5">
    Consolidado de todos los reportes de Liberaciones del día (todos los locales y todos los tipos de operación:
    pagos aprobados, devoluciones, reclamos, envíos y retiros). Las <b>comisiones</b> y los <b>retiros</b> figuran en negativo.
    El Excel adjunto trae la hoja <b>Detalle</b> (operación por operación) y <b>Resumen por local</b>.
    Generado automáticamente por Cierres · El Desembarco.
  </div>
</div>`
}
