'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { puedeMarcarPagado } from '@/lib/auth/rbac'
import { reponerFondoFijoSchema } from '@/lib/cierre/schema'
import { revalidatePath, updateTag } from 'next/cache'
import { TAG_FONDO_FIJO, TAG_DASHBOARD } from '@/lib/cachedData'

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
  updateTag(TAG_FONDO_FIJO)
  updateTag(TAG_DASHBOARD)
  revalidatePath('/fondo-fijo')
  revalidatePath('/cierres', 'layout') // refrescar el saldo mostrado en la planilla
  return { ok: true as const }
}

// Administración define/edita el objetivo (base) del fondo fijo de un local. Editable
// desde la app a medida que se averiguan los montos de cada local. Cambia el saldo/a
// reponer del local (el objetivo es el techo actual de la caja chica).
export async function setFondoFijoObjetivo(localId: number, monto: number) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  if (!puedeMarcarPagado(session.user.rol)) {
    return { ok: false as const, error: 'Solo administración puede definir el fondo fijo.' }
  }
  if (!Number.isInteger(localId) || localId <= 0 || !Number.isFinite(monto) || monto < 0) {
    return { ok: false as const, error: 'Ingresá un monto válido (0 o más).' }
  }
  await prisma.local.update({ where: { id: localId }, data: { fondoFijoDefault: monto } })
  updateTag(TAG_FONDO_FIJO)
  revalidatePath('/fondo-fijo')
  revalidatePath('/cierres', 'layout')
  return { ok: true as const }
}
