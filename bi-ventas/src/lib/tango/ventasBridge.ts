// Consumidor de VENTAS del bridge de Tango para el BI (/ventas): venta facturada
// por hora y por artículo (vistas sobre comprobantes de venta, netas de NC).
// OJO: esto NO es /cobros — los cobros de caja son un universo más chico que la
// venta facturada y no sirven como fuente del BI (ver docs/2026-07-04-bi-ventas-design.md).
import { prisma } from '@/lib/db'

export class TangoBridgeError extends Error {}

/**
 * URL viva del bridge: la que el bridge registró en la base al levantar su túnel
 * (tabla tango_bridge, la escribe la app cierres), con env TANGO_BRIDGE_URL como
 * fallback. El quick-tunnel cambia de URL en cada arranque del server de Tango.
 */
async function getBridgeBaseUrl(): Promise<string | null> {
  const row = await prisma.tangoBridge.findUnique({ where: { id: 1 } }).catch(() => null)
  return row?.url ?? process.env.TANGO_BRIDGE_URL ?? null
}

export interface VentaHoraRow {
  fecha: string
  id_sucursal: number
  hora: number
  importe: number
  tickets: number
}

export interface VentaArticuloRow {
  fecha: string
  id_sucursal: number
  cod_articulo: string
  descripcion: string
  rubro?: string | null
  cantidad: number
  importe: number
}

export interface ConsumoInsumoRow {
  fecha: string
  id_sucursal: number
  cod_articulo: string
  descripcion: string
  rubro?: string | null
  unidad?: string | null
  cantidad: number
}

export interface ComandaAnuladaRow {
  fecha: string
  id_sucursal: number
  fecha_hora: string // "YYYY-MM-DD HH:mm:ss"
  importe: number
  tipo_pedido?: string | null // 'R' salón / 'D' delivery
  cubiertos: number
}

async function fetchBridge<T>(path: string, desde: string, hasta: string): Promise<T[]> {
  const base = await getBridgeBaseUrl()
  const secret = process.env.TANGO_BRIDGE_SECRET
  if (!base || !secret) {
    throw new TangoBridgeError('No hay URL del bridge registrada ni TANGO_BRIDGE_URL/TANGO_BRIDGE_SECRET en el entorno.')
  }
  const url = `${base.replace(/\/$/, '')}${path}?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`

  // 55s: el camino Vercel -> quick-tunnel puede tardar >20s en frío; el route
  // tiene maxDuration 60, así que abortamos justo antes de ese límite.
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 55_000)
  let res: Response
  try {
    res = await fetch(url, { headers: { 'x-bridge-secret': secret }, signal: ctrl.signal, cache: 'no-store' })
  } catch (e) {
    throw new TangoBridgeError(
      `No pude conectar al bridge de Tango (${e instanceof Error ? e.message : String(e)}). ` +
        'Puede estar caído o cambió la URL del túnel.',
    )
  } finally {
    clearTimeout(timeout)
  }
  if (res.status === 404) {
    throw new TangoBridgeError(`El bridge no expone ${path} (404). ¿Versión vieja del tango-bridge.mjs en el server?`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new TangoBridgeError(`El bridge respondió ${res.status} en ${path}. ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new TangoBridgeError(`Respuesta inesperada del bridge en ${path} (no es una lista).`)
  return data as T[]
}

/** Venta por hora del rango [desde, hasta] (YYYY-MM-DD, inclusive), todas las sucursales. */
export function fetchVentasHoras(desde: string, hasta: string): Promise<VentaHoraRow[]> {
  return fetchBridge<VentaHoraRow>('/ventas-horas', desde, hasta)
}

/** Venta por artículo del rango [desde, hasta] (YYYY-MM-DD, inclusive), todas las sucursales. */
export function fetchVentasArticulos(desde: string, hasta: string): Promise<VentaArticuloRow[]> {
  return fetchBridge<VentaArticuloRow>('/ventas-articulos', desde, hasta)
}

/** Consumo de insumos por local del rango [desde, hasta] (vw_ConsumoInsumos). */
export function fetchConsumoInsumos(desde: string, hasta: string): Promise<ConsumoInsumoRow[]> {
  return fetchBridge<ConsumoInsumoRow>('/consumo-insumos', desde, hasta)
}

/** Comandas anuladas (ESTADO='X') del rango [desde, hasta] (vw_ComandasAnuladas). */
export function fetchComandasAnuladas(desde: string, hasta: string): Promise<ComandaAnuladaRow[]> {
  return fetchBridge<ComandaAnuladaRow>('/comandas-anuladas', desde, hasta)
}
