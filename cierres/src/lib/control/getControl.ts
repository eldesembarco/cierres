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
  const cierre = await prisma.cierre.findUnique({
    where: { localId_fecha: { localId, fecha } },
    include: { ventas: true },
  })
  const ventasApp = await prisma.ventaApp.findMany({ where: { localId, fecha }, include: { plataforma: true } })

  const declared = (cierre?.ventas ?? []).map((v) => ({ canal: v.canal as Canal, monto: Number(v.monto) }))
  const app = ventasApp.map((v) => ({ plataformaNombre: v.plataforma.nombre, ventaTotal: Number(v.ventaEfectivo) + Number(v.ventaOnline) }))

  return {
    localId,
    fecha,
    rows: buildControlRows(declared, app),
    faltaCierre: cierre === null,
    faltaImportacion: ventasApp.length === 0,
  }
}
