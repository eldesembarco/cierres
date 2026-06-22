'use server'

import { auth } from '@/lib/auth/auth'
import { puedeSubirCsv } from '@/lib/auth/rbac'
import { ingestCsv } from '@/lib/ingest/ingestService'

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
