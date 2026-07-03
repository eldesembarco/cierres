'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { puedeMarcarPagado } from '@/lib/auth/rbac'
import { reponerFondoFijoSchema } from '@/lib/cierre/schema'
import { revalidatePath } from 'next/cache'

// Administración carga una reposición del fondo fijo (le entrega plata al local para
// volver a llenar la caja chica). Sube el saldo corriente del fondo fijo del local.
export async function reponerFondoFijo(localId: number, monto: number, descripcion?: string) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  if (!puedeMarcarPagado(session.user.rol)) {
    return { ok: false as const, error: 'Solo administración puede reponer el fondo fijo.' }
  }
  const parsed = reponerFondoFijoSchema.safeParse({ localId, monto, descripcion })
  if (!parsed.success) {
    return { ok: false as const, error: 'Ingresá un monto válido para reponer.' }
  }
  await prisma.reposicionFondoFijo.create({
    data: {
      localId: parsed.data.localId,
      fecha: new Date(),
      monto: parsed.data.monto,
      descripcion: parsed.data.descripcion?.trim() || null,
      creadoPor: Number(session.user.id),
    },
  })
  revalidatePath('/fondo-fijo')
  revalidatePath('/cierres', 'layout') // refrescar el saldo mostrado en la planilla
  return { ok: true as const }
}
