'use server'

import { cookies } from 'next/headers'
import type { Session } from 'next-auth'
import { prisma } from '@/lib/db'
import { esCentral } from '@/lib/auth/rbac'

const COOKIE = 'localActivo'

/**
 * Local "activo" sobre el que opera la pantalla actual.
 *
 *  - Encargado: SIEMPRE su local asignado (no puede cambiarlo).
 *  - Central / admin: el local elegido en el selector de la TopBar, persistido
 *    en la cookie `localActivo`. Si la cookie no existe o apunta a algo inválido,
 *    cae al primer local activo (orden por id) para no romper nunca.
 */
export async function getLocalActivoId(session: Session): Promise<number> {
  const { rol, localId } = session.user

  if (!esCentral(rol)) {
    if (!localId) throw new Error('Encargado sin local asignado')
    return localId
  }

  // central / admin → cookie (async en Next 16)
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  const parsed = raw && /^\d+$/.test(raw) ? Number(raw) : null
  if (parsed != null) return parsed

  // Fallback: primer local activo.
  const primero = await prisma.local.findFirst({
    where: { activo: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  })
  return primero?.id ?? 1
}

/**
 * Fija el "local activo" para central/admin. Llamable desde el selector cliente
 * de la TopBar. Sólo central/admin puede cambiarlo; el encargado nunca.
 */
export async function setLocalActivo(localId: number) {
  const { auth } = await import('@/lib/auth/auth')
  const session = await auth()
  if (!session || !esCentral(session.user.rol)) {
    throw new Error('No autorizado para cambiar el local activo')
  }
  const store = await cookies()
  // Cookie persistente (1 año) y endurecida: antes era de sesión y se perdía al
  // cerrar el navegador (el admin volvía al primer local).
  store.set(COOKIE, String(localId), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  // En Next 16, setear una cookie en un Server Action YA re-renderiza la página y
  // sus layouts automáticamente → no hace falta revalidatePath (que además, con
  // type 'layout' sobre '/', purgaba todo el cache y re-prefetcheaba las 6 solapas
  // en cada cambio). Las demás pantallas re-leen el local al navegar (son dinámicas).
}
