import { describe, it, expect } from 'vitest'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { CierreInput } from '@/lib/cierre/types'

const base: CierreInput = {
  fondoFijo: 500000,
  gastosTotal: 10000,
  notaCredito: 0,
  cantidadTickets: 100,
  turnos: [
    { turno: 'T1', montoZ: 183150, efectivoDepositado: 17000 },
    { turno: 'T2', montoZ: 920590, efectivoDepositado: 20000 },
  ],
  ventas: [
    { canal: 'efectivo', monto: 46200 },
    { canal: 'tarjetas', monto: 541700 },
    { canal: 'pedidosya', monto: 347250 },
    { canal: 'mercadopago', monto: 168590 },
  ],
  tarjetas: [
    { turno: 'T1', tipo: 'visa_debito', monto: 300000 },
    { turno: 'T2', tipo: 'visa_credito', monto: 241700 },
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
  it('totalDepositado suma el efectivo depositado por turno', () => {
    expect(calcularTotales(base).totalDepositado).toBe(37000)
  })
  it('saldoEfectivo = ventaEfectivo - gastos', () => {
    expect(calcularTotales(base).saldoEfectivo).toBe(36200)
  })
  it('diferencia de caja = totalDepositado - (ventaEfectivo - gastos)', () => {
    // (17000 + 20000) − (46200 − 10000) = 800  (ejemplo del Excel)
    expect(calcularTotales(base).diferenciaCaja).toBe(800)
  })
  it('totalCredito = mastercard + visa_credito + amex', () => {
    expect(calcularTotales(base).totalCredito).toBe(241700)
  })
  it('totalDebito = maestro + visa_debito', () => {
    expect(calcularTotales(base).totalDebito).toBe(300000)
  })
  it('credito y debito suman a través de ambos turnos', () => {
    const r = calcularTotales({
      ...base,
      tarjetas: [
        { turno: 'T1', tipo: 'mastercard', monto: 100 },
        { turno: 'T2', tipo: 'visa_credito', monto: 200 },
        { turno: 'T1', tipo: 'amex', monto: 50 },
        { turno: 'T1', tipo: 'maestro', monto: 10 },
        { turno: 'T2', tipo: 'visa_debito', monto: 20 },
      ],
    })
    expect(r.totalCredito).toBe(350)
    expect(r.totalDebito).toBe(30)
  })
  it('ticketPromedio es null cuando no hay tickets (no #DIV/0)', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 0 }).ticketPromedio).toBeNull()
    expect(calcularTotales({ ...base, cantidadTickets: null }).ticketPromedio).toBeNull()
  })
  it('ticketPromedio = ventaNeta / cantidadTickets', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 2 }).ticketPromedio).toBe(551870)
  })
})
