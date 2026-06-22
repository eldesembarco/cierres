import { describe, it, expect } from 'vitest'
import { parseMoney, round2, sumMoney } from '@/lib/money'

describe('parseMoney', () => {
  it('parsea formato en-US con coma de miles y punto decimal', () => {
    expect(parseMoney('102,883.50')).toBe(102883.5)
  })
  it('parsea cero', () => {
    expect(parseMoney('0.00')).toBe(0)
  })
  it('acepta números directamente', () => {
    expect(parseMoney(1726362.6)).toBe(1726362.6)
  })
  it('tira error con texto inválido', () => {
    expect(() => parseMoney('N/A')).toThrow()
  })
})

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('sumMoney', () => {
  it('suma y redondea', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6)
  })
})
