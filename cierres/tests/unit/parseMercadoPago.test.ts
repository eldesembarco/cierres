import { describe, it, expect } from 'vitest'
import { aggregateMp, readMpCsv, type MpRawRow } from '@/lib/ingest/parseMercadoPago'

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

describe('readMpCsv', () => {
  const HEAD = 'Fecha de compra (date_created),Estado de la operación (status),Detalle del estado (status_detail),Valor del producto (transaction_amount),Monto recibido (net_received_amount),Monto devuelto (amount_refunded),Número de local (store_id),Nombre del local (description)'

  it('lee un CSV (en-US, coma decimal) con las mismas columnas que el xlsx', () => {
    const csv = [
      HEAD,
      '28/05/2026 22:11:02,approved,accredited,15000.00,14910.00,0.00,72488709,San Telmo',
      '28/05/2026 21:50:00,approved,accredited,10000.00,9940.00,0.00,72488709,San Telmo',
      '28/05/2026 21:00:00,refunded,bpp_covered,5000.00,4970.00,5000.00,72488709,San Telmo',
    ].join('\n')
    const rows = readMpCsv(csv)
    expect(rows).toHaveLength(3)
    const t = aggregateMp(rows)[0]
    expect(t.storeId).toBe('72488709')
    expect(t.brutoCobrado).toBe(25000)
    expect(t.netoLiquidado).toBe(24850)
    expect(t.comision).toBe(150)
    expect(t.pedidos).toBe(2)
    expect(t.devoluciones).toBe(1)
  })

  it('lee un CSV es-AR (delimitador ; y coma decimal con miles)', () => {
    const csv = [
      HEAD.replace(/,/g, ';'),
      '28/05/2026;approved;accredited;15.000,00;14.910,00;0,00;72488709;San Telmo',
    ].join('\n')
    const rows = readMpCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].bruto).toBe(15000)
    expect(rows[0].neto).toBe(14910)
    expect(rows[0].storeId).toBe('72488709')
  })

  it('no confunde "Estado" con "Detalle del estado (status_detail)"', () => {
    const csv = [HEAD, '28/05/2026,approved,accredited,100,99,0,1,X'].join('\n')
    expect(readMpCsv(csv)[0].estado).toBe('approved')
  })

  it('tira error si faltan columnas clave', () => {
    expect(() => readMpCsv('col1,col2\na,b')).toThrow()
  })
})
