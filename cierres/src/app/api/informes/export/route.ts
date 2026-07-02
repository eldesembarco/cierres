// Descarga del informe en Excel (.xlsx). Solo admin/central. Usa la MISMA query
// y los MISMOS cálculos que la página `/informes`, en 3 hojas: Venta por tipo,
// Gastos por local y Diferencias de caja. Solo lectura.
import ExcelJS from 'exceljs'
import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import {
  construirInforme,
  buildWhere,
  primerDiaDelMes,
  hoyYmd,
  normalizarFecha,
  type CierreParaInforme,
} from '@/lib/informes/report'

// exceljs es Node-only (streams, zip): forzamos runtime Node.
export const runtime = 'nodejs'

const MONEY_FMT = '"$"#,##0.00'
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2563EB' }, // blue-600
}
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }
const TOTAL_FONT: Partial<ExcelJS.Font> = { bold: true }

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return new Response('No autenticado', { status: 401 })
  if (!puedeVerFinanzas(session.user.rol)) return new Response('Sin permiso', { status: 403 })

  const { searchParams } = new URL(request.url)
  const desde = normalizarFecha(searchParams.get('desde') ?? undefined, primerDiaDelMes())
  const hasta = normalizarFecha(searchParams.get('hasta') ?? undefined, hoyYmd())
  const localIdRaw = searchParams.get('localId') ?? ''
  const localId = localIdRaw && /^\d+$/.test(localIdRaw) ? Number(localIdRaw) : null

  const cierres = await prisma.cierre.findMany({
    where: buildWhere(desde, hasta, localId),
    include: { local: true, ventas: true, gastos: true },
    orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
  })

  const informe = construirInforme(cierres as unknown as CierreParaInforme[])

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Cierres · Grupo Desembarco'
  wb.created = new Date()

  // --- Hoja 1: Venta por tipo ---
  const wsVenta = wb.addWorksheet('Venta por tipo')
  wsVenta.columns = [
    { header: 'Tipo de venta', key: 'tipo', width: 24 },
    { header: 'Total', key: 'total', width: 18, style: { numFmt: MONEY_FMT } },
    { header: '% del total', key: 'pct', width: 14, style: { numFmt: '0.0"%"' } },
  ]
  estilarHeader(wsVenta)
  for (const f of informe.ventaPorTipo.filas) {
    wsVenta.addRow({ tipo: f.label, total: f.total, pct: f.porcentaje })
  }
  const totVenta = wsVenta.addRow({ tipo: 'Total', total: informe.ventaPorTipo.total, pct: 100 })
  totVenta.font = TOTAL_FONT
  totVenta.eachCell((c) => {
    c.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } }
  })

  // --- Hoja 2: Gastos por local ---
  const wsGastos = wb.addWorksheet('Gastos por local')
  wsGastos.columns = [
    { header: 'Local', key: 'local', width: 24 },
    { header: 'Rubro', key: 'rubro', width: 28 },
    { header: 'Total', key: 'total', width: 18, style: { numFmt: MONEY_FMT } },
  ]
  estilarHeader(wsGastos)
  for (const loc of informe.gastosPorLocal.locales) {
    if (loc.rubros.length === 0) {
      wsGastos.addRow({ local: loc.local, rubro: '(sin gastos)', total: 0 })
    } else {
      for (const r of loc.rubros) {
        wsGastos.addRow({ local: loc.local, rubro: r.tipo, total: r.total })
      }
    }
    const sub = wsGastos.addRow({ local: '', rubro: `Subtotal ${loc.local}`, total: loc.total })
    sub.font = { italic: true, bold: true }
  }
  const totGastos = wsGastos.addRow({
    local: 'Total',
    rubro: '',
    total: informe.gastosPorLocal.total,
  })
  totGastos.font = TOTAL_FONT
  totGastos.eachCell((c) => {
    c.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } }
  })

  // --- Hoja 3: Diferencias de caja ---
  const wsDif = wb.addWorksheet('Diferencias de caja')
  wsDif.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Turno', key: 'turno', width: 10 },
    { header: 'Local', key: 'local', width: 24 },
    { header: 'Efectivo depositado', key: 'dep', width: 20, style: { numFmt: MONEY_FMT } },
    { header: 'Venta efectivo', key: 'ventaEf', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'Gastos efectivo', key: 'gastosEf', width: 18, style: { numFmt: MONEY_FMT } },
    { header: 'Diferencia', key: 'dif', width: 16, style: { numFmt: MONEY_FMT } },
  ]
  estilarHeader(wsDif)
  for (const f of informe.diferencias.filas) {
    const row = wsDif.addRow({
      fecha: fechaYmd(f.fecha),
      turno: f.turnoLabel,
      local: f.local,
      dep: f.efectivoDepositado,
      ventaEf: f.ventaEfectivo,
      gastosEf: f.gastosEfectivo,
      dif: f.diferencia,
    })
    // Color de la diferencia: rojo negativo, ámbar positivo, verde cero.
    const difCell = row.getCell('dif')
    difCell.font = { color: { argb: colorDiferencia(f.diferencia) }, bold: f.diferencia !== 0 }
  }
  const totDif = wsDif.addRow({
    fecha: 'Total',
    turno: '',
    local: '',
    dep: '',
    ventaEf: '',
    gastosEf: '',
    dif: informe.diferencias.total,
  })
  totDif.font = TOTAL_FONT
  totDif.getCell('dif').font = {
    bold: true,
    color: { argb: colorDiferencia(informe.diferencias.total) },
  }
  totDif.eachCell((c) => {
    c.border = { top: { style: 'thin', color: { argb: 'FF94A3B8' } } }
  })

  const buffer = await wb.xlsx.writeBuffer()
  const filename = `informe_${desde}_${hasta}.xlsx`

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function estilarHeader(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1)
  header.font = HEADER_FONT
  header.height = 18
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.alignment = { vertical: 'middle' }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

function colorDiferencia(n: number): string {
  if (n === 0) return 'FF047857' // emerald-700
  return n < 0 ? 'FFDC2626' /* red-600 */ : 'FFD97706' /* amber-600 */
}

function fechaYmd(d: Date): string {
  // @db.Date → medianoche UTC. Mostramos DD/MM/YYYY en UTC para no correr el día.
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day}/${m}/${y}`
}
