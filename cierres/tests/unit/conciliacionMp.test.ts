import { describe, it, expect } from 'vitest'
import { conciliarMp, canalDeVenta, type OperacionMp, type LineaEncargado } from '@/lib/mp/conciliacionMp'

const md = (monto: number): OperacionMp => ({ canal: 'mercado_pedidos', monto })
const qr = (monto: number): OperacionMp => ({ canal: 'mercadopago', monto })
const eMd = (monto: number): LineaEncargado => ({ canal: 'mercado_pedidos', monto })
const eQr = (monto: number): LineaEncargado => ({ canal: 'mercadopago', monto })

describe('conciliarMp', () => {
  it('cuadra cuando cada operación de MP tiene su línea del encargado', () => {
    const r = conciliarMp([md(100), md(200)], [eMd(200), eMd(100)])
    expect(r.cuadraTodo).toBe(true)
    const c = r.porCanal[0]
    expect(c.soloMp).toEqual([])
    expect(c.soloEncargado).toEqual([])
    expect(c.totalMp).toBe(300)
    expect(c.totalEncargado).toBe(300)
    expect(c.diferencia).toBe(0)
  })

  it('marca lo que MP cobró y el encargado NO cargó', () => {
    const r = conciliarMp([md(100), md(200)], [eMd(100)])
    const c = r.porCanal[0]
    expect(c.cuadra).toBe(false)
    expect(c.soloMp).toEqual([{ monto: 200, cantidad: 1 }])
    expect(c.soloEncargado).toEqual([])
    expect(c.diferencia).toBe(-200) // cargó de menos
  })

  it('marca lo que el encargado cargó y MP no tiene', () => {
    const r = conciliarMp([md(100)], [eMd(100), eMd(50)])
    const c = r.porCanal[0]
    expect(c.soloEncargado).toEqual([{ monto: 50, cantidad: 1 }])
    expect(c.soloMp).toEqual([])
    expect(c.diferencia).toBe(50) // cargó de más
  })

  it('maneja montos repetidos como multiset', () => {
    const r = conciliarMp([md(100), md(100)], [eMd(100)])
    const c = r.porCanal[0]
    expect(c.coincidencias).toEqual([{ monto: 100, cantidad: 1 }])
    expect(c.soloMp).toEqual([{ monto: 100, cantidad: 1 }])
  })

  it('separa por canal (QR vs Delivery)', () => {
    const r = conciliarMp([md(100), qr(50)], [eQr(50)])
    const delivery = r.porCanal.find((c) => c.canal === 'mercado_pedidos')!
    const mostrador = r.porCanal.find((c) => c.canal === 'mercadopago')!
    expect(delivery.soloMp).toEqual([{ monto: 100, cantidad: 1 }])
    expect(mostrador.cuadra).toBe(true)
    expect(r.cuadraTodo).toBe(false)
  })

  it('tolera diferencias de centavos (round2)', () => {
    const r = conciliarMp([md(100.001)], [eMd(100)])
    expect(r.porCanal[0].cuadra).toBe(true)
  })

  it('mapea CANAL DE VENTA a canal interno', () => {
    expect(canalDeVenta('Delivery')).toBe('mercado_pedidos')
    expect(canalDeVenta('MERCADO DELIVERY')).toBe('mercado_pedidos')
    expect(canalDeVenta('QR')).toBe('mercadopago')
    expect(canalDeVenta('Presencial')).toBe('mercadopago')
    expect(canalDeVenta('Link de pago')).toBe('mercadopago')
  })
})
