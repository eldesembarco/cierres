'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { esCentral } from '@/lib/auth/rbac'
import { revalidatePath, updateTag } from 'next/cache'
import { TAG_CTA_CTE } from '@/lib/cachedData'

// Crea (o reutiliza, si ya existe con el mismo nombre) un proveedor. Cualquier
// usuario autenticado puede darlo de alta: el encargado lo elige al cargar un
// gasto en cuenta corriente.
export async function crearProveedor(nombre: string) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  const n = nombre.trim()
  if (!n) return { ok: false as const, error: 'Escribí un nombre de proveedor.' }
  const existente = await prisma.proveedor.findFirst({
    where: { nombre: { equals: n, mode: 'insensitive' } },
    select: { id: true, nombre: true },
  })
  const prov = existente ?? (await prisma.proveedor.create({ data: { nombre: n }, select: { id: true, nombre: true } }))
  revalidatePath('/cuenta-corriente')
  return { ok: true as const, proveedor: prov }
}

// Marca un movimiento de cuenta corriente como pagado (o lo vuelve a pendiente).
// Sólo administración registra pagos.
export async function marcarPagado(movimientoId: number, pagar: boolean) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  if (!esCentral(session.user.rol)) {
    return { ok: false as const, error: 'Sólo administración puede registrar pagos.' }
  }
  await prisma.movimientoCtaCte.update({
    where: { id: movimientoId },
    data: pagar
      ? { pagado: true, pagadoEn: new Date(), pagadoPor: Number(session.user.id) }
      : { pagado: false, pagadoEn: null, pagadoPor: null },
  })
  updateTag(TAG_CTA_CTE)
  revalidatePath('/cuenta-corriente')
  return { ok: true as const }
}
