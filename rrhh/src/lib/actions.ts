'use server'
// Server actions de mutación. En modo demo devuelven éxito sin persistir
// (la UI avisa); con base conectada escriben vía Prisma + audit log.
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth/auth'
import { getPrisma, isDemo } from '@/lib/db'

export type ActionResult = { ok: boolean; demo?: boolean; error?: string; id?: number }

const DEMO_OK: ActionResult = { ok: true, demo: true }

async function audit(accion: string, entidad: string, entidadId: string, detalle?: unknown) {
  try {
    const session = await auth()
    const usuarioId = session?.user?.id && /^\d+$/.test(session.user.id) ? Number(session.user.id) : null
    await getPrisma().auditLog.create({
      data: { usuarioId, accion, entidad, entidadId, detalle: detalle ? JSON.parse(JSON.stringify(detalle)) : undefined },
    })
  } catch {
    // la auditoría nunca rompe la operación
  }
}

const empleadoSchema = z.object({
  nombreCompleto: z.string().min(3),
  cuil: z.string().optional(),
  dni: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefono: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  nacionalidad: z.string().optional(),
  estadoCivil: z.string().optional(),
  direccion: z.string().optional(),
  pisoDpto: z.string().optional(),
  localidad: z.string().optional(),
  cp: z.string().optional(),
  cbu: z.string().optional(),
  emergenciaNombre: z.string().optional(),
  emergenciaTelefono: z.string().optional(),
  emergenciaRelacion: z.string().optional(),
  empresaId: z.coerce.number().optional(),
  locacionId: z.coerce.number().optional(),
  departamentoId: z.coerce.number().optional(),
  posicionId: z.coerce.number().optional(),
  convenio: z.string().optional(),
  obraSocial: z.string().optional(),
  art: z.string().optional(),
  fechaIngreso: z.string().optional(),
  reportaAId: z.coerce.number().optional(),
  notas: z.string().optional(),
})

function limpiar<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) continue
    out[k] = k.startsWith('fecha') && typeof v === 'string' ? new Date(v) : v
  }
  return out
}

export async function crearEmpleado(datos: z.infer<typeof empleadoSchema>): Promise<ActionResult> {
  const parsed = empleadoSchema.safeParse(datos)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos: ' + parsed.error.issues[0]?.message }
  if (isDemo()) return DEMO_OK
  try {
    const creado = await getPrisma().empleado.create({ data: limpiar(parsed.data) as never })
    await audit('crear', 'empleado', String(creado.id), { nombre: parsed.data.nombreCompleto })
    revalidatePath('/nomina')
    return { ok: true, id: creado.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear' }
  }
}

export async function actualizarEmpleado(id: number, datos: z.infer<typeof empleadoSchema>): Promise<ActionResult> {
  const parsed = empleadoSchema.partial().safeParse(datos)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }
  if (isDemo()) return DEMO_OK
  try {
    await getPrisma().empleado.update({ where: { id }, data: limpiar(parsed.data) as never })
    await audit('actualizar', 'empleado', String(id))
    revalidatePath('/nomina')
    revalidatePath(`/nomina/${id}`)
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al actualizar' }
  }
}

export async function darDeBaja(id: number, fechaEgreso: string, motivo: string): Promise<ActionResult> {
  if (isDemo()) return DEMO_OK
  try {
    await getPrisma().empleado.update({
      where: { id },
      data: { estado: 'EGRESADO', fechaEgreso: new Date(fechaEgreso), motivoEgreso: motivo },
    })
    await audit('baja', 'empleado', String(id), { motivo })
    revalidatePath('/nomina')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function revisarDocumento(id: number, decision: 'APROBADO' | 'RECHAZADO', observacion?: string): Promise<ActionResult> {
  if (isDemo()) return DEMO_OK
  try {
    const session = await auth()
    const revisadoPorId = session?.user?.id && /^\d+$/.test(session.user.id) ? Number(session.user.id) : null
    await getPrisma().documento.update({
      where: { id },
      data: { estado: decision, observacion: observacion ?? null, revisadoPorId },
    })
    await audit('revisar_documento', 'documento', String(id), { decision })
    revalidatePath('/documentos')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

const invitacionSchema = z.object({
  email: z.string().email(),
  nombre: z.string().optional(),
  posicionId: z.coerce.number().optional(),
  locacionId: z.coerce.number().optional(),
})

export async function crearInvitacion(datos: z.infer<typeof invitacionSchema>): Promise<ActionResult & { token?: string }> {
  const parsed = invitacionSchema.safeParse(datos)
  if (!parsed.success) return { ok: false, error: 'Email inválido' }
  if (isDemo()) return { ...DEMO_OK, token: 'demo-nuevo-1' }
  try {
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
    const inv = await getPrisma().invitacion.create({
      data: {
        token, email: parsed.data.email, nombre: parsed.data.nombre || null,
        posicionId: parsed.data.posicionId || null, locacionId: parsed.data.locacionId || null,
        expiraEn: new Date(Date.now() + 14 * 86400000),
      },
    })
    await audit('crear', 'invitacion', String(inv.id), { email: parsed.data.email })
    revalidatePath('/onboarding')
    return { ok: true, id: inv.id, token }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

const onboardingSchema = empleadoSchema.pick({
  nombreCompleto: true, cuil: true, dni: true, email: true, telefono: true,
  fechaNacimiento: true, nacionalidad: true, estadoCivil: true, direccion: true,
  pisoDpto: true, localidad: true, cp: true, cbu: true,
  emergenciaNombre: true, emergenciaTelefono: true, emergenciaRelacion: true,
  obraSocial: true,
})

/** Form público del ingresante (/ingreso/[token]): crea el empleado en ONBOARDING */
export async function completarOnboarding(token: string, datos: z.infer<typeof onboardingSchema>): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse(datos)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos: ' + parsed.error.issues[0]?.message }
  if (isDemo()) return DEMO_OK
  try {
    const p = getPrisma()
    const inv = await p.invitacion.findUnique({ where: { token }, include: { posicion: true } })
    if (!inv) return { ok: false, error: 'Invitación no encontrada' }
    if (inv.estado === 'APROBADA' || inv.estado === 'COMPLETADA') return { ok: false, error: 'Esta invitación ya fue completada' }
    if (inv.expiraEn < new Date()) return { ok: false, error: 'La invitación expiró: pedí una nueva a RRHH' }

    const empleado = await p.empleado.create({
      data: {
        ...(limpiar(parsed.data) as object),
        estado: 'ONBOARDING',
        posicionId: inv.posicionId,
        locacionId: inv.locacionId,
        departamentoId: inv.posicion?.departamentoId ?? null,
        convenio: inv.posicion?.convenio ?? null,
      } as never,
    })
    await p.invitacion.update({
      where: { id: inv.id },
      data: { estado: 'COMPLETADA', empleadoId: empleado.id, datos: JSON.parse(JSON.stringify(parsed.data)) },
    })
    // Placeholders de documentos requeridos por la posición
    if (inv.posicionId) {
      const reglas = await p.posicionDocumento.findMany({ where: { posicionId: inv.posicionId } })
      if (reglas.length) {
        await p.documento.createMany({
          data: reglas.map(r => ({ empleadoId: empleado.id, tipoId: r.documentoTipoId, estado: 'PENDIENTE' as const })),
        })
      }
    }
    await audit('onboarding_completado', 'empleado', String(empleado.id))
    revalidatePath('/onboarding')
    return { ok: true, id: empleado.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

/** RRHH aprueba el alta: el empleado pasa de ONBOARDING a ACTIVO */
export async function aprobarIngreso(invitacionId: number): Promise<ActionResult> {
  if (isDemo()) return DEMO_OK
  try {
    const p = getPrisma()
    const inv = await p.invitacion.findUnique({ where: { id: invitacionId } })
    if (!inv?.empleadoId) return { ok: false, error: 'La invitación no tiene empleado asociado' }
    await p.empleado.update({
      where: { id: inv.empleadoId },
      data: { estado: 'ACTIVO', fechaIngreso: new Date() },
    })
    await p.invitacion.update({ where: { id: invitacionId }, data: { estado: 'APROBADA' } })
    await audit('aprobar_ingreso', 'empleado', String(inv.empleadoId))
    revalidatePath('/onboarding')
    revalidatePath('/nomina')
    return { ok: true, id: inv.empleadoId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

const solicitudSchema = z.object({
  empleadoId: z.coerce.number(),
  tipo: z.enum(['VACACIONES', 'ESTUDIO', 'ENFERMEDAD', 'HORAS_EXTRA', 'OTRO']),
  desde: z.string().min(10),
  hasta: z.string().min(10),
  observacion: z.string().optional(),
})

export async function crearSolicitud(datos: z.infer<typeof solicitudSchema>): Promise<ActionResult> {
  const parsed = solicitudSchema.safeParse(datos)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' }
  const desde = new Date(parsed.data.desde)
  const hasta = new Date(parsed.data.hasta)
  if (hasta < desde) return { ok: false, error: 'La fecha hasta no puede ser anterior a desde' }
  if (isDemo()) return DEMO_OK
  try {
    const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1
    const s = await getPrisma().solicitud.create({
      data: { empleadoId: parsed.data.empleadoId, tipo: parsed.data.tipo, desde, hasta, dias, observacion: parsed.data.observacion || null },
    })
    await audit('crear', 'solicitud', String(s.id), { tipo: parsed.data.tipo, dias })
    revalidatePath('/vacaciones')
    return { ok: true, id: s.id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}

export async function resolverSolicitud(id: number, decision: 'APROBADA' | 'RECHAZADA'): Promise<ActionResult> {
  if (isDemo()) return DEMO_OK
  try {
    const p = getPrisma()
    const session = await auth()
    const aprobadaPorId = session?.user?.id && /^\d+$/.test(session.user.id) ? Number(session.user.id) : null
    const s = await p.solicitud.update({ where: { id }, data: { estado: decision, aprobadaPorId } })
    // Al aprobar vacaciones, impacta el saldo del año de la fecha "desde"
    if (decision === 'APROBADA' && s.tipo === 'VACACIONES') {
      const anio = s.desde.getFullYear()
      await p.vacacionSaldo.upsert({
        where: { empleadoId_anio: { empleadoId: s.empleadoId, anio } },
        create: { empleadoId: s.empleadoId, anio, diasCorrespondientes: 14, diasTomados: s.dias },
        update: { diasTomados: { increment: s.dias } },
      })
    }
    await audit('resolver_solicitud', 'solicitud', String(id), { decision })
    revalidatePath('/vacaciones')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
