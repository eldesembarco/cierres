import { prisma } from '@/lib/db'
import { calcularTotales, sumarDia } from '@/lib/cierre/calculations'
import { buildControlRows, type ControlRow } from '@/lib/control/buildControlRows'
import type { Canal, FormaPago, TipoTarjeta, Turno, TurnoInput, TurnoTotales } from '@/lib/cierre/types'

export interface TableroTurno {
  turno: Turno
  estado: string | null
  totales: TurnoTotales
  efectivoDepositado: number
}

export interface TableroResult {
  localId: number
  fecha: Date
  turnos: TableroTurno[]
  dia: {
    ventaTotal: number
    ventaEfectivo: number
    diferenciaCaja: number
    totalDepositado: number
    gastos: number
    tickets: number
  }
  ventaPorCanal: { canal: Canal; monto: number }[]
  conciliacion: ControlRow[]
  delivery: { cobrado: number; comision: number; neto: number }
  faltaCierre: boolean
  faltaImportacion: boolean
}

const ORDEN_TURNO: Turno[] = ['manana', 'tarde']

export async function getTablero(localId: number, fecha: Date): Promise<TableroResult> {
  const [cierres, ventasApp] = await Promise.all([
    prisma.cierre.findMany({
      where: { localId, fecha },
      include: { ventas: true, tarjetas: true, detalles: true, gastos: true },
    }),
    prisma.ventaApp.findMany({ where: { localId, fecha }, include: { plataforma: true } }),
  ])

  // Totales por turno (reconstruye el TurnoInput desde el cierre guardado).
  const turnos: TableroTurno[] = []
  const canalMap = new Map<Canal, number>()
  let tickets = 0
  for (const c of cierres) {
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
    turnos.push({
      turno: c.turno as Turno,
      estado: c.estado,
      totales: calcularTotales(input),
      efectivoDepositado: Number(c.efectivoDepositado),
    })
    for (const v of c.ventas) {
      const canal = v.canal as Canal
      canalMap.set(canal, (canalMap.get(canal) ?? 0) + Number(v.monto))
    }
    tickets += c.cantidadTickets ?? 0
  }
  turnos.sort((a, b) => ORDEN_TURNO.indexOf(a.turno) - ORDEN_TURNO.indexOf(b.turno))

  const totalesArr = turnos.map((t) => t.totales)
  const diaTot = sumarDia(totalesArr)
  const gastos = totalesArr.reduce((s, t) => s + t.gastosTotal, 0)

  const ventaPorCanal = [...canalMap.entries()]
    .map(([canal, monto]) => ({ canal, monto }))
    .filter((v) => v.monto > 0)
    .sort((a, b) => b.monto - a.monto)

  // Conciliación delivery (declarado vs plata real de apps).
  const declared = ventaPorCanal.map((v) => ({ canal: v.canal, monto: v.monto }))
  const app = ventasApp.map((v) => ({
    plataformaNombre: v.plataforma.nombre,
    ventaTotal: Number(v.ventaEfectivo) + Number(v.ventaOnline),
    comision: Number(v.comision),
  }))
  const conciliacion = buildControlRows(declared, app)
  const delivery = conciliacion.reduce(
    (acc, r) => ({ cobrado: acc.cobrado + r.app, comision: acc.comision + r.comision, neto: acc.neto + r.neto }),
    { cobrado: 0, comision: 0, neto: 0 },
  )

  return {
    localId,
    fecha,
    turnos,
    dia: {
      ventaTotal: diaTot.ventaTotalDia,
      ventaEfectivo: diaTot.ventaEfectivoDia,
      diferenciaCaja: diaTot.diferenciaDia,
      totalDepositado: diaTot.totalDepositadoDia,
      gastos,
      tickets,
    },
    ventaPorCanal,
    conciliacion,
    delivery,
    faltaCierre: cierres.length === 0,
    faltaImportacion: ventasApp.length === 0,
  }
}
