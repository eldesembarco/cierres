'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { cierreInputSchema } from '@/lib/cierre/schema'
import { calcularTotales } from '@/lib/cierre/calculations'
import { esCentral } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'

const UMBRAL_DIFERENCIA = 1000 // $ — calibrar en el piloto

async function resolverLocalId(fecha: string) {
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

export async function guardarCierre(fecha: string, payloadJson: string, cerrar: boolean) {
  const { localId, userId } = await resolverLocalId(fecha)
  const payload = JSON.parse(payloadJson)
  const input = cierreInputSchema.parse(payload)
  const nota: string | null = (payload.nota ?? '').trim() || null
  const totales = calcularTotales(input)
  const fechaDate = new Date(fecha)

  if (cerrar && Math.abs(totales.diferenciaCaja) > UMBRAL_DIFERENCIA && !nota) {
    return { ok: false as const, error: `La diferencia de caja es ${totales.diferenciaCaja}. Agregá una nota para cerrar.` }
  }

  await prisma.cierre.upsert({
    where: { localId_fecha: { localId, fecha: fechaDate } },
    update: {
      fondoFijo: input.fondoFijo, gastosTotal: input.gastosTotal, notaCredito: input.notaCredito,
      cantidadTickets: input.cantidadTickets ?? null, nota,
      estado: cerrar ? 'cerrado' : 'borrador',
      cerradoPor: cerrar ? userId : null, cerradoEn: cerrar ? new Date() : null,
      turnos: { deleteMany: {}, create: input.turnos.map((t) => ({ turno: t.turno, montoZ: t.montoZ })) },
      ventas: { deleteMany: {}, create: input.ventas.map((v) => ({ canal: v.canal, monto: v.monto })) },
    },
    create: {
      localId, fecha: fechaDate, fondoFijo: input.fondoFijo, gastosTotal: input.gastosTotal,
      notaCredito: input.notaCredito, cantidadTickets: input.cantidadTickets ?? null,
      nota, estado: cerrar ? 'cerrado' : 'borrador',
      creadoPor: userId, cerradoPor: cerrar ? userId : null, cerradoEn: cerrar ? new Date() : null,
      turnos: { create: input.turnos.map((t) => ({ turno: t.turno, montoZ: t.montoZ })) },
      ventas: { create: input.ventas.map((v) => ({ canal: v.canal, monto: v.monto })) },
    },
  })

  revalidatePath('/cierres')
  return { ok: true as const, totales }
}
