import { prisma } from '@/lib/db'
import { buildControlRows, type ControlRow } from '@/lib/control/buildControlRows'
import type { Canal } from '@/lib/cierre/types'

export interface ControlResult {
  localId: number
  fecha: Date
  rows: ControlRow[]
  faltaCierre: boolean
  faltaImportacion: boolean
}

export async function getControl(localId: number, fecha: Date): Promise<ControlResult> {
  // Ahora hay hasta 2 cierres por (local, fecha) — uno por turno. El "declarado"
  // por canal es la suma de las ventas de ambos turnos.
  const cierres = await prisma.cierre.findMany({
    where: { localId, fecha },
    include: { ventas: true },
  })
  const ventasApp = await prisma.ventaApp.findMany({ where: { localId, fecha }, include: { plataforma: true } })

  const declaredByCanal = new Map<Canal, number>()
  for (const c of cierres) {
    for (const v of c.ventas) {
      const canal = v.canal as Canal
      declaredByCanal.set(canal, (declaredByCanal.get(canal) ?? 0) + Number(v.monto))
    }
  }
  const declared = [...declaredByCanal.entries()].map(([canal, monto]) => ({ canal, monto }))
  const app = ventasApp.map((v) => ({
    plataformaNombre: v.plataforma.nombre,
    ventaTotal: Number(v.ventaEfectivo) + Number(v.ventaOnline),
    comision: Number(v.comision),
  }))

  return {
    localId,
    fecha,
    rows: buildControlRows(declared, app),
    faltaCierre: cierres.length === 0,
    faltaImportacion: ventasApp.length === 0,
  }
}
