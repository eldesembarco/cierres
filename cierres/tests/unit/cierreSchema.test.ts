import { describe, it, expect } from 'vitest'
import { turnoInputSchema } from '@/lib/cierre/schema'

const valido = {
  fondoFijo: 500000, montoZ: 0, efectivoDepositado: 0, notaCredito: 0,
  ventas: [{ canal: 'efectivo', monto: 100 }],
}

describe('turnoInputSchema', () => {
  it('acepta una carga válida mínima', () => {
    expect(turnoInputSchema.parse(valido).ventas[0].canal).toBe('efectivo')
  })
  it('rechaza montos negativos', () => {
    expect(() => turnoInputSchema.parse({ ...valido, montoZ: -1 })).toThrow()
  })
  it('rechaza un canal inválido', () => {
    expect(() => turnoInputSchema.parse({ ...valido, ventas: [{ canal: 'cripto', monto: 1 }] })).toThrow()
  })
  it('rechaza canales duplicados', () => {
    expect(() => turnoInputSchema.parse({ ...valido, ventas: [{ canal: 'efectivo', monto: 1 }, { canal: 'efectivo', monto: 2 }] })).toThrow()
  })
  it('tarjetas y detalles por defecto son []', () => {
    const r = turnoInputSchema.parse(valido)
    expect(r.tarjetas).toEqual([])
    expect(r.detalles).toEqual([])
  })
  it('acepta detalles de cupones', () => {
    const r = turnoInputSchema.parse({ ...valido, detalles: [{ canal: 'mercadopago', referencia: 'MP6971', importe: 17500 }] })
    expect(r.detalles[0].referencia).toBe('MP6971')
  })

  describe('gastos', () => {
    it('gastos por defecto es []', () => {
      expect(turnoInputSchema.parse(valido).gastos).toEqual([])
    })
    it('acepta un gasto válido', () => {
      const r = turnoInputSchema.parse({
        ...valido,
        gastos: [{ tipo: 'mercaderia', formaPago: 'efectivo', monto: 1000, descripcion: 'verdura', comprobanteId: 7 }],
      })
      expect(r.gastos[0]).toMatchObject({ tipo: 'mercaderia', formaPago: 'efectivo', monto: 1000, comprobanteId: 7 })
    })
    it('acepta un gasto sin descripcion ni comprobante', () => {
      const r = turnoInputSchema.parse({ ...valido, gastos: [{ tipo: 'varios', formaPago: 'tarjeta', monto: 500 }] })
      expect(r.gastos[0].monto).toBe(500)
    })
    it('acepta forma de pago cuenta_corriente', () => {
      const r = turnoInputSchema.parse({ ...valido, gastos: [{ tipo: 'mercaderia', formaPago: 'cuenta_corriente', monto: 500 }] })
      expect(r.gastos[0].formaPago).toBe('cuenta_corriente')
    })
    it('acepta N° y total de factura (pago parcial)', () => {
      const r = turnoInputSchema.parse({
        ...valido,
        gastos: [{ tipo: 'mercaderia', formaPago: 'efectivo', monto: 50, facturaNumero: 'F-123', facturaTotal: 100 }],
      })
      expect(r.gastos[0]).toMatchObject({ facturaNumero: 'F-123', facturaTotal: 100 })
    })
    it('rechaza un total de factura negativo', () => {
      expect(() => turnoInputSchema.parse({ ...valido, gastos: [{ tipo: 'varios', formaPago: 'efectivo', monto: 1, facturaTotal: -1 }] })).toThrow()
    })
    it('acepta cualquier rubro de gasto no vacío (texto libre)', () => {
      const r = turnoInputSchema.parse({ ...valido, gastos: [{ tipo: 'Limpieza Campana', formaPago: 'efectivo', monto: 1 }] })
      expect(r.gastos[0].tipo).toBe('Limpieza Campana')
    })
    it('rechaza un rubro de gasto vacío', () => {
      expect(() => turnoInputSchema.parse({ ...valido, gastos: [{ tipo: '', formaPago: 'efectivo', monto: 1 }] })).toThrow()
    })
    it('rechaza una forma de pago inválida', () => {
      expect(() => turnoInputSchema.parse({ ...valido, gastos: [{ tipo: 'varios', formaPago: 'crypto', monto: 1 }] })).toThrow()
    })
    it('rechaza monto de gasto negativo', () => {
      expect(() => turnoInputSchema.parse({ ...valido, gastos: [{ tipo: 'varios', formaPago: 'efectivo', monto: -1 }] })).toThrow()
    })
  })
})
