'use server'

// Justificación de comandas anuladas: el ENCARGADO justifica las de su local
// (el localId de su sesión manda, ignora el del form); central/admin pueden
// justificar en nombre de un local. Contable no escribe. Upsert por la clave
// natural (localId, fechaHora, importe) que sobrevive a los resyncs de Tango.
import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { esCentral } from '@/lib/auth/rbac'
import { MOTIVO_LABEL } from '@/lib/tango/anuladas'
import { TAG_ANULACIONES } from '@/lib/cachedData'

export async function justificarAnulacion(formData: FormData) {
  const session = await auth()
  if (!session) return

  const rol = session.user.rol
  const esEncargado = rol === 'encargado'
  if (!esEncargado && !esCentral(rol)) return // contable: solo lectura

  const fechaHoraIso = String(formData.get('fechaHora') ?? '')
  const importe = Number(formData.get('importe'))
  const motivo = String(formData.get('motivo') ?? '')
  const detalle = String(formData.get('detalle') ?? '').trim()
  const localId = esEncargado ? session.user.localId : Number(formData.get('localId'))

  const fechaHora = new Date(fechaHoraIso)
  if (!localId || Number.isNaN(fechaHora.getTime()) || !(importe > 0)) return
  if (!(motivo in MOTIVO_LABEL)) return
  if (motivo === 'otro' && !detalle) return // "otro" exige detallar

  // La anulada tiene que existir Y ser del local del que justifica.
  const existe = await prisma.comandaAnuladaTango.findFirst({
    where: { localId, fechaHora, importe },
    select: { id: true },
  })
  if (!existe) return

  const nombre = session.user.name ?? session.user.email ?? String(session.user.id)
  await prisma.anulacionJustificacion.upsert({
    where: { localId_fechaHora_importe: { localId, fechaHora, importe } },
    create: {
      localId,
      fechaHora,
      importe,
      motivo,
      detalle: detalle || null,
      creadoPor: Number(session.user.id),
      creadoPorNombre: nombre,
    },
    update: {
      motivo,
      detalle: detalle || null,
      creadoPor: Number(session.user.id),
      creadoPorNombre: nombre,
    },
  })

  updateTag(TAG_ANULACIONES) // el que justifica ve el cambio al instante
  revalidatePath('/anulaciones')
}
