'use server'

import { auth } from '@/lib/auth/auth'
import { puedeSubirCsv } from '@/lib/auth/rbac'
import { ingestCsv } from '@/lib/ingest/ingestService'
import { prisma } from '@/lib/db'

export async function subirCsv(formData: FormData) {
  const session = await auth()
  if (!session || !puedeSubirCsv(session.user.rol)) return { ok: false as const, error: 'Sin permiso' }

  const file = formData.get('archivo') as File | null
  const fecha = String(formData.get('fecha') ?? '')
  if (!file || !fecha) return { ok: false as const, error: 'Falta archivo o fecha' }

  const csv = await file.text()
  try {
    const r = await ingestCsv({
      csv, plataformaCodigo: 'PY', fechaReporte: new Date(fecha),
      archivoNombre: file.name, subidoPor: Number(session.user.id),
    })
    return { ok: true as const, ...r }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Error al procesar el CSV' }
  }
}

// Mapea un store_id / restaurant_id externo (sin mapear) a un local de la app,
// para que las próximas importaciones lo concilien. Reusa local_plataforma.
export async function mapearLocalPlataforma(input: {
  plataformaCodigo: string
  restaurantId: string
  nombre: string
  localId: number
}) {
  const session = await auth()
  if (!session || !puedeSubirCsv(session.user.rol)) return { ok: false as const, error: 'Sin permiso' }
  try {
    const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: input.plataformaCodigo } })
    await prisma.localPlataforma.upsert({
      where: { plataformaId_restaurantIdExterno: { plataformaId: plataforma.id, restaurantIdExterno: input.restaurantId } },
      update: { localId: input.localId, nombreExterno: input.nombre, activo: true },
      create: { localId: input.localId, plataformaId: plataforma.id, restaurantIdExterno: input.restaurantId, nombreExterno: input.nombre, activo: true },
    })
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'No pude guardar el mapeo' }
  }
}
