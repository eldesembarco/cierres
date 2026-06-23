import { describe, it, expect } from 'vitest'
import { parseTangoPdf } from '@/lib/ingest/parseTangoPdf'

// Muestra limpia que imita el texto extraído del PDF de "cierre de turno" de Tango.
const sample = `
21/06/2026 - TURNO TARDE

TOTAL VENTAS: 156,200.00 CANT. VENTAS: 4 PROMEDIO: 39,050.00

-- VENTAS POR FORMA DE COBRO --
Efectivo 10,000.00
VISA 20,000.00
PEYA TARJETA 126,200.00
TOTAL: 156,200.00
`

describe('parseTangoPdf', () => {
  it('lee el turno (TARDE → tarde)', () => {
    expect(parseTangoPdf(sample).turno).toBe('tarde')
  })

  it('lee la fecha DD/MM/YYYY → YYYY-MM-DD', () => {
    expect(parseTangoPdf(sample).fecha).toBe('2026-06-21')
  })

  it('lee la cantidad de tickets desde CANT. VENTAS', () => {
    expect(parseTangoPdf(sample).cantidadTickets).toBe(4)
  })

  it('mapea las formas de cobro a canales y agrega por canal', () => {
    const { ventas } = parseTangoPdf(sample)
    const byCanal = Object.fromEntries(ventas.map((v) => [v.canal, v.monto]))
    expect(byCanal.efectivo).toBe(10000)
    expect(byCanal.tarjetas).toBe(20000)
    expect(byCanal.pedidosya).toBe(126200)
  })

  it('montoZ = el TOTAL: de la sección de formas de cobro', () => {
    expect(parseTangoPdf(sample).montoZ).toBe(156200)
  })

  it('TURNO NOCHE también mapea a tarde', () => {
    const r = parseTangoPdf('21/06/2026 - TURNO NOCHE\n-- VENTAS POR FORMA DE COBRO --\nEfectivo 1,000.00\nTOTAL: 1,000.00')
    expect(r.turno).toBe('tarde')
  })

  it('TURNO MAÑANA mapea a manana', () => {
    const r = parseTangoPdf('21/06/2026 - TURNO MAÑANA\n-- VENTAS POR FORMA DE COBRO --\nEfectivo 1,000.00\nTOTAL: 1,000.00')
    expect(r.turno).toBe('manana')
  })

  it('agrega varias formas que caen en el mismo canal', () => {
    const r = parseTangoPdf(
      '21/06/2026 - TURNO TARDE\n-- VENTAS POR FORMA DE COBRO --\nVISA 10,000.00\nMASTERCARD 5,000.00\nTOTAL: 15,000.00',
    )
    const byCanal = Object.fromEntries(r.ventas.map((v) => [v.canal, v.monto]))
    expect(byCanal.tarjetas).toBe(15000)
    expect(r.ventas).toHaveLength(1)
  })

  // El texto real que extrae `unpdf` del PDF de Tango viene en UNA sola línea
  // (las celdas separadas por espacios, sin saltos). Esta muestra reproduce ese
  // formato real para asegurar que el parser lo soporta, no solo el sample con
  // saltos de línea.
  const flat =
    '21/06/2026-TURNO TARDE Caja: CAJA1 --DETALLE DE COMPROBANTES EMITIDOS-- ' +
    'Total Comprobantes: 126,200.00 TOTAL GENERAL: 126,200.00 CANT. VENTAS: 4 ' +
    '--RESUMEN DE VENTAS-- TOTAL VENTAS: 126,200.00 CANT. VENTAS: 4 PROMEDIO: 31,550.00 ' +
    '--RESUMEN POR TIPO DE COMPROBANTE-- Tipo comp. Cantidad Total ____ FAC 4 126,200.00 ____ TOTAL 4 126,200.00 ' +
    '--VENTAS POR FORMA DE COBRO-- Descripción Total ____________________________________ ' +
    'PEYA TARJETA 126,200.00 ____________________________________ TOTAL: 126,200.00 ' +
    '--RESUMEN DE VENTAS POR RUBROS-- Rubro Cantidad Total ____ TOTAL GENERAL: 9.00 141,118.93'

  it('parsea el texto real de unpdf (una sola línea, sin saltos)', () => {
    const r = parseTangoPdf(flat)
    expect(r.fecha).toBe('2026-06-21')
    expect(r.turno).toBe('tarde')
    expect(r.cantidadTickets).toBe(4)
    expect(r.montoZ).toBe(126200)
    expect(r.ventas).toEqual([{ canal: 'pedidosya', monto: 126200 }])
  })

  it('anulaciones/devoluciones = 0 cuando no hay esas secciones', () => {
    const r = parseTangoPdf(flat)
    expect(r.anulacionesAfectanCaja).toBe(0)
    expect(r.anulacionesTotal).toBe(0)
    expect(r.devolucionesTotal).toBe(0)
  })

  // Muestra (texto plano, formato real) CON anulaciones y devoluciones NO cero.
  // Verifica el scope por sección y que "AFECTARON" se distingue de "NO AFECTARON".
  const flatConAnul =
    '01/01/2026-TURNO TARDE Caja: CAJA1 ' +
    '--VENTAS POR FORMA DE COBRO-- Descripción Total ____ EFECTIVO 10,000.00 ____ TOTAL: 10,000.00 ' +
    '--RESUMEN DE VENTAS POR RUBROS-- Rubro Cantidad Total ____ TOTAL GENERAL: 1.00 10,000.00 ' +
    '-- ANULACIONES -- Comprobante Importe Fecha Hora ____ FAC001 5,000.00 01/01 10:00 ' +
    'AFECTARON CAJA TOTAL: 5,000.00 NO AFECTARON CAJA TOTAL: 1,200.00 TOTAL GENERAL: 6,200.00 ' +
    '-- DEVOLUCIONES -- Comprobante Importe Fecha Hora ____ NC001 3,400.00 01/01 11:00 ' +
    'TOTAL: 2.00 TOTAL IMPORTE: 3,400.00 ' +
    '-- COMANDAS POR ESTADO -- Estado Cantidad ____ TOTAL: 4'

  it('extrae anulaciones (afectan caja / total) y devoluciones del texto plano', () => {
    const r = parseTangoPdf(flatConAnul)
    expect(r.anulacionesAfectanCaja).toBe(5000)
    expect(r.anulacionesTotal).toBe(6200)
    expect(r.devolucionesTotal).toBe(3400)
    // No debe romper el parseo de ventas/montoZ que ya andaba.
    expect(r.montoZ).toBe(10000)
    expect(r.turno).toBe('tarde')
  })

  it('es tolerante a espacios extra', () => {
    const messy = `   21/06/2026   -   TURNO    TARDE
    TOTAL  VENTAS:   156,200.00    CANT.  VENTAS:  4   PROMEDIO: 39,050.00
    --  VENTAS POR FORMA DE COBRO  --
    Efectivo     10,000.00
    TOTAL:   10,000.00`
    const r = parseTangoPdf(messy)
    expect(r.turno).toBe('tarde')
    expect(r.cantidadTickets).toBe(4)
    expect(r.ventas[0]).toEqual({ canal: 'efectivo', monto: 10000 })
  })
})
