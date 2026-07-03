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

  describe('PedidosYa cobrado en efectivo', () => {
    const ventasPya = (canalPya: 'pedidosya' | 'pedidosya_efectivo'): TurnoInput => ({
      ...base,
      efectivoDepositado: 56200, // en la caja entran 46200 de mostrador + 10000 de PedidosYa cash
      ventas: [
        { canal: 'efectivo', monto: 46200 },
        { canal: 'tarjetas', monto: 541700 },
        { canal: canalPya, monto: 10000 },
      ],
    })
    it('pedidosya_efectivo entra a la caja: depositando el cash real, diferencia 0', () => {
      const t = calcularTotales(ventasPya('pedidosya_efectivo'))
      expect(t.ventaEfectivo).toBe(56200)
      expect(t.diferenciaCaja).toBe(0)
    })
    it('si se cargara como PedidosYa (online) daría un sobrante falso de 10000', () => {
      const t = calcularTotales(ventasPya('pedidosya'))
      expect(t.ventaEfectivo).toBe(46200)
      expect(t.diferenciaCaja).toBe(10000)
    })
    it('no duplica la venta total', () => {
      expect(calcularTotales(ventasPya('pedidosya_efectivo')).ventaTotal).toBe(597900)
    })
  })

  describe('gasto pagado con fondo fijo', () => {
    const conFondoFijo: TurnoInput = {
      ...base, // fondoFijo 500000, ventaEfectivo 46200, efectivoDepositado 46200 → dif 0
      gastos: [{ tipo: 'mantenimiento', formaPago: 'fondo_fijo', monto: 8000 }],
    }
    it('baja del fondo fijo: restante = fondoFijo - gastosFondoFijo', () => {
      const t = calcularTotales(conFondoFijo)
      expect(t.gastosFondoFijo).toBe(8000)
      expect(t.fondoFijoRestante).toBe(492000)
    })
    it('NO sale de la caja del día: no toca gastosEfectivo, saldo ni diferencia', () => {
      const t = calcularTotales(conFondoFijo)
      expect(t.gastosEfectivo).toBe(0)
      expect(t.saldoEfectivo).toBe(46200)
      expect(t.diferenciaCaja).toBe(0)
    })
    it('sí cuenta en el total de gastos', () => {
      expect(calcularTotales(conFondoFijo).gastosTotal).toBe(8000)
    })
    it('restante negativo si se gasta más que el fondo fijo', () => {
      const t = calcularTotales({
        ...base,
        fondoFijo: 5000,
        gastos: [{ tipo: 'mantenimiento', formaPago: 'fondo_fijo', monto: 8000 }],
      })
      expect(t.fondoFijoRestante).toBe(-3000)
      expect(t.diferenciaCaja).toBe(0) // sigue sin afectar la caja del día
    })
  })

  describe('recupero de fondo fijo (guardado desde la caja)', () => {
    // Caso Morón: venta efectivo 66700, no deposita, guarda 66700 para el fondo fijo.
    const moron: TurnoInput = {
      ...base, efectivoDepositado: 0, retiroFondoFijo: 66700,
      ventas: [{ canal: 'efectivo', monto: 66700 }], tarjetas: [],
    }
    it('el recupero baja el esperado a depositar → no genera faltante', () => {
      const t = calcularTotales(moron)
      expect(t.saldoEfectivo).toBe(0) // 66700 - 0 gastos - 66700 recupero
      expect(t.diferenciaCaja).toBe(0)
    })
    it('expone el recupero en los totales', () => {
      expect(calcularTotales(moron).retiroFondoFijo).toBe(66700)
    })
    it('sin recupero, el mismo turno daría faltante', () => {
      expect(calcularTotales({ ...moron, retiroFondoFijo: 0 }).diferenciaCaja).toBe(-66700)
    })
    it('recupero + gasto en efectivo se suman (caso Ramos: coca + recupero)', () => {
      const t = calcularTotales({
        ...base, efectivoDepositado: 0, retiroFondoFijo: 44280,
        ventas: [{ canal: 'efectivo', monto: 74280 }], tarjetas: [],
        gastos: [{ tipo: 'mercaderia', formaPago: 'efectivo', monto: 30000 }],
      })
      expect(t.saldoEfectivo).toBe(0) // 74280 - 30000 - 44280
      expect(t.diferenciaCaja).toBe(0)
    })
    it('el recupero NO cambia el total depositado del día (se cancela algebraicamente)', () => {
      const t = calcularTotales({ ...base, efectivoDepositado: 30000, retiroFondoFijo: 16200 })
      expect(sumarDia([t]).totalDepositadoDia).toBe(30000) // = efectivoDepositado
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
