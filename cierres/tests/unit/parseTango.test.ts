import { describe, it, expect } from 'vitest'
import { parseTango } from '@/lib/ingest/parseTango'

const csv = `Fecha,Turno,MedioPago,Importe,Comprobantes
2026-06-23,T1,Efectivo,46200,42
2026-06-23,T1,Tarjetas,541700,
2026-06-23,T1,Mercado Pago,168590,
2026-06-23,T2,Efectivo,85500,58
2026-06-23,T2,Tarjetas,483700,
2026-06-23,T2,PedidosYa,529255,
2026-06-23,T2,Mercado Pago,336970,`

describe('parseTango (por turno)', () => {
  it('devuelve los dos turnos mapeados a manana/tarde', () => {
    const r = parseTango(csv)
    expect(r.turnos.map((t) => t.turno)).toEqual(['manana', 'tarde'])
  })
  it('agrupa ventas por canal dentro de cada turno', () => {
    const r = parseTango(csv)
    const manana = r.turnos.find((t) => t.turno === 'manana')!
    expect(manana.ventas.find((v) => v.canal === 'efectivo')!.monto).toBe(46200)
    expect(manana.ventas.find((v) => v.canal === 'tarjetas')!.monto).toBe(541700)
    expect(manana.ventas.find((v) => v.canal === 'mercadopago')!.monto).toBe(168590)
    const tarde = r.turnos.find((t) => t.turno === 'tarde')!
    expect(tarde.ventas.find((v) => v.canal === 'pedidosya')!.monto).toBe(529255)
  })
  it('montoZ por turno = suma de importes del turno', () => {
    const r = parseTango(csv)
    expect(r.turnos.find((t) => t.turno === 'manana')!.montoZ).toBe(756490)
    expect(r.turnos.find((t) => t.turno === 'tarde')!.montoZ).toBe(1435425)
  })
  it('cantidadTickets por turno (null si 0)', () => {
    const r = parseTango(csv)
    expect(r.turnos.find((t) => t.turno === 'manana')!.cantidadTickets).toBe(42)
    expect(r.turnos.find((t) => t.turno === 'tarde')!.cantidadTickets).toBe(58)
  })
  it('lee la fecha', () => {
    expect(parseTango(csv).fecha).toBe('2026-06-23')
  })
})
