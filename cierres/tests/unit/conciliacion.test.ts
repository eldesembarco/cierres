import { describe, it, expect } from 'vitest'
import { conciliarLinea, conciliarCupones } from '@/lib/cierre/conciliacion'

describe('conciliarLinea', () => {
  it('cuadra exacto → ok, diferencia 0', () => {
    const r = conciliarLinea([17500, 19900], 37400)
    expect(r.sumaCupones).toBe(37400)
    expect(r.diferencia).toBe(0)
    expect(r.estado).toBe('ok')
  })
  it('descuadra → estado descuadre', () => {
    const r = conciliarLinea([100, 100], 250)
    expect(r.diferencia).toBe(-50)
    expect(r.estado).toBe('descuadre')
  })
  it('tolera $1 de redondeo', () => {
    expect(conciliarLinea([100.5, 100], 200.5).estado).toBe('ok')
  })
})

describe('conciliarCupones', () => {
  it('agrupa por canal y solo devuelve canales con detalle', () => {
    const res = conciliarCupones(
      [{ canal: 'mercadopago', referencia: 'a', importe: 100 }, { canal: 'mercadopago', referencia: 'b', importe: 100 }, { canal: 'rappi', referencia: 'c', importe: 50 }],
      [{ canal: 'mercadopago', monto: 200 }, { canal: 'rappi', monto: 80 }, { canal: 'efectivo', monto: 999 }],
    )
    expect(res).toHaveLength(2)
    const mp = res.find((r) => r.canal === 'mercadopago')!
    expect(mp.estado).toBe('ok')
    const rappi = res.find((r) => r.canal === 'rappi')!
    expect(rappi.diferencia).toBe(-30)
    expect(rappi.estado).toBe('descuadre')
  })
})
