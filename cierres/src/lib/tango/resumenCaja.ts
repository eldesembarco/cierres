// Visor "Resumen de caja" (Tango Restó) para el panel: muestra las CUENTAS tal
// cual las reporta Tango (MERCADOPAGO DELIVERY, RAPPI, CODIGOPAGO, EFECTIVO...),
// por local, para un día — lo mismo que los locales mandan por foto desde el
// Adicionista, pero todos los locales en una sola pantalla. A diferencia de
// /conciliacion-cobros acá NO se normaliza a canales ni se concilia: es el espejo
// de lo que dice Tango. (La vista del bridge excluye CAJA FUERTE y SALDO INICIAL.)
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { fetchCobrosTango, type CobroTangoRow } from '@/lib/tango/cobrosBridge'

export interface CuentaCaja {
  cuenta: string // descripción cruda del medio en Tango
  importe: number
}

export interface CajaLocal {
  localId: number
  nombre: string
  marca: string
  cuentas: CuentaCaja[] // orden importe desc
  total: number
}

export interface ResumenCaja {
  fecha: string
  locales: CajaLocal[] // solo los que tienen cobros ese día, orden total desc
  sinCobros: { localId: number; nombre: string }[] // propios mapeados sin cobros ese día
  totalGeneral: number
  // Cuándo se consultó el bridge (ISO). Se muestra en la página: con entrada
  // stale el Data Cache puede servir un snapshot viejo, y así se nota.
  obtenidoEn: string
}

export interface LocalParaCaja {
  id: number
  nombre: string
  marca: string
  tangoSucursalId: number | null
}

// Pura (testeable): agrupa las filas del bridge por local y por cuenta.
export function armarResumenCaja(
  fecha: string,
  rows: CobroTangoRow[],
  locales: LocalParaCaja[],
  obtenidoEn = '',
): ResumenCaja {
  const localPorSucursal = new Map<number, LocalParaCaja>()
  for (const l of locales) if (l.tangoSucursalId != null) localPorSucursal.set(l.tangoSucursalId, l)

  const acc = new Map<number, Map<string, number>>() // localId → cuenta → importe
  for (const r of rows) {
    const local = localPorSucursal.get(r.id_sucursal)
    if (!local) continue // sucursal ajena (franquicias)
    const importe = Number(r.importe)
    if (!Number.isFinite(importe)) continue // fila rota del bridge: NaN serializa como null en el cache
    const cuenta = r.medio_pago.trim().toUpperCase()
    const m = acc.get(local.id) ?? new Map<string, number>()
    m.set(cuenta, round2((m.get(cuenta) ?? 0) + importe))
    acc.set(local.id, m)
  }

  const conCobros: CajaLocal[] = []
  const sinCobros: { localId: number; nombre: string }[] = []
  for (const l of locales) {
    if (l.tangoSucursalId == null) continue
    const m = acc.get(l.id)
    if (!m || m.size === 0) {
      sinCobros.push({ localId: l.id, nombre: l.nombre })
      continue
    }
    const cuentas = [...m.entries()]
      .map(([cuenta, importe]) => ({ cuenta, importe }))
      .sort((a, b) => b.importe - a.importe)
    conCobros.push({
      localId: l.id,
      nombre: l.nombre,
      marca: l.marca,
      cuentas,
      total: round2(cuentas.reduce((s, c) => s + c.importe, 0)),
    })
  }
  conCobros.sort((a, b) => b.total - a.total)

  return {
    fecha,
    locales: conCobros,
    sinCobros,
    totalGeneral: round2(conCobros.reduce((s, l) => s + l.total, 0)),
    obtenidoEn,
  }
}

/**
 * Resumen de caja de TODOS los locales propios para una fecha (YYYY-MM-DD).
 * Tira TangoBridgeError si el bridge está caído (la página lo muestra; el Data
 * Cache no guarda errores porque el throw aborta el cacheo).
 */
export async function resumenCajaDia(fecha: string): Promise<ResumenCaja> {
  const [locales, rows] = await Promise.all([
    // Sin filtro de activo: para fechas históricas un local hoy cerrado tiene
    // que seguir apareciendo (si no, el total del día deja de espejar a Tango).
    prisma.local.findMany({
      where: { tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, tangoSucursalId: true, marca: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    }),
    fetchCobrosTango(fecha, fecha),
  ])
  return armarResumenCaja(
    fecha,
    rows,
    locales.map((l) => ({ id: l.id, nombre: l.nombre, marca: l.marca.nombre, tangoSucursalId: l.tangoSucursalId })),
    new Date().toISOString(),
  )
}
