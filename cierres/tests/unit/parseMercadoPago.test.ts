import { describe, it, expect } from 'vitest'
import { aggregateMp, type MpRawRow } from '@/lib/ingest/parseMercadoPago'

const rows: MpRawRow[] = [
  { fecha: '2026-05-28', estado: 'approved', storeId: '72488709', storeName: 'San Telmo', bruto: 15000, neto: 14910, devuelto: 0 },
  { fecha: '2026-05-28', estado: 'approved', storeId: '72488709', storeName: 'San Telmo', bruto: 10000, neto: 9940, devuelto: 0 },
  { fecha: '2026-05-28', estado: 'refunded', storeId: '72488709', storeName: 'San Telmo', bruto: 5000, neto: 4970, devuelto: 5000 },
  { fecha: '2026-05-28', estado: 'approved', storeId: '77378254', storeName: 'Microcentro', bruto: 8000, neto: 7950, devuelto: 0 },
  { fecha: '2026-05-29', estado: 'approved', storeId: '72488709', storeName: 'San Telmo', bruto: 3000, neto: 2980, devuelto: 0 },
]

describe('aggregateMp', () => {
  const out = aggregateMp(rows)
  const get = (storeId: string, fecha: string) => out.find((g) => g.storeId === storeId && g.fecha === fecha)!

  it('agrupa por (store_id, fecha)', () => {
    expect(out).toHaveLength(3)
  })
  it('aprobadas: suma bruto, neto, pedidos y calcula comisión', () => {
    const st = get('72488709', '2026-05-28')
    expect(st.brutoCobrado).toBe(25000)
    expect(st.netoLiquidado).toBe(24850)
    expect(st.comision).toBe(150) // 25000 - 24850
    expect(st.pedidos).toBe(2)
  })
  it('las devoluciones NO suman ingreso, se cuentan aparte', () => {
    const st = get('72488709', '2026-05-28')
    expect(st.devoluciones).toBe(1)
    expect(st.devueltoMonto).toBe(5000)
    // la operación refunded (bruto 5000) NO entra a brutoCobrado
    expect(st.brutoCobrado).toBe(25000)
  })
  it('separa por fecha de venta', () => {
    expect(get('72488709', '2026-05-29').brutoCobrado).toBe(3000)
  })
  it('ordena por bruto cobrado descendente', () => {
    expect(out.map((g) => g.brutoCobrado)).toEqual([25000, 8000, 3000])
  })
})
