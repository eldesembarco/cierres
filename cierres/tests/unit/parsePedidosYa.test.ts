import { describe, it, expect } from 'vitest'
import { parsePedidosYa } from '@/lib/ingest/parsePedidosYa'

const csv = `Delivery platform,Store name,Restaurant ID,Orders paid with cash,Orders paid online,Cash sales,Online sales
PY_AR,El Desembarco San Telmo,517621,1,21,"55,095.50","684,534.50"
PY_AR,El Desembarco - Pilar,393033,0,0,0.00,0.00
Total,,,357,2046,"8,205,335.60","52,378,541.50"`

describe('parsePedidosYa', () => {
  it('parsea las filas de tiendas y descarta la fila Total', () => {
    const rows = parsePedidosYa(csv)
    expect(rows).toHaveLength(2)
  })
  it('normaliza montos y tipos', () => {
    const row = parsePedidosYa(csv).find((r) => r.restaurantId === '517621')!
    expect(row.cashSales).toBe(55095.5)
    expect(row.onlineSales).toBe(684534.5)
    expect(row.ordersOnline).toBe(21)
    expect(row.plataformaCodigo).toBe('PY')
  })
  it('conserva tiendas en 0 (para distinguir 0 vendido de no reportado)', () => {
    const row = parsePedidosYa(csv).find((r) => r.restaurantId === '393033')!
    expect(row.cashSales).toBe(0)
  })
})
