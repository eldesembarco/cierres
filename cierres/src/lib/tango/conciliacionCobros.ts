// Conciliación de COBROS: choca lo que Tango registró como cobrado (fuente de la
// verdad, vista vw_CobrosDiarios vía bridge) contra lo que cada encargado cargó en
// el cierre, por local y por canal, para un día. Sirve para cazar cargas
// incompletas o mal tipificadas (el problema recurrente de Boedo/Quilmes/Olivos).
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { CANAL_LABEL } from '@/lib/informes/report'
import type { Canal } from '@/lib/cierre/types'
import {
  fetchCobrosTango,
  agruparCobrosPorLocal,
  mediosDesconocidos,
  TangoBridgeError,
  type CobrosLocal,
} from '@/lib/tango/cobrosBridge'

const ORDEN_CANAL: Canal[] = [
  'efectivo', 'tarjetas', 'mercadopago', 'pedidosya', 'pedidosya_efectivo', 'rappi',
  'mercado_pedidos', 'pvs_qr', 'uber', 'delivery_propio', 'varios',
]

export interface CanalConciliado {
  canal: Canal
  label: string
  tango: number
  cargado: number
  diferencia: number // cargado - tango (>0 cargó de más, <0 le falta)
}

export interface LocalConciliado {
  localId: number
  local: string
  marca: string
  sinMapeo: boolean // el local no tiene tango_sucursal_id
  faltaCierre: boolean // no cargó nada
  sinCobrosTango: boolean // Tango no reportó cobros ese día
  canales: CanalConciliado[]
  totalTango: number
  totalCargado: number
  diferencia: number
  cuadra: boolean // |diferencia| < $1
}

export interface ConciliacionCobros {
  fecha: string
  locales: LocalConciliado[]
  totales: { tango: number; cargado: number; diferencia: number }
  localesConDiferencia: number
  mediosDesconocidos: string[]
  bridgeError: string | null
}

const UMBRAL = 1 // pesos: por debajo de esto lo tratamos como que cuadra

/** Conciliación de cobros para TODOS los locales propios en una fecha (YYYY-MM-DD). */
export async function conciliarCobrosDia(fecha: string): Promise<ConciliacionCobros> {
  const [locales, cierres] = await Promise.all([
    prisma.local.findMany({
      where: { activo: true },
      include: { marca: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    }),
    prisma.cierre.findMany({
      where: { fecha: new Date(`${fecha}T00:00:00.000Z`) },
      include: { ventas: true },
    }),
  ])

  // sucursalTango -> localId (solo locales mapeados)
  const localPorSucursal = new Map<number, number>()
  for (const l of locales) if (l.tangoSucursalId != null) localPorSucursal.set(l.tangoSucursalId, l.id)

  // Lo cargado por el encargado: suma de ventas por canal, por local (ambos turnos).
  const cargadoPorLocal = new Map<number, Map<Canal, number>>()
  for (const c of cierres) {
    const m = cargadoPorLocal.get(c.localId) ?? new Map<Canal, number>()
    for (const v of c.ventas) {
      const canal = v.canal as Canal
      m.set(canal, round2((m.get(canal) ?? 0) + Number(v.monto)))
    }
    cargadoPorLocal.set(c.localId, m)
  }

  // Cobros reales de Tango (puede fallar si el bridge está caído / cambió la URL).
  let cobrosPorLocal = new Map<number, CobrosLocal>()
  let bridgeError: string | null = null
  let medios: string[] = []
  try {
    const rows = await fetchCobrosTango(fecha, fecha)
    cobrosPorLocal = agruparCobrosPorLocal(rows, localPorSucursal)
    medios = mediosDesconocidos(rows)
  } catch (e) {
    bridgeError = e instanceof TangoBridgeError ? e.message : e instanceof Error ? e.message : String(e)
  }

  const localesOut: LocalConciliado[] = locales
    .filter((l) => l.tangoSucursalId != null || cargadoPorLocal.has(l.id)) // ocultar prueba sin datos
    .map((l) => {
      const tangoMap = cobrosPorLocal.get(l.id)?.porCanal ?? []
      const tangoByCanal = new Map<Canal, number>(tangoMap.map((x) => [x.canal, x.monto]))
      const cargadoByCanal = cargadoPorLocal.get(l.id) ?? new Map<Canal, number>()

      const canalesSet = new Set<Canal>([...tangoByCanal.keys(), ...cargadoByCanal.keys()])
      const canales: CanalConciliado[] = ORDEN_CANAL.filter((c) => canalesSet.has(c)).map((canal) => {
        const tango = tangoByCanal.get(canal) ?? 0
        const cargado = cargadoByCanal.get(canal) ?? 0
        return { canal, label: CANAL_LABEL[canal] ?? canal, tango, cargado, diferencia: round2(cargado - tango) }
      })

      const totalTango = round2(canales.reduce((s, c) => s + c.tango, 0))
      const totalCargado = round2(canales.reduce((s, c) => s + c.cargado, 0))
      const diferencia = round2(totalCargado - totalTango)
      return {
        localId: l.id,
        local: l.nombre,
        marca: l.marca.nombre,
        sinMapeo: l.tangoSucursalId == null,
        faltaCierre: !cargadoPorLocal.has(l.id),
        sinCobrosTango: !bridgeError && totalTango === 0 && l.tangoSucursalId != null,
        canales,
        totalTango,
        totalCargado,
        diferencia,
        cuadra: Math.abs(diferencia) < UMBRAL,
      }
    })
    // primero los que más difieren (los problemáticos arriba)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia) || a.local.localeCompare(b.local, 'es'))

  const totales = {
    tango: round2(localesOut.reduce((s, l) => s + l.totalTango, 0)),
    cargado: round2(localesOut.reduce((s, l) => s + l.totalCargado, 0)),
    diferencia: 0,
  }
  totales.diferencia = round2(totales.cargado - totales.tango)
  const localesConDiferencia = localesOut.filter((l) => !l.cuadra && !l.faltaCierre).length

  return { fecha, locales: localesOut, totales, localesConDiferencia, mediosDesconocidos: medios, bridgeError }
}
