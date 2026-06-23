import { describe, it, expect } from 'vitest'
import { calcularTotales, sumarDia } from '@/lib/cierre/calculations'
import type { TurnoInput } from '@/lib/cierre/types'

const base: TurnoInput = {
  fondoFijo: 500000, montoZ: 183150, efectivoDepositado: 46200, notaCredito: 0, cantidadTickets: 100,
  ventas: [{ canal: 'efectivo', monto: 46200 }, { canal: 'tarjetas', monto: 541700 }],
  tarjetas: [{ tipo: 'visa_credito', monto: 300000 }, { tipo: 'visa_debito', monto: 241700 }],
  detalles: [],
  gastos: [],
}

describe('calcularTotales (por turno)', () => {
  it('venta total y neta', () => {
    const t = calcularTotales(base)
    expect(t.ventaTotal).toBe(587900)
    expect(t.ventaNeta).toBe(587900)
  })
  it('venta neta resta nota de crédito', () => {
    expect(calcularTotales({ ...base, notaCredito: 7900 }).ventaNeta).toBe(580000)
  })
  it('sin gastos: diferencia = depositado - efectivo', () => {
    expect(calcularTotales(base).diferenciaCaja).toBe(0)
  })
  it('descuadre por menos depositado', () => {
    expect(calcularTotales({ ...base, efectivoDepositado: 40000 }).diferenciaCaja).toBe(-6200)
  })
  it('credito y debito', () => {
    const t = calcularTotales(base)
    expect(t.totalCredito).toBe(300000)
    expect(t.totalDebito).toBe(241700)
  })
  it('ticket promedio null si 0', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 0 }).ticketPromedio).toBeNull()
    expect(calcularTotales({ ...base, cantidadTickets: null }).ticketPromedio).toBeNull()
  })
  it('ticket promedio = ventaNeta / cantidadTickets', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 100 }).ticketPromedio).toBe(5879)
  })

  describe('gastos como líneas', () => {
    const conGastos: TurnoInput = {
      ...base,
      gastos: [
        { tipo: 'mercaderia', formaPago: 'efectivo', monto: 10000 },
        { tipo: 'servicios', formaPago: 'tarjeta', monto: 5000 },
        { tipo: 'limpieza', formaPago: 'transferencia', monto: 3000 },
      ],
    }
    it('gastosTotal suma todos los gastos', () => {
      expect(calcularTotales(conGastos).gastosTotal).toBe(18000)
    })
    it('gastosEfectivo suma solo los pagados en efectivo', () => {
      expect(calcularTotales(conGastos).gastosEfectivo).toBe(10000)
    })
    it('un gasto en tarjeta NO reduce el saldo de efectivo', () => {
      // saldoEfectivo = ventaEfectivo(46200) - gastosEfectivo(10000) = 36200
      expect(calcularTotales(conGastos).saldoEfectivo).toBe(36200)
    })
    it('diferencia usa solo los gastos en efectivo', () => {
      // diferencia = depositado(46200) - saldoEfectivo(36200) = 10000
      expect(calcularTotales(conGastos).diferenciaCaja).toBe(10000)
    })
    it('depositando el saldo esperado, la diferencia es 0', () => {
      // con efectivo depositado igual a (46200 - 10000) = 36200 → diferencia 0
      expect(calcularTotales({ ...conGastos, efectivoDepositado: 36200 }).diferenciaCaja).toBe(0)
    })
  })
})

describe('sumarDia', () => {
  it('suma dos turnos', () => {
    const d = sumarDia([calcularTotales(base), calcularTotales(base)])
    expect(d.ventaTotalDia).toBe(1175800)
    expect(d.ventaEfectivoDia).toBe(92400)
    expect(d.diferenciaDia).toBe(0)
  })
  it('total depositado del día = suma de depositados de cada turno', () => {
    const manana = calcularTotales({ ...base, efectivoDepositado: 46200 })
    const tarde = calcularTotales({ ...base, efectivoDepositado: 40000 })
    const d = sumarDia([manana, tarde])
    // diferencia + saldoEfectivo reconstruye el efectivoDepositado de cada turno
    expect(d.totalDepositadoDia).toBe(86200)
    expect(d.diferenciaDia).toBe(-6200)
  })
})
