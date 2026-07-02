import type { ParsedRow } from '@/lib/ingest/parsePedidosYa'
import { round2 } from '@/lib/money'

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
  // Agregamos por local ANTES de persistir: si varias filas del reporte resuelven al
  // mismo local (dos restaurantIds mapeados al mismo local, o el mismo repetido), hay
  // que SUMARLAS. El upsert por (local, plataforma, fecha) SETEA (no suma), así que sin
  // agregar acá la última fila pisaría a las anteriores y se perdería venta.
  const agg = new Map<number, PlannedVentaApp>()
  const sinMapear: PlannedSinMapear[] = []
  let filasMapeadas = 0

  for (const r of rows) {
    const localId = byId.get(r.restaurantId)
    if (localId !== undefined) {
      filasMapeadas++
      const cur = agg.get(localId)
      if (cur) {
        cur.pedidosEfectivo += r.ordersCash
        cur.pedidosOnline += r.ordersOnline
        cur.ventaEfectivo = round2(cur.ventaEfectivo + r.cashSales)
        cur.ventaOnline = round2(cur.ventaOnline + r.onlineSales)
      } else {
        agg.set(localId, {
          localId,
          plataformaId,
          pedidosEfectivo: r.ordersCash,
          pedidosOnline: r.ordersOnline,
          ventaEfectivo: round2(r.cashSales),
          ventaOnline: round2(r.onlineSales),
        })
      }
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
    ventasApp: [...agg.values()],
    sinMapear,
    filasTotal: rows.length,
    filasMapeadas,
    filasSinMapear: sinMapear.length,
  }
}
