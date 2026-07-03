import { prisma } from '@/lib/db'
import { calcularTotales, sumarDia } from '@/lib/cierre/calculations'
import { buildControlRows } from '@/lib/control/buildControlRows'
import { round2 } from '@/lib/money'
import type { Canal, FormaPago, TipoTarjeta, Turno, TurnoInput } from '@/lib/cierre/types'

export interface LocalDashRow {
  localId: number
  localNombre: string
  marca: string
  ventaTotal: number
  ventaEfectivo: number
  diferenciaCaja: number
  totalDepositado: number
  montoZ: number
  gastos: number
  comision: number
  deliveryNeto: number
  deliveryCobrado: number
  tickets: number
  faltaCierre: boolean
  faltaImportacion: boolean
  manana: string | null // estado del turno o null si no existe
  tarde: string | null
}

export interface DeliveryPlat {
  plataforma: string
  declarado: number
  app: number
  comision: number
  neto: number
  diferencia: number
}

export interface TableroGlobal {
  porLocal: LocalDashRow[]
  grupo: {
    ventaTotal: number
    ventaEfectivo: number
    diferenciaCaja: number
    totalDepositado: number
    efectivoADepositar: number
    gastos: number
    comision: number
    deliveryNeto: number
    tickets: number
    neto: number
    localesCargados: number
    localesTotal: number
    turnosBorrador: number
  }
  ventaPorCanal: { canal: Canal; monto: number }[]
  delivery: DeliveryPlat[]
}

const ORDEN_TURNO: Turno[] = ['manana', 'tarde']

// Agregación de TODOS los locales para una fecha en 2 findMany (evita el N+1 de
// llamar getTablero por local). Reconstruye el TurnoInput como getTablero pero en
// lote, agrupando por localId en JS.
export async function getTableroGlobalBatch(fecha: Date): Promise<TableroGlobal> {
  const [locales, cierres, ventasApp] = await Promise.all([
    prisma.local.findMany({
      where: { activo: true },
      include: { marca: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    }),
    prisma.cierre.findMany({
      where: { fecha },
      include: { ventas: true, tarjetas: true, detalles: true, gastos: true },
    }),
    prisma.ventaApp.findMany({ where: { fecha }, include: { plataforma: { select: { nombre: true } } } }),
  ])

  const cierresPorLocal = new Map<number, typeof cierres>()
  for (const c of cierres) {
    const arr = cierresPorLocal.get(c.localId) ?? []
    arr.push(c)
    cierresPorLocal.set(c.localId, arr)
  }
  const ventasAppPorLocal = new Map<number, typeof ventasApp>()
  for (const v of ventasApp) {
    const arr = ventasAppPorLocal.get(v.localId) ?? []
    arr.push(v)
    ventasAppPorLocal.set(v.localId, arr)
  }

  const canalGlobal = new Map<Canal, number>()
  const deliveryGlobal = new Map<string, { declarado: number; app: number; comision: number }>()
  let turnosBorrador = 0

  const porLocal: LocalDashRow[] = locales.map((local) => {
    const cs = cierresPorLocal.get(local.id) ?? []
    const vapp = ventasAppPorLocal.get(local.id) ?? []
    const canalMap = new Map<Canal, number>()
    let tickets = 0
    let montoZ = 0
    let mananaEstado: string | null = null
    let tardeEstado: string | null = null

    const totalesArr = cs.map((c) => {
      const input: TurnoInput = {
        fondoFijo: Number(c.fondoFijo),
        montoZ: Number(c.montoZ),
        efectivoDepositado: Number(c.efectivoDepositado),
        notaCredito: Number(c.notaCredito),
        cantidadTickets: c.cantidadTickets,
        ventas: c.ventas.map((v) => ({ canal: v.canal as Canal, monto: Number(v.monto) })),
        tarjetas: c.tarjetas.map((t) => ({ tipo: t.tipo as TipoTarjeta, monto: Number(t.monto), lote: t.lote })),
        detalles: c.detalles.map((d) => ({ canal: d.canal as Canal, referencia: d.referencia, importe: Number(d.importe) })),
        gastos: c.gastos.map((g) => ({ tipo: g.tipo, formaPago: g.formaPago as FormaPago, monto: Number(g.monto) })),
      }
      tickets += c.cantidadTickets ?? 0
      montoZ += Number(c.montoZ)
      if (c.turno === 'manana') mananaEstado = c.estado
      if (c.turno === 'tarde') tardeEstado = c.estado
      if (c.estado === 'borrador') turnosBorrador += 1
      for (const v of c.ventas) {
        const canal = v.canal as Canal
        canalMap.set(canal, (canalMap.get(canal) ?? 0) + Number(v.monto))
        canalGlobal.set(canal, (canalGlobal.get(canal) ?? 0) + Number(v.monto))
      }
      return calcularTotales(input)
    })

    const dia = sumarDia(totalesArr)
    const gastos = totalesArr.reduce((s, t) => s + t.gastosTotal, 0)

    const declared = [...canalMap.entries()].map(([canal, monto]) => ({ canal, monto }))
    const app = vapp.map((v) => ({
      plataformaNombre: v.plataforma.nombre,
      ventaTotal: Number(v.ventaEfectivo) + Number(v.ventaOnline),
      comision: Number(v.comision),
    }))
    const conc = buildControlRows(declared, app)
    let comision = 0
    let deliveryNeto = 0
    let deliveryCobrado = 0
    for (const r of conc) {
      comision += r.comision
      deliveryNeto += r.neto
      deliveryCobrado += r.app
      const g = deliveryGlobal.get(r.plataforma) ?? { declarado: 0, app: 0, comision: 0 }
      g.declarado += r.declarado
      g.app += r.app
      g.comision += r.comision
      deliveryGlobal.set(r.plataforma, g)
    }

    return {
      localId: local.id,
      localNombre: local.nombre,
      marca: local.marca.nombre,
      ventaTotal: round2(dia.ventaTotalDia),
      ventaEfectivo: round2(dia.ventaEfectivoDia),
      diferenciaCaja: round2(dia.diferenciaDia),
      totalDepositado: round2(dia.totalDepositadoDia),
      montoZ: round2(montoZ),
      gastos: round2(gastos),
      comision: round2(comision),
      deliveryNeto: round2(deliveryNeto),
      deliveryCobrado: round2(deliveryCobrado),
      tickets,
      faltaCierre: cs.length === 0,
      faltaImportacion: vapp.length === 0,
      manana: mananaEstado,
      tarde: tardeEstado,
    }
  })

  const grupo = {
    ventaTotal: round2(porLocal.reduce((s, l) => s + l.ventaTotal, 0)),
    ventaEfectivo: round2(porLocal.reduce((s, l) => s + l.ventaEfectivo, 0)),
    diferenciaCaja: round2(porLocal.reduce((s, l) => s + l.diferenciaCaja, 0)),
    totalDepositado: round2(porLocal.reduce((s, l) => s + l.totalDepositado, 0)),
    gastos: round2(porLocal.reduce((s, l) => s + l.gastos, 0)),
    comision: round2(porLocal.reduce((s, l) => s + l.comision, 0)),
    deliveryNeto: round2(porLocal.reduce((s, l) => s + l.deliveryNeto, 0)),
    tickets: porLocal.reduce((s, l) => s + l.tickets, 0),
    efectivoADepositar: round2(porLocal.reduce((s, l) => s + (l.ventaEfectivo - l.gastos), 0)),
    localesCargados: porLocal.filter((l) => !l.faltaCierre).length,
    localesTotal: porLocal.length,
    turnosBorrador,
    neto: 0,
  }
  grupo.neto = round2(grupo.ventaTotal - grupo.gastos - grupo.comision)

  const ventaPorCanal = [...canalGlobal.entries()]
    .map(([canal, monto]) => ({ canal, monto: round2(monto) }))
    .filter((v) => v.monto > 0)
    .sort((a, b) => b.monto - a.monto)

  const delivery: DeliveryPlat[] = [...deliveryGlobal.entries()]
    .map(([plataforma, g]) => ({
      plataforma,
      declarado: round2(g.declarado),
      app: round2(g.app),
      comision: round2(g.comision),
      neto: round2(g.app - g.comision),
      diferencia: round2(g.declarado - g.app),
    }))
    .sort((a, b) => b.app - a.app)

  return { porLocal, grupo, ventaPorCanal, delivery }
}
