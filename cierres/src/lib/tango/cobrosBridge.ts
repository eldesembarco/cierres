// Consumidor del bridge de Tango: trae los cobros REALES del día (vista
// vw_CobrosDiarios expuesta por scripts/tango-bridge.mjs vía Cloudflare Tunnel)
// y los normaliza a nuestros canales para conciliarlos contra lo cargado.
//
// La vista ya excluye CAJA FUERTE y SALDO INICIAL y sólo toma DEBE='D', así que
// cada fila es un cobro real: { fecha, id_sucursal, medio_pago, importe }.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import type { Canal } from '@/lib/cierre/types'

export interface CobroTangoRow {
  fecha: string
  id_sucursal: number
  medio_pago: string
  importe: number
}

// medio_pago de Tango → canal del sistema. Claves normalizadas (minúsculas, sin
// acentos). Todas las marcas de tarjeta y el posnet QR Nave caen en "tarjetas",
// igual que las cargan los encargados.
const MEDIO_A_CANAL: Record<string, Canal> = {
  'efectivo': 'efectivo',
  'm&go efectivo': 'efectivo',
  'peya efectivo': 'pedidosya_efectivo',
  'peya tarjeta': 'pedidosya',
  'rappi': 'rappi',
  'mercadopago': 'mercadopago',
  'qr nave': 'tarjetas', // posnet (cobro con tarjeta)
  'morfy tarjeta': 'tarjetas',
  'visa': 'tarjetas',
  'visa debito': 'tarjetas',
  'mastercard': 'tarjetas',
  'mastercard debito': 'tarjetas',
  'american express': 'tarjetas',
  'cabal': 'tarjetas',
  'naranja': 'tarjetas',
}

function norm(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Canal para un medio de pago de Tango; los desconocidos van a 'varios'. */
export function medioACanal(medio: string): Canal {
  return MEDIO_A_CANAL[norm(medio)] ?? 'varios'
}

/** Medios que no reconocemos (para avisar si Tango agrega uno nuevo). */
export function mediosDesconocidos(rows: CobroTangoRow[]): string[] {
  const set = new Set<string>()
  for (const r of rows) if (!(norm(r.medio_pago) in MEDIO_A_CANAL)) set.add(r.medio_pago)
  return [...set].sort()
}

export class TangoBridgeError extends Error {}

/**
 * URL viva del bridge: la que el propio bridge registró en la base al levantar su
 * túnel (POST /api/tango/bridge-url), con el env TANGO_BRIDGE_URL como fallback.
 * El quick-tunnel cambia de URL en cada arranque del server de Tango, por eso la
 * base manda sobre el env.
 */
export async function getBridgeBaseUrl(): Promise<string | null> {
  const row = await prisma.tangoBridge.findUnique({ where: { id: 1 } }).catch(() => null)
  return row?.url ?? process.env.TANGO_BRIDGE_URL ?? null
}

/**
 * Trae los cobros del bridge para el rango [desde, hasta] (YYYY-MM-DD, inclusive).
 * URL desde la base (auto-registro) o TANGO_BRIDGE_URL; secreto TANGO_BRIDGE_SECRET.
 */
export async function fetchCobrosTango(desde: string, hasta: string): Promise<CobroTangoRow[]> {
  const base = await getBridgeBaseUrl()
  const secret = process.env.TANGO_BRIDGE_SECRET
  if (!base || !secret) {
    throw new TangoBridgeError('No hay URL del bridge registrada ni TANGO_BRIDGE_URL/TANGO_BRIDGE_SECRET en el entorno.')
  }
  const url = `${base.replace(/\/$/, '')}/cobros?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 25_000)
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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new TangoBridgeError(`El bridge respondió ${res.status}. ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new TangoBridgeError('Respuesta inesperada del bridge (no es una lista).')
  return data as CobroTangoRow[]
}

export interface CobrosLocal {
  localId: number
  porCanal: { canal: Canal; monto: number }[]
  total: number
}

/**
 * Agrupa las filas de cobros por local (usando el mapa sucursalTango→localId) y,
 * dentro de cada local, por canal. Ignora sucursales que no mapean a un local
 * propio (el resto de la franquicia).
 */
export function agruparCobrosPorLocal(
  rows: CobroTangoRow[],
  localPorSucursal: Map<number, number>,
): Map<number, CobrosLocal> {
  const porLocal = new Map<number, Map<Canal, number>>()
  for (const r of rows) {
    const localId = localPorSucursal.get(r.id_sucursal)
    if (localId == null) continue // sucursal ajena a nuestros locales
    const canal = medioACanal(r.medio_pago)
    const m = porLocal.get(localId) ?? new Map<Canal, number>()
    m.set(canal, round2((m.get(canal) ?? 0) + Number(r.importe)))
    porLocal.set(localId, m)
  }
  const out = new Map<number, CobrosLocal>()
  for (const [localId, m] of porLocal) {
    const porCanal = [...m.entries()].map(([canal, monto]) => ({ canal, monto }))
    out.set(localId, { localId, porCanal, total: round2(porCanal.reduce((s, x) => s + x.monto, 0)) })
  }
  return out
}
