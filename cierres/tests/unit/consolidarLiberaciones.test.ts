import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { consolidarLiberaciones, type ArchivoLiberacion } from '@/lib/mp/consolidarLiberaciones'

const csv = (s: string): ArrayBuffer => {
  const b = Buffer.from(s, 'utf-8')
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}
const A = '2026-06-29T10:00:05.000-03:00'
const L = '2026-07-01T00:00:00.000-03:00'

// Archivo con orden CLÁSICO (COMISIONES + IVA antes que CANAL DE VENTA).
const clasico = [
  'NOMBRE DE LOCAL,FECHA DE ORIGEN,FECHA DE APROBACIÓN,FECHA DE LIQUIDACIÓN DEL DINERO,TIPO DE MEDIO DE PAGO,TIPO DE OPERACIÓN,ID DEL PAQUETE,VALOR DE LA COMPRA,COMISIONES + IVA,CANAL DE VENTA,MONTO NETO DE LA OPERACIÓN,IMPUESTOS COBRADOS POR RETENCIONES DE IIBB',
  `Local X,2026-06-29T09:00:00.000-03:00,${A},${L},available_money,Pago aprobado,PKG1,1000,-100,Delivery,900,-10`,
  `Local X,2026-06-29T11:00:00.000-03:00,${A},${L},available_money,Devolución de dinero,PKG2,-500,0,Delivery,-500,0`,
  `Local X,2026-06-28T09:00:00.000-03:00,${A},${L},available_money,Pago aprobado,PKG3,777,-7,Delivery,770,-1`, // otro día → excluido
  `,2026-06-29T20:00:00.000-03:00,${A},${L},,PAYOUTS,,-9999,0,,-9999,0`, // sin local → "(sin nombre)"
].join('\n')

// Archivo con orden settlement_v2 (CANAL DE VENTA antes que COMISIONES + IVA).
const v2 = [
  'NOMBRE DE LOCAL,FECHA DE ORIGEN,FECHA DE APROBACIÓN,FECHA DE LIQUIDACIÓN DEL DINERO,TIPO DE MEDIO DE PAGO,TIPO DE OPERACIÓN,ID DEL PAQUETE,VALOR DE LA COMPRA,CANAL DE VENTA,COMISIONES + IVA,MONTO NETO DE LA OPERACIÓN,IMPUESTOS COBRADOS POR RETENCIONES DE IIBB',
  `Local X,2026-06-29T09:00:00.000-03:00,${A},${L},available_money,Pago aprobado,PKG1,1000,Delivery,-100,900,-10`, // DUP exacta de la fila 1 clásico → dedup
  `Local Y,2026-06-29T12:00:00.000-03:00,${A},${L},available_money,Pago aprobado,PKG9,2000,Delivery,-200,1800,-20`,
].join('\n')

const archivos: ArchivoLiberacion[] = [
  { nombre: 'settlement-classic.csv', buffer: csv(clasico) },
  { nombre: 'settlement_v2.csv', buffer: csv(v2) },
]

describe('consolidarLiberaciones', () => {
  it('filtra por día, dedup de fila completa y agrega por local', async () => {
    const c = await consolidarLiberaciones(archivos, '2026-06-29')
    // Row1(X) + Row2(X dev) + PAYOUTS + Y ; la dup de v2 y el 28/06 no cuentan
    expect(c.totalOperaciones).toBe(4)
    const by = Object.fromEntries(c.resumen.map((r) => [r.local, r]))
    expect(by['Local X']).toMatchObject({ operaciones: 2, aprobados: 1, bruto: 500, comisiones: -100, neto: 400 })
    expect(by['Local Y']).toMatchObject({ operaciones: 1, aprobados: 1, bruto: 2000, comisiones: -200, neto: 1800 })
    expect(by['(sin nombre)']).toMatchObject({ operaciones: 1, aprobados: 0, bruto: -9999, neto: -9999 })
  })

  it('el total agrega todos los locales', async () => {
    const c = await consolidarLiberaciones(archivos, '2026-06-29')
    expect(c.total).toMatchObject({ local: 'TOTAL', operaciones: 4, aprobados: 2, bruto: -7499, neto: -7799 })
  })

  it('"(sin nombre)" ordena primero en el resumen', async () => {
    const c = await consolidarLiberaciones(archivos, '2026-06-29')
    expect(c.resumen[0].local).toBe('(sin nombre)')
  })

  it('el Excel tiene Detalle + Resumen y columnas en orden canónico', async () => {
    const c = await consolidarLiberaciones(archivos, '2026-06-29')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(c.xlsx as unknown as Parameters<typeof wb.xlsx.load>[0])
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Detalle', 'Resumen por local'])
    const h = wb.getWorksheet('Detalle')!.getRow(1)
    expect(h.getCell(9).value).toBe('COMISIONES + IVA')
    expect(h.getCell(10).value).toBe('CANAL DE VENTA')
    // última fila del Detalle = TOTALES (N operaciones)
    const det = wb.getWorksheet('Detalle')!
    expect(String(det.getRow(det.rowCount).getCell(1).value)).toContain('TOTALES (4 operaciones)')
  })

  it('archivoNombre incluye la fecha y "COMPLETO"', async () => {
    const c = await consolidarLiberaciones(archivos, '2026-06-29')
    expect(c.archivoNombre).toBe('MP Liberaciones 2026-06-29 - COMPLETO (todos los locales).xlsx')
  })

  it('día sin datos → 0 operaciones, sin romper', async () => {
    const c = await consolidarLiberaciones(archivos, '2026-01-01')
    expect(c.totalOperaciones).toBe(0)
    expect(c.resumen).toHaveLength(0)
    expect(c.total.operaciones).toBe(0)
  })
})
