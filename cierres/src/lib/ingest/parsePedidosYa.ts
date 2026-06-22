import Papa from 'papaparse'
import { parseMoney } from '@/lib/money'

export interface ParsedRow {
  plataformaCodigo: 'PY'
  restaurantId: string
  storeName: string
  deliveryPlatform: string
  ordersCash: number
  ordersOnline: number
  cashSales: number
  onlineSales: number
}

export function parsePedidosYa(csv: string): ParsedRow[] {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const rows: ParsedRow[] = []
  for (const r of data) {
    const platform = (r['Delivery platform'] ?? '').trim()
    const restaurantId = (r['Restaurant ID'] ?? '').trim()
    // Descarta la fila de totales y filas sin ID.
    if (platform === 'Total' || restaurantId === '') continue
    rows.push({
      plataformaCodigo: 'PY',
      restaurantId,
      storeName: (r['Store name'] ?? '').trim(),
      deliveryPlatform: platform,
      ordersCash: Number(r['Orders paid with cash'] ?? 0),
      ordersOnline: Number(r['Orders paid online'] ?? 0),
      cashSales: parseMoney(r['Cash sales'] ?? '0'),
      onlineSales: parseMoney(r['Online sales'] ?? '0'),
    })
  }
  return rows
}
