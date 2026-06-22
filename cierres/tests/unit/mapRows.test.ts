import { describe, it, expect } from 'vitest'
import { planIngest } from '@/lib/ingest/mapRows'
import type { ParsedRow } from '@/lib/ingest/parsePedidosYa'

const rows: ParsedRow[] = [
  { plataformaCodigo: 'PY', restaurantId: '517621', storeName: 'San Telmo', deliveryPlatform: 'PY_AR', ordersCash: 1, ordersOnline: 21, cashSales: 55095.5, onlineSales: 684534.5 },
  { plataformaCodigo: 'PY', restaurantId: '999999', storeName: 'Ajena', deliveryPlatform: 'PY_AR', ordersCash: 0, ordersOnline: 5, cashSales: 0, onlineSales: 1000 },
]
const mappings = [{ plataformaId: 1, restaurantId: '517621', localId: 7 }]

describe('planIngest', () => {
  it('mapea filas conocidas a ventas_app', () => {
    const plan = planIngest(rows, mappings, 1)
    expect(plan.ventasApp).toHaveLength(1)
    expect(plan.ventasApp[0]).toMatchObject({ localId: 7, plataformaId: 1, ventaOnline: 684534.5, ventaEfectivo: 55095.5 })
  })
  it('manda las no mapeadas a sinMapear', () => {
    const plan = planIngest(rows, mappings, 1)
    expect(plan.sinMapear).toHaveLength(1)
    expect(plan.sinMapear[0].restaurantId).toBe('999999')
  })
  it('reporta los conteos', () => {
    const plan = planIngest(rows, mappings, 1)
    expect(plan).toMatchObject({ filasTotal: 2, filasMapeadas: 1, filasSinMapear: 1 })
  })
})
