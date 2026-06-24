'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { turnoInputSchema } from '@/lib/cierre/schema'
import { calcularTotales } from '@/lib/cierre/calculations'
import { esCentral } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
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
  // central/admin: opera sobre el "local activo" elegido en la TopBar (cookie).
  const localActivo = await getLocalActivoId(session)
  return { localId: localActivo, userId: Number(session.user.id), rol }
}

export async function guardarCierre(
  fecha: string,
  turno: Turno,
  payloadJson: string,
  cerrar: boolean,
  observacion?: string,
) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  const { localId, userId, rol } = await resolverLocalId()
  const central = esCentral(rol)
  const payload = JSON.parse(payloadJson)
  const input = turnoInputSchema.parse(payload)
  const nota: string | null = (payload.nota ?? '').trim() || null
  const totales = calcularTotales(input)
  const fechaDate = new Date(fecha)

  // ¿Existe ya un cierre para este turno? Lo necesitamos para tres reglas:
  //  - bloqueo de turno cerrado para el encargado,
  //  - gate de observación cuando administración edita un cierre existente,
  //  - registrar la auditoría sólo en ediciones (no en altas).
  const existente = await prisma.cierre.findUnique({
    where: { localId_fecha_turno: { localId, fecha: fechaDate, turno } },
    select: { id: true, estado: true },
  })

  // Bloqueo: el encargado no puede editar un turno ya cerrado. Sólo administración
  // (o tras una reapertura) puede volver a tocarlo.
  if (!central && existente?.estado === 'cerrado') {
    return { ok: false as const, error: 'El turno está cerrado. Requiere autorización del administrador.' }
  }

  // El gate de nota por diferencia sólo aplica a administración (central/admin).
  // El encargado cierra a ciegas: no ve la diferencia, así que el cierre siempre procede.
  if (
    central &&
    cerrar &&
    Math.abs(totales.diferenciaCaja) > UMBRAL_DIFERENCIA &&
    !nota
  ) {
    return { ok: false as const, error: `La diferencia de caja es ${totales.diferenciaCaja}. Agregá una nota para cerrar.` }
  }

  // Administración editando un cierre que YA existía (dato que el local cargó):
  // exigimos una observación del cambio y la registramos en la auditoría.
  const esEdicionAdmin = central && existente != null
  const obs = (observacion ?? '').trim()
  if (esEdicionAdmin && !obs) {
    return { ok: false as const, error: 'Indicá una observación del cambio para guardar.' }
  }

  const detalles = input.detalles.filter((d) => d.importe > 0 || d.referencia.trim() !== '')
  const gastos = input.gastos.map((g, i) => ({
    tipo: g.tipo,
    formaPago: g.formaPago,
    monto: g.monto,
    descripcion: g.descripcion ?? null,
    comprobanteId: g.comprobanteId ?? null,
    facturaNumero: g.facturaNumero ?? null,
    facturaTotal: g.facturaTotal ?? null,
    orden: i,
  }))

  const guardado = await prisma.cierre.upsert({
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
    select: { id: true },
  })

  if (esEdicionAdmin) {
    await prisma.cierreAuditoria.create({
      data: {
        cierreId: guardado.id,
        usuarioId: userId,
        usuarioNombre: session.user.name ?? session.user.email ?? String(userId),
        accion: 'edicion',
        observacion: obs,
      },
    })
  }

  revalidatePath('/cierres')
  revalidatePath(`/cierres/${fecha}`)
  return { ok: true as const, totales }
}

export async function reabrirCierre(fecha: string, turno: Turno, observacion: string) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  const { localId, userId, rol } = await resolverLocalId()
  if (!esCentral(rol)) {
    return { ok: false as const, error: 'No autorizado para reabrir cierres.' }
  }
  const obs = (observacion ?? '').trim()
  if (!obs) {
    return { ok: false as const, error: 'Indicá una observación para reabrir el turno.' }
  }
  const fechaDate = new Date(fecha)
  const existente = await prisma.cierre.findUnique({
    where: { localId_fecha_turno: { localId, fecha: fechaDate, turno } },
    select: { id: true },
  })
  if (!existente) {
    return { ok: false as const, error: 'No hay un cierre para reabrir.' }
  }

  await prisma.cierre.update({
    where: { id: existente.id },
    data: { estado: 'borrador', cerradoPor: null, cerradoEn: null },
  })
  await prisma.cierreAuditoria.create({
    data: {
      cierreId: existente.id,
      usuarioId: userId,
      usuarioNombre: session.user.name ?? session.user.email ?? String(userId),
      accion: 'reapertura',
      observacion: obs,
    },
  })

  revalidatePath('/cierres')
  revalidatePath(`/cierres/${fecha}`)
  return { ok: true as const }
}
