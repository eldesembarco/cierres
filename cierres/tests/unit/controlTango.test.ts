import { describe, it, expect } from 'vitest'
import { estadoTango } from '@/lib/dashboard/controlTango'

// Casos reales del 02-06/07 usados para calibrar los umbrales.
describe('estadoTango (declarado vs facturación real)', () => {
  it('cuadra exacto (Microcentro 02/07: dif 0)', () => {
    expect(estadoTango(0, 1_610_516)).toBe('cuadra')
  })
  it('cuadra con redondeos chicos (Recoleta 02/07: -790 sobre 2,39M)', () => {
    expect(estadoTango(-790, 2_390_107)).toBe('cuadra')
  })
  it('el piso de $1.000 aplica en locales chicos', () => {
    expect(estadoTango(-900, 100_000)).toBe('cuadra') // 0,9% pero < $1.000
    expect(estadoTango(-1_001, 100_000)).toBe('leve') // pasa el piso
  })
  it('leve entre 0,5% y 5% (Ramos 02/07: -34.000 sobre 1,34M = 2,5%)', () => {
    expect(estadoTango(-34_000, 1_339_271)).toBe('leve')
  })
  it('grave por encima de 5% (Mrt Belgrano 02/07: -374.000 sobre 1,19M = 31%)', () => {
    expect(estadoTango(-374_000, 1_190_040)).toBe('grave')
  })
  it('grave también cuando declaró de MÁS (Quilmes 02/07: +80.200 = 17,7%)', () => {
    expect(estadoTango(80_200, 452_188)).toBe('grave')
  })
})
