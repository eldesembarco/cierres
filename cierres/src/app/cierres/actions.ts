'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { turnoInputSchema } from '@/lib/cierre/schema'
import { calcularTotales } from '@/lib/cierre/calculations'
import { esCentral } from '@/lib/auth/rbac'
import type { Turno } from '@/lib/cierre/types'
import { revalidatePath } from 'next/cache'

const UMBRAL_DIFERENCIA = 1000 // $ — calibrar en el piloto

async function resolverLocalId() {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  const { rol, localId } = session.user
  if (!esCentral(rol)) {
    if (!localId) throw new Error('Encargado sin local asignado')
    return { localId, userId: Number(session.user.id), rol }
  }
  // central/admin: por ahora opera sobre San Telmo (local 1) en el piloto
  return { localId: 1, userId: Number(session.user.id), rol }
}

export async function guardarCierre(fecha: string, turno: Turno, payloadJson: string, cerrar: boolean) {
  const { localId, userId } = await resolverLocalId()
  const payload = JSON.parse(payloadJson)
  const input = turnoInputSchema.parse(payload)
  const nota: string | null = (payload.nota ?? '').trim() || null
  const totales = calcularTotales(input)
  const fechaDate = new Date(fecha)

  if (cerrar && Math.abs(totales.diferenciaCaja) > UMBRAL_DIFERENCIA && !nota) {
    return { ok: false as const, error: `La diferencia de caja es ${totales.diferenciaCaja}. Agregá una nota para cerrar.` }
  }

  const detalles = input.detalles.filter((d) => d.importe > 0 || d.referencia.trim() !== '')
  const gastos = input.gastos.map((g, i) => ({
    tipo: g.tipo,
    formaPago: g.formaPago,
    monto: g.monto,
    descripcion: g.descripcion ?? null,
    comprobanteId: g.comprobanteId ?? null,
    orden: i,
  }))

  await prisma.cierre.upsert({
    where: { localId_fecha_turno: { localId, fecha: fechaDate, turno } },
    update: {
      fondoFijo: input.fondoFijo, montoZ: input.montoZ, efectivoDepositado: input.efectivoDepositado,
      notaCredito: input.notaCredito, cantidadTickets: input.cantidadTickets ?? null, nota,
      estado: cerrar ? 'cerrado' : 'borrador',
      cerradoPor: cerrar ? userId : null, cerradoEn: cerrar ? new Date() : null,
      ventas: { deleteMany: {}, create: input.ventas.map((v) => ({ canal: v.canal, monto: v.monto })) },
      tarjetas: { deleteMany: {}, create: input.tarjetas.map((t) => ({ tipo: t.tipo, monto: t.monto, lote: t.lote ?? null })) },
      detalles: { deleteMany: {}, create: detalles.map((d, i) => ({ canal: d.canal, referencia: d.referencia, importe: d.importe, orden: i })) },
      gastos: { deleteMany: {}, create: gastos },
    },
    create: {
      localId, fecha: fechaDate, turno, fondoFijo: input.fondoFijo, montoZ: input.montoZ,
      efectivoDepositado: input.efectivoDepositado, notaCredito: input.notaCredito,
      cantidadTickets: input.cantidadTickets ?? null,
      nota, estado: cerrar ? 'cerrado' : 'borrador',
      creadoPor: userId, cerradoPor: cerrar ? userId : null, cerradoEn: cerrar ? new Date() : null,
      ventas: { create: input.ventas.map((v) => ({ canal: v.canal, monto: v.monto })) },
      tarjetas: { create: input.tarjetas.map((t) => ({ tipo: t.tipo, monto: t.monto, lote: t.lote ?? null })) },
      detalles: { create: detalles.map((d, i) => ({ canal: d.canal, referencia: d.referencia, importe: d.importe, orden: i })) },
      gastos: { create: gastos },
    },
  })

  revalidatePath('/cierres')
  return { ok: true as const, totales }
}
