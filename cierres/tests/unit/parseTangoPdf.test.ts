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

  // Distintos PDFs de cierre Tango se extraen con DISTINTO espaciado vía `unpdf`.
  // Esta muestra reproduce el formato "sucio" REAL del 23/06: barras y números
  // partidos ("23/ 06/ 2026", "137, 445. 00"), letras separadas dentro de las
  // palabras ("Ef ec t i v o", "PEYA TARJ ETA"), y los marcadores "--" como
  // "- - …- -". El parser debe normalizar primero y extraer igual que el limpio.
  const spaced =
    '23/ 06/ 2026- TURNO TARDE Caj a: CAJ A1 Aper t ur a: 23/ 06/ 2026 16: 57 ' +
    '- - RESUMEN DE VENTAS- - Vent as del i v er y : 137, 445. 00 Cant . Vent as : 8 Pr omedi o: 17, 180. 63 ' +
    '________________________________________ TOTAL VENTAS: 137, 445. 00 CANT. VENTAS: 8 PROMEDI O: 17, 180. 63 ' +
    '- - DEVOLUCI ONES- - Comanda Ar t í c ul o Cant i dad I mpor t e __________ TOTAL: 0. 00 TOTAL I MPORTE: 0. 00 ' +
    '- - COMANDAS POR ESTADO- - Es t ado Cant i dad Tot al Cubi er t os ___________ ' +
    'Cobr ada 8 137, 445. 00 0 En Ct a. Ct e. 2 14, 500. 00 0 TOTAL TURNO: 10 151, 945. 00 0 TOTAL ANUL. / CANC 0 0. 00 0 ' +
    '- - VENTAS POR FORMA DE COBRO- - Des c r i pc i ón Tot al ____________________________________ ' +
    'Ef ec t i v o 18, 000. 00 MERCADOPAGO 51, 100. 00 PEYA TARJ ETA 68, 345. 00 ____________________________________ ' +
    'TOTAL: 137, 445. 00 ' +
    '- - RESUMEN DE VENTAS POR RUBROS- - Rubr o Cant i dad Tot al __________ TOTAL GENERAL: 14. 00 137, 445. 00'

  it('normaliza el texto con espacios espurios (formato real "sucio" del 23/06)', () => {
    const r = parseTangoPdf(spaced)
    expect(r.fecha).toBe('2026-06-23')
    expect(r.turno).toBe('tarde')
    expect(r.cantidadTickets).toBe(8)
    expect(r.montoZ).toBe(137445)
    const byCanal = Object.fromEntries(r.ventas.map((v) => [v.canal, v.monto]))
    expect(byCanal.efectivo).toBe(18000)
    expect(byCanal.mercadopago).toBe(51100)
    expect(byCanal.pedidosya).toBe(68345)
    expect(r.ventas).toHaveLength(3)
  })

  it('en el formato "sucio" no confunde el conteo+monto de COMANDAS con una venta', () => {
    // "TOTAL TURNO: 10 151,945.00" NO debe colarse como venta (distinta sección)
    // ni fusionarse a "10151945.00": el conteo "10" y el monto "151,945.00"
    // quedan separados porque no hay separador entre esos dígitos.
    const r = parseTangoPdf(spaced)
    const total = r.ventas.reduce((acc, v) => acc + v.monto, 0)
    expect(total).toBe(137445)
  })

  it('anulaciones/devoluciones = 0 cuando el "sucio" no trae sección ANULACIONES', () => {
    const r = parseTangoPdf(spaced)
    expect(r.anulacionesAfectanCaja).toBe(0)
    expect(r.anulacionesTotal).toBe(0)
    expect(r.devolucionesTotal).toBe(0)
  })
})
