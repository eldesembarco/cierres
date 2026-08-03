'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { puedeAdministrarLocales } from '@/lib/auth/rbac'
import { localInputSchema } from './schema'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'

type Resultado = { ok: true } | { ok: false; error: string }

async function verificarPermiso() {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  if (!puedeAdministrarLocales(session.user.rol)) {
    throw new Error('No tenés permiso para administrar locales.')
  }
  return session
}

function revalidarListas() {
  // El listado de locales se lee en runtime (sin unstable_cache) desde varias
  // pantallas: layout (TopBar/selector), importaciones, conciliación, informes,
  // etc. Revalidamos el layout completo para que todas se refresquen, más la
  // propia pantalla de administración.
  revalidatePath('/', 'layout')
  revalidatePath('/admin/locales')
}

export async function crearLocal(formData: FormData): Promise<Resultado> {
  try {
    await verificarPermiso()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }

  const parsed = localInputSchema.safeParse({
    nombre: formData.get('nombre'),
    marcaId: formData.get('marcaId'),
    direccion: formData.get('direccion'),
    ciudad: formData.get('ciudad'),
    fondoFijoDefault: formData.get('fondoFijoDefault') || 0,
    tangoSucursalId: formData.get('tangoSucursalId') || '',
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const input = parsed.data

  try {
    await prisma.local.create({
      data: {
        nombre: input.nombre,
        marcaId: input.marcaId,
        direccion: input.direccion || null,
        ciudad: input.ciudad || null,
        fondoFijoDefault: input.fondoFijoDefault,
        tangoSucursalId: input.tangoSucursalId,
      },
    })
  } catch (e) {
    // Los dos @unique de Local que puede pisar un alta manual: nombre… en
    // realidad "nombre" NO es único en el schema, pero tangoSucursalId sí.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Ese código de sucursal Tango ya está asignado a otro local.' }
    }
    return { ok: false, error: 'No se pudo crear el local. Reintentá.' }
  }

  revalidarListas()
  return { ok: true }
}

export async function actualizarLocal(id: number, formData: FormData): Promise<Resultado> {
  try {
    await verificarPermiso()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }

  const parsed = localInputSchema.safeParse({
    nombre: formData.get('nombre'),
    marcaId: formData.get('marcaId'),
    direccion: formData.get('direccion'),
    ciudad: formData.get('ciudad'),
    fondoFijoDefault: formData.get('fondoFijoDefault') || 0,
    tangoSucursalId: formData.get('tangoSucursalId') || '',
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const input = parsed.data

  try {
    await prisma.local.update({
      where: { id },
      data: {
        nombre: input.nombre,
        marcaId: input.marcaId,
        direccion: input.direccion || null,
        ciudad: input.ciudad || null,
        fondoFijoDefault: input.fondoFijoDefault,
        tangoSucursalId: input.tangoSucursalId,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, error: 'Ese código de sucursal Tango ya está asignado a otro local.' }
    }
    return { ok: false, error: 'No se pudo actualizar el local. Reintentá.' }
  }

  revalidarListas()
  return { ok: true }
}

// Los locales nunca se borran (tienen cierres, ventas, movimientos de cta cte
// colgando). "Eliminar" = desactivar: deja de aparecer en los selectores de
// alta de nuevos registros, pero su historial sigue intacto y consultable.
export async function setActivoLocal(id: number, activo: boolean): Promise<Resultado> {
  try {
    await verificarPermiso()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No autorizado' }
  }

  await prisma.local.update({ where: { id }, data: { activo } })
  revalidarListas()
  return { ok: true }
}
