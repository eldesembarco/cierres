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
  it('marca pct null cuando la app reporta 0', () => {
    const rows = buildControlRows([{ canal: 'rappi', monto: 1000 }], [{ plataformaNombre: 'Rappi', ventaTotal: 0 }])
    expect(rows.find((r) => r.plataforma === 'Rappi')!.pct).toBeNull()
  })
  it('ignora canales que no son de delivery', () => {
    const rows = buildControlRows([{ canal: 'efectivo', monto: 100 }], [])
    expect(rows).toHaveLength(0)
  })
})
