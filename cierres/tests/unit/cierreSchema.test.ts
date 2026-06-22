import { describe, it, expect } from 'vitest'
import { cierreInputSchema } from '@/lib/cierre/schema'

const valido = {
  fondoFijo: 500000, gastosTotal: 0, notaCredito: 0, cantidadTickets: 10,
  turnos: [{ turno: 'T1', montoZ: 100 }],
  ventas: [{ canal: 'efectivo', monto: 100 }],
}

describe('cierreInputSchema', () => {
  it('acepta una carga válida', () => {
    expect(cierreInputSchema.parse(valido).ventas[0].canal).toBe('efectivo')
  })
  it('rechaza montos negativos', () => {
    expect(() => cierreInputSchema.parse({ ...valido, gastosTotal: -1 })).toThrow()
  })
  it('rechaza un canal inválido', () => {
    expect(() => cierreInputSchema.parse({ ...valido, ventas: [{ canal: 'cripto', monto: 1 }] })).toThrow()
  })
  it('rechaza turnos duplicados', () => {
    expect(() => cierreInputSchema.parse({ ...valido, turnos: [{ turno: 'T1', montoZ: 1 }, { turno: 'T1', montoZ: 2 }] })).toThrow()
  })
})
