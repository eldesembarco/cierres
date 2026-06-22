import { describe, it, expect } from 'vitest'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { CierreInput } from '@/lib/cierre/types'

const base: CierreInput = {
  fondoFijo: 500000,
  gastosTotal: 10000,
  notaCredito: 0,
  cantidadTickets: 100,
  turnos: [{ turno: 'T1', montoZ: 183150 }, { turno: 'T2', montoZ: 920590 }],
  ventas: [
    { canal: 'efectivo', monto: 46200 },
    { canal: 'tarjetas', monto: 541700 },
    { canal: 'pedidosya', monto: 347250 },
    { canal: 'mercadopago', monto: 168590 },
  ],
}

describe('calcularTotales', () => {
  it('suma ventas por canal', () => {
    expect(calcularTotales(base).ventaTotal).toBe(1103740)
  })
  it('venta neta resta nota de crédito', () => {
    expect(calcularTotales({ ...base, notaCredito: 3740 }).ventaNeta).toBe(1100000)
  })
  it('totalZ suma los turnos', () => {
    expect(calcularTotales(base).totalZ).toBe(1103740)
  })
  it('diferencia de caja = totalZ - ventaTotal', () => {
    const r = calcularTotales({ ...base, ventas: [{ canal: 'efectivo', monto: 1103000 }] })
    expect(r.diferenciaCaja).toBe(740)
  })
  it('saldoEfectivo = ventaEfectivo - gastos', () => {
    expect(calcularTotales(base).saldoEfectivo).toBe(36200)
  })
  it('ticketPromedio es null cuando no hay tickets (no #DIV/0)', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 0 }).ticketPromedio).toBeNull()
    expect(calcularTotales({ ...base, cantidadTickets: null }).ticketPromedio).toBeNull()
  })
  it('ticketPromedio = ventaNeta / cantidadTickets', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 2 }).ticketPromedio).toBe(551870)
  })
})
