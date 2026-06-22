import type { ParsedRow } from '@/lib/ingest/parsePedidosYa'

export interface Mapping { plataformaId: number; restaurantId: string; localId: number }

export interface PlannedVentaApp {
  localId: number
  plataformaId: number
  pedidosEfectivo: number
  pedidosOnline: number
  ventaEfectivo: number
  ventaOnline: number
}

export interface PlannedSinMapear {
  plataformaId: number
  restaurantId: string
  nombreExterno: string
  ventaEfectivo: number
  ventaOnline: number
}

export interface IngestPlan {
  ventasApp: PlannedVentaApp[]
  sinMapear: PlannedSinMapear[]
  filasTotal: number
  filasMapeadas: number
  filasSinMapear: number
}

export function planIngest(rows: ParsedRow[], mappings: Mapping[], plataformaId: number): IngestPlan {
  const byId = new Map(mappings.filter((m) => m.plataformaId === plataformaId).map((m) => [m.restaurantId, m.localId]))
  const ventasApp: PlannedVentaApp[] = []
  const sinMapear: PlannedSinMapear[] = []

  for (const r of rows) {
    const localId = byId.get(r.restaurantId)
    if (localId !== undefined) {
      ventasApp.push({
        localId,
        plataformaId,
        pedidosEfectivo: r.ordersCash,
        pedidosOnline: r.ordersOnline,
        ventaEfectivo: r.cashSales,
        ventaOnline: r.onlineSales,
      })
    } else {
      sinMapear.push({
        plataformaId,
        restaurantId: r.restaurantId,
        nombreExterno: r.storeName,
        ventaEfectivo: r.cashSales,
        ventaOnline: r.onlineSales,
      })
    }
  }

  return {
    ventasApp,
    sinMapear,
    filasTotal: rows.length,
    filasMapeadas: ventasApp.length,
    filasSinMapear: sinMapear.length,
  }
}
