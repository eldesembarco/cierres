import { describe, it, expect } from 'vitest'
import { buildControlRows } from '@/lib/control/buildControlRows'

describe('buildControlRows', () => {
  it('compara declarado vs app por plataforma de delivery', () => {
    const rows = buildControlRows(
      [{ canal: 'pedidosya', monto: 347250 }, { canal: 'efectivo', monto: 46200 }],
      [{ plataformaNombre: 'PedidosYa', ventaTotal: 350000 }],
    )
    const py = rows.find((r) => r.plataforma === 'PedidosYa')!
    expect(py.declarado).toBe(347250)
    expect(py.app).toBe(350000)
    expect(py.diferencia).toBe(-2750)
  })
  it('PedidosYa en efectivo suma al declarado de PedidosYa', () => {
    const rows = buildControlRows(
      [{ canal: 'pedidosya', monto: 300000 }, { canal: 'pedidosya_efectivo', monto: 50000 }],
      [{ plataformaNombre: 'PedidosYa', ventaTotal: 350000 }],
    )
    const py = rows.find((r) => r.plataforma === 'PedidosYa')!
    expect(py.declarado).toBe(350000) // 300000 + 50000
    expect(py.diferencia).toBe(0)
  })
  it('marca pct null cuando la app reporta 0', () => {
    const rows = buildControlRows([{ canal: 'rappi', monto: 1000 }], [{ plataformaNombre: 'Rappi', ventaTotal: 0 }])
    expect(rows.find((r) => r.plataforma === 'Rappi')!.pct).toBeNull()
  })
  it('Mercado Delivery: declarado (canal mercado_pedidos) vs plata real de MP', () => {
    const rows = buildControlRows(
      [{ canal: 'mercado_pedidos', monto: 120000 }],
      [{ plataformaNombre: 'Mercado Delivery', ventaTotal: 117000 }],
    )
    const md = rows.find((r) => r.plataforma === 'Mercado Delivery')!
    expect(md.declarado).toBe(120000)
    expect(md.app).toBe(117000)
    expect(md.diferencia).toBe(3000) // faltante: 3 pedidos no cobrados / devueltos
  })
  it('comisión y neto: neto = cobrado − comisión', () => {
    const rows = buildControlRows(
      [{ canal: 'mercado_pedidos', monto: 100000 }],
      [{ plataformaNombre: 'Mercado Delivery', ventaTotal: 100000, comision: 2800 }],
    )
    const md = rows.find((r) => r.plataforma === 'Mercado Delivery')!
    expect(md.comision).toBe(2800)
    expect(md.neto).toBe(97200) // 100000 - 2800
    expect(md.diferencia).toBe(0) // el cruce es contra el bruto, la comisión no descuadra
  })
  it('ignora canales que no son de delivery', () => {
    const rows = buildControlRows([{ canal: 'efectivo', monto: 100 }], [])
    expect(rows).toHaveLength(0)
  })
})
