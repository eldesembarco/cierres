'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { turnoInputSchema } from '@/lib/cierre/schema'
import { calcularTotales } from '@/lib/cierre/calculations'
import { esCentral } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
import { amnistiaReaperturaActiva } from '@/lib/cierre/amnistia'
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
  // Candado de fecha: evita guardar un cierre con un año imposible (ej. "0026" por un
  // typo en el date-picker), que después "desaparece" en una fecha fuera de rango.
  const anio = fechaDate.getUTCFullYear()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(anio) || anio < 2020 || anio > 2100) {
    return { ok: false as const, error: 'La fecha del cierre es inválida (revisá el año).' }
  }
  // Candado del recupero de fondo fijo: no se puede "guardar para el fondo fijo" más
  // efectivo del que realmente entró en el turno (venta efectivo − gastos efectivo).
  // Evita que se tape un faltante inflando el recupero.
  const efectivoDisponible = totales.ventaEfectivo - totales.gastosEfectivo
  if (totales.retiroFondoFijo > efectivoDisponible + 0.01) {
    return { ok: false as const, error: `No podés guardar para fondo fijo más efectivo del que entró en el turno (máx. $${Math.round(efectivoDisponible).toLocaleString('es-AR')}).` }
  }

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
    proveedorId: g.proveedorId ?? null,
    orden: i,
  }))

  const guardado = await prisma.cierre.upsert({
    where: { localId_fecha_turno: { localId, fecha: fechaDate, turno } },
    update: {
      fondoFijo: input.fondoFijo, montoZ: input.montoZ, efectivoDepositado: input.efectivoDepositado,
      retiroFondoFijo: input.retiroFondoFijo,
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
      efectivoDepositado: input.efectivoDepositado, retiroFondoFijo: input.retiroFondoFijo,
      notaCredito: input.notaCredito,
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

  // Sincronizar la cuenta corriente de este cierre. Los movimientos ya PAGADOS no se
  // tocan (son histórico) y NO se recrean: si un gasto en cuenta corriente ya tiene un
  // movimiento pagado para este cierre, no generamos otro pendiente — de lo contrario,
  // al reeditar el cierre se duplicaría la deuda (uno pagado + uno pendiente nuevo) y se
  // le pagaría dos veces al proveedor. Los gastos se borran+recrean en cada guardado, así
  // que matcheamos por (proveedor, concepto, monto) contra un multiset de lo ya pagado.
  const gastosCtaCte = input.gastos.filter((g) => g.formaPago === 'cuenta_corriente')
  const pagados = await prisma.movimientoCtaCte.findMany({
    where: { cierreId: guardado.id, pagado: true },
    select: { proveedorId: true, concepto: true, monto: true },
  })
  const claveMov = (proveedorId: number | null, concepto: string, monto: number) =>
    `${proveedorId ?? ''}|${concepto}|${monto.toFixed(2)}`
  const pagadosCount = new Map<string, number>()
  for (const p of pagados) {
    const k = claveMov(p.proveedorId, p.concepto, Number(p.monto))
    pagadosCount.set(k, (pagadosCount.get(k) ?? 0) + 1)
  }
  const aRecrear = gastosCtaCte.filter((g) => {
    const k = claveMov(g.proveedorId ?? null, g.tipo, g.monto)
    const c = pagadosCount.get(k) ?? 0
    if (c > 0) {
      pagadosCount.set(k, c - 1) // ese gasto ya está saldado: no lo recreamos
      return false
    }
    return true
  })
  await prisma.$transaction([
    prisma.movimientoCtaCte.deleteMany({ where: { cierreId: guardado.id, pagado: false } }),
    ...(aRecrear.length
      ? [
          prisma.movimientoCtaCte.createMany({
            data: aRecrear.map((g) => ({
              localId,
              cierreId: guardado.id,
              proveedorId: g.proveedorId ?? null,
              fecha: fechaDate,
              concepto: g.tipo,
              descripcion: g.descripcion ?? null,
              monto: g.monto,
            })),
          }),
        ]
      : []),
  ])

  revalidatePath('/cierres')
  revalidatePath(`/cierres/${fecha}`)
  revalidatePath('/cuenta-corriente')
  return { ok: true as const, totales }
}

export async function reabrirCierre(fecha: string, turno: Turno, observacion: string) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  const { localId, userId, rol } = await resolverLocalId()
  // Normalmente sólo administración reabre. Excepción temporal: por hoy (02/07) el
  // encargado puede reabrir SU caja de ayer (01/07) para corregir errores. Como
  // resolverLocalId fuerza el local del encargado, sólo alcanza a su propio local.
  if (!esCentral(rol) && !amnistiaReaperturaActiva(fecha)) {
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
