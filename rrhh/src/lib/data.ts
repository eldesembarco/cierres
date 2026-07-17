// Capa de datos (server-only). Cada función resuelve contra la base (Prisma)
// o contra los fixtures del modo demo — mismo contrato en ambos casos.
import 'server-only'
import { getPrisma, isDemo } from './db'
import { demoCatalogos, demoData, demoOrganigrama } from './demo'
import { diasDesdeHoy, hoyIso } from './format'
import type {
  Catalogos, DashboardData, Documento, EmpleadoDetalle, EmpleadoResumen,
  Filtros, Invitacion, OrgNode, Solicitud,
} from './types'

export { isDemo }

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

function mesesEntre(desdeIso: string | null, hastaIso: string | null): number | null {
  if (!desdeIso) return null
  const desde = new Date(desdeIso)
  const hasta = hastaIso ? new Date(hastaIso) : new Date()
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / (30.44 * 86400000)))
}

// Include estándar para armar un EmpleadoResumen desde Prisma
const includeResumen = {
  empresa: true,
  locacion: { include: { marca: true } },
  departamento: true,
  posicion: true,
  documentos: { select: { estado: true, vencimiento: true } },
} as const

type EmpleadoRow = {
  id: number; legajo: number | null; nombreCompleto: string; cuil: string | null
  email: string | null; telefono: string | null; convenio: string | null
  estado: 'ONBOARDING' | 'ACTIVO' | 'EGRESADO'
  fechaIngreso: Date | null; fechaEgreso: Date | null; fotoUrl: string | null
  reportaAId: number | null
  empresa: { id: number; nombre: string } | null
  locacion: { id: number; nombre: string; marca: { nombre: string; color: string | null } | null } | null
  departamento: { id: number; nombre: string } | null
  posicion: { id: number; nombre: string } | null
  documentos: { estado: string; vencimiento: Date | null }[]
}

function aResumen(e: EmpleadoRow): EmpleadoResumen {
  const ingreso = iso(e.fechaIngreso)
  const egreso = iso(e.fechaEgreso)
  return {
    id: e.id, legajo: e.legajo, nombreCompleto: e.nombreCompleto, cuil: e.cuil,
    email: e.email, telefono: e.telefono,
    empresa: e.empresa?.nombre ?? null, empresaId: e.empresa?.id ?? null,
    locacion: e.locacion?.nombre ?? null, locacionId: e.locacion?.id ?? null,
    marca: e.locacion?.marca?.nombre ?? null, marcaColor: e.locacion?.marca?.color ?? null,
    departamento: e.departamento?.nombre ?? null, departamentoId: e.departamento?.id ?? null,
    posicion: e.posicion?.nombre ?? null, posicionId: e.posicion?.id ?? null,
    convenio: e.convenio, estado: e.estado,
    fechaIngreso: ingreso, fechaEgreso: egreso,
    antiguedadMeses: mesesEntre(ingreso, egreso),
    fotoUrl: e.fotoUrl, reportaAId: e.reportaAId,
    docsPendientes: e.documentos.filter(d => d.estado === 'PENDIENTE' || d.estado === 'RECHAZADO').length,
    docsPorVencer: e.documentos.filter(d => d.vencimiento && diasDesdeHoy(iso(d.vencimiento)!) <= 30).length,
  }
}

// ── Catálogos ────────────────────────────────────────────────────────────────

export async function getCatalogos(): Promise<Catalogos> {
  if (isDemo()) return demoCatalogos()
  const p = getPrisma()
  const [empresas, marcas, locaciones, departamentos, posiciones, documentoTipos] = await Promise.all([
    p.empresa.findMany({ orderBy: { nombre: 'asc' } }),
    p.marca.findMany({ orderBy: { nombre: 'asc' } }),
    p.locacion.findMany({ include: { marca: true }, orderBy: { nombre: 'asc' } }),
    p.departamento.findMany({ orderBy: { nombre: 'asc' } }),
    p.posicion.findMany({ include: { departamento: true, documentosRequeridos: true }, orderBy: { nombre: 'asc' } }),
    p.documentoTipo.findMany({ orderBy: { nombre: 'asc' } }),
  ])
  return {
    empresas: empresas.map(e => ({ id: e.id, nombre: e.nombre, activo: e.activo })),
    marcas: marcas.map(m => ({ id: m.id, nombre: m.nombre, color: m.color ?? '#888', activo: m.activo })),
    locaciones: locaciones.map(l => ({
      id: l.id, nombre: l.nombre, marcaId: l.marcaId, marca: l.marca?.nombre ?? null,
      marcaColor: l.marca?.color ?? null, tipo: l.tipo as 'LOCAL' | 'OFICINA' | 'PLANTA',
      direccion: l.direccion, activo: l.activo,
    })),
    departamentos: departamentos.map(d => ({ id: d.id, nombre: d.nombre, activo: d.activo })),
    posiciones: posiciones.map(pos => ({
      id: pos.id, nombre: pos.nombre, departamentoId: pos.departamentoId,
      departamento: pos.departamento?.nombre ?? null, convenio: pos.convenio,
      documentosRequeridos: pos.documentosRequeridos.map(r => r.documentoTipoId),
      activo: pos.activo,
    })),
    documentoTipos: documentoTipos.map(t => ({
      id: t.id, nombre: t.nombre, requiereVencimiento: t.requiereVencimiento, activo: t.activo,
    })),
  }
}

// ── Empleados ────────────────────────────────────────────────────────────────

export async function getEmpleados(filtros: Filtros = {}): Promise<EmpleadoResumen[]> {
  let lista: EmpleadoResumen[]
  if (isDemo()) {
    lista = demoData().filas.map(f => f.resumen)
  } else {
    const rows = await getPrisma().empleado.findMany({
      include: includeResumen,
      orderBy: { nombreCompleto: 'asc' },
    })
    lista = rows.map(aResumen)
  }
  const q = filtros.q?.trim().toLowerCase()
  return lista.filter(e => {
    if (q && !(`${e.nombreCompleto} ${e.cuil ?? ''} ${e.email ?? ''} ${e.posicion ?? ''}`.toLowerCase().includes(q))) return false
    if (filtros.empresaId && e.empresaId !== filtros.empresaId) return false
    if (filtros.locacionId && e.locacionId !== filtros.locacionId) return false
    if (filtros.departamentoId && e.departamentoId !== filtros.departamentoId) return false
    if (filtros.estado && filtros.estado !== 'TODOS' && e.estado !== filtros.estado) return false
    if (!filtros.estado && e.estado === 'EGRESADO') return false
    return true
  })
}

export async function getEmpleado(id: number): Promise<EmpleadoDetalle | null> {
  if (isDemo()) {
    return demoData().filas.find(f => f.resumen.id === id)?.detalle ?? null
  }
  const p = getPrisma()
  const e = await p.empleado.findUnique({
    where: { id },
    include: {
      ...includeResumen,
      reportaA: { include: { posicion: true } },
      reportes: { where: { estado: { not: 'EGRESADO' } }, include: { posicion: true, locacion: true } },
      historial: { orderBy: { desde: 'desc' } },
      documentos: { include: { tipo: true }, orderBy: { subidoEn: 'desc' } },
      saldosVacaciones: { orderBy: { anio: 'desc' } },
      solicitudes: { orderBy: { creadaEn: 'desc' } },
    },
  })
  if (!e) return null
  const base = aResumen(e)
  return {
    ...base,
    dni: e.dni, fechaNacimiento: iso(e.fechaNacimiento), nacionalidad: e.nacionalidad,
    estadoCivil: e.estadoCivil, direccion: e.direccion, pisoDpto: e.pisoDpto,
    localidad: e.localidad, cp: e.cp, cbu: e.cbu,
    emergenciaNombre: e.emergenciaNombre, emergenciaTelefono: e.emergenciaTelefono,
    emergenciaRelacion: e.emergenciaRelacion, obraSocial: e.obraSocial, art: e.art,
    motivoEgreso: e.motivoEgreso, notas: e.notas,
    reportaA: e.reportaA
      ? { id: e.reportaA.id, nombreCompleto: e.reportaA.nombreCompleto, posicion: e.reportaA.posicion?.nombre ?? null }
      : null,
    reportes: e.reportes.map(r => ({
      id: r.id, nombreCompleto: r.nombreCompleto,
      posicion: r.posicion?.nombre ?? null, locacion: r.locacion?.nombre ?? null,
    })),
    historial: e.historial.map(h => ({
      id: h.id, posicion: h.posicion, departamento: h.departamento,
      salario: h.salario ? Number(h.salario) : null, desde: iso(h.desde)!, hasta: iso(h.hasta),
    })),
    documentos: e.documentos.map(d => ({
      id: d.id, empleadoId: d.empleadoId, empleado: e.nombreCompleto,
      empleadoLocacion: e.locacion?.nombre ?? null,
      tipoId: d.tipoId, tipo: d.tipo.nombre, archivoUrl: d.archivoUrl, archivoNombre: d.archivoNombre,
      vencimiento: iso(d.vencimiento),
      diasAlVencimiento: d.vencimiento ? diasDesdeHoy(iso(d.vencimiento)!) : null,
      estado: d.estado, observacion: d.observacion, subidoEn: iso(d.subidoEn)!,
    })),
    saldos: e.saldosVacaciones.map(s => ({
      id: s.id, empleadoId: s.empleadoId, anio: s.anio,
      diasCorrespondientes: s.diasCorrespondientes, diasTomados: s.diasTomados,
    })),
    solicitudes: e.solicitudes.map(s => ({
      id: s.id, empleadoId: s.empleadoId, empleado: e.nombreCompleto,
      empleadoLocacion: e.locacion?.nombre ?? null, tipo: s.tipo,
      desde: iso(s.desde)!, hasta: iso(s.hasta)!, dias: s.dias, estado: s.estado,
      observacion: s.observacion, creadaEn: iso(s.creadaEn)!,
    })),
  }
}

// ── Organigrama ──────────────────────────────────────────────────────────────

export async function getOrganigrama(): Promise<OrgNode | null> {
  if (isDemo()) return demoOrganigrama()
  const rows = await getPrisma().empleado.findMany({
    where: { estado: { not: 'EGRESADO' } },
    include: { posicion: true, locacion: { include: { marca: true } } },
  })
  const nodos = new Map<number, OrgNode>()
  for (const r of rows) {
    nodos.set(r.id, {
      id: r.id, nombreCompleto: r.nombreCompleto, posicion: r.posicion?.nombre ?? null,
      locacion: r.locacion?.nombre ?? null, marca: r.locacion?.marca?.nombre ?? null,
      marcaColor: r.locacion?.marca?.color ?? null, fotoUrl: r.fotoUrl, hijos: [],
    })
  }
  let root: OrgNode | null = null
  for (const r of rows) {
    const nodo = nodos.get(r.id)!
    if (r.reportaAId && nodos.has(r.reportaAId)) nodos.get(r.reportaAId)!.hijos.push(nodo)
    else if (!root) root = nodo
  }
  return root
}

// ── Documentos ───────────────────────────────────────────────────────────────

export async function getDocumentos(): Promise<Documento[]> {
  if (isDemo()) return demoData().documentos
  const rows = await getPrisma().documento.findMany({
    include: { tipo: true, empleado: { include: { locacion: true } } },
    where: { empleado: { estado: { not: 'EGRESADO' } } },
    orderBy: { subidoEn: 'desc' },
  })
  return rows.map(d => ({
    id: d.id, empleadoId: d.empleadoId, empleado: d.empleado.nombreCompleto,
    empleadoLocacion: d.empleado.locacion?.nombre ?? null,
    tipoId: d.tipoId, tipo: d.tipo.nombre, archivoUrl: d.archivoUrl, archivoNombre: d.archivoNombre,
    vencimiento: iso(d.vencimiento),
    diasAlVencimiento: d.vencimiento ? diasDesdeHoy(iso(d.vencimiento)!) : null,
    estado: d.estado, observacion: d.observacion, subidoEn: iso(d.subidoEn)!,
  }))
}

// ── Onboarding ───────────────────────────────────────────────────────────────

export async function getInvitaciones(): Promise<Invitacion[]> {
  if (isDemo()) return demoData().invitaciones
  const rows = await getPrisma().invitacion.findMany({
    include: { posicion: true, locacion: true },
    orderBy: { creadaEn: 'desc' },
  })
  return rows.map(i => ({
    id: i.id, token: i.token, email: i.email, nombre: i.nombre,
    posicion: i.posicion?.nombre ?? null, posicionId: i.posicionId,
    locacion: i.locacion?.nombre ?? null, locacionId: i.locacionId,
    estado: i.estado, empleadoId: i.empleadoId,
    creadaEn: iso(i.creadaEn)!, expiraEn: iso(i.expiraEn)!,
  }))
}

export async function getInvitacionByToken(token: string): Promise<Invitacion | null> {
  const lista = await getInvitaciones()
  return lista.find(i => i.token === token) ?? null
}

// ── Solicitudes ──────────────────────────────────────────────────────────────

export async function getSolicitudes(): Promise<Solicitud[]> {
  if (isDemo()) return demoData().solicitudes
  const rows = await getPrisma().solicitud.findMany({
    include: { empleado: { include: { locacion: true } } },
    orderBy: [{ estado: 'asc' }, { desde: 'desc' }],
  })
  return rows.map(s => ({
    id: s.id, empleadoId: s.empleadoId, empleado: s.empleado.nombreCompleto,
    empleadoLocacion: s.empleado.locacion?.nombre ?? null, tipo: s.tipo,
    desde: iso(s.desde)!, hasta: iso(s.hasta)!, dias: s.dias, estado: s.estado,
    observacion: s.observacion, creadaEn: iso(s.creadaEn)!,
  }))
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardData> {
  const [empleadosTodos, documentos, solicitudes, invitaciones] = await Promise.all([
    getEmpleados({ estado: 'TODOS' }),
    getDocumentos(),
    getSolicitudes(),
    getInvitaciones(),
  ])
  const hoy = hoyIso()
  const [anio, mes] = hoy.split('-').map(Number)
  const activos = empleadosTodos.filter(e => e.estado === 'ACTIVO')
  const esMesActual = (f: string | null) => !!f && f.startsWith(`${anio}-${String(mes).padStart(2, '0')}`)

  const altasMes = empleadosTodos.filter(e => esMesActual(e.fechaIngreso)).length
  const bajasMes = empleadosTodos.filter(e => esMesActual(e.fechaEgreso)).length
  const bajasUltimoAnio = empleadosTodos.filter(e => e.fechaEgreso && diasDesdeHoy(e.fechaEgreso) >= -365).length
  const rotacionAnualPct = activos.length ? Math.round((bajasUltimoAnio / activos.length) * 100) : 0

  const porLocacion = new Map<string, { locacion: string; marca: string | null; color: string; count: number }>()
  const porMarca = new Map<string, { marca: string; color: string; count: number }>()
  const porDepto = new Map<string, number>()
  for (const e of activos) {
    const locKey = e.locacion ?? 'Sin locación'
    const l = porLocacion.get(locKey) ?? { locacion: locKey, marca: e.marca, color: e.marcaColor ?? '#5f6b7a', count: 0 }
    l.count++; porLocacion.set(locKey, l)
    const marcaKey = e.marca ?? 'Estructura'
    const m = porMarca.get(marcaKey) ?? { marca: marcaKey, color: e.marcaColor ?? '#5f6b7a', count: 0 }
    m.count++; porMarca.set(marcaKey, m)
    const dKey = e.departamento ?? 'Sin departamento'
    porDepto.set(dKey, (porDepto.get(dKey) ?? 0) + 1)
  }

  // Altas/bajas por mes: últimos 12 meses
  const meses: { mes: string; altas: number; bajas: number }[] = []
  const nombresMes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  for (let i = 11; i >= 0; i--) {
    const d = new Date(anio!, (mes! - 1) - i, 1)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    meses.push({
      mes: nombresMes[d.getMonth()]!,
      altas: empleadosTodos.filter(e => e.fechaIngreso?.startsWith(clave)).length,
      bajas: empleadosTodos.filter(e => e.fechaEgreso?.startsWith(clave)).length,
    })
  }

  // Distribución de antigüedad
  const rangos: [string, (m: number) => boolean][] = [
    ['< 6 m', m => m < 6],
    ['6-12 m', m => m >= 6 && m < 12],
    ['1-2 a', m => m >= 12 && m < 24],
    ['2-5 a', m => m >= 24 && m < 60],
    ['5+ a', m => m >= 60],
  ]
  const antiguedadDistribucion = rangos.map(([rango, test]) => ({
    rango,
    count: activos.filter(e => e.antiguedadMeses !== null && test(e.antiguedadMeses)).length,
  }))

  const proximosVencimientos = documentos
    .filter(d => d.diasAlVencimiento !== null && d.diasAlVencimiento <= 45)
    .sort((a, b) => (a.diasAlVencimiento ?? 0) - (b.diasAlVencimiento ?? 0))
    .slice(0, 12)

  // Cumpleaños del mes (solo con detalle disponible en demo; en prod, query aparte)
  let cumpleanosDelMes: DashboardData['cumpleanosDelMes'] = []
  if (isDemo()) {
    cumpleanosDelMes = demoData().filas
      .filter(f => f.resumen.estado === 'ACTIVO' && f.detalle.fechaNacimiento?.slice(5, 7) === String(mes).padStart(2, '0'))
      .map(f => ({
        id: f.resumen.id, nombreCompleto: f.resumen.nombreCompleto,
        fecha: f.detalle.fechaNacimiento!, locacion: f.resumen.locacion,
      }))
      .sort((a, b) => a.fecha.slice(8).localeCompare(b.fecha.slice(8)))
  } else {
    const rows = await getPrisma().empleado.findMany({
      where: { estado: 'ACTIVO', fechaNacimiento: { not: null } },
      select: { id: true, nombreCompleto: true, fechaNacimiento: true, locacion: { select: { nombre: true } } },
    })
    cumpleanosDelMes = rows
      .filter(r => (r.fechaNacimiento!.getMonth() + 1) === mes)
      .map(r => ({
        id: r.id, nombreCompleto: r.nombreCompleto,
        fecha: iso(r.fechaNacimiento)!, locacion: r.locacion?.nombre ?? null,
      }))
      .sort((a, b) => a.fecha.slice(8).localeCompare(b.fecha.slice(8)))
  }

  return {
    kpis: {
      activos: activos.length,
      altasMes, bajasMes, rotacionAnualPct,
      docsPendientes: documentos.filter(d => d.estado === 'PENDIENTE' || d.estado === 'RECHAZADO').length,
      docsPorVencer: documentos.filter(d => d.diasAlVencimiento !== null && d.diasAlVencimiento >= 0 && d.diasAlVencimiento <= 30).length,
      onboardingEnCurso: invitaciones.filter(i => i.estado === 'ENVIADA' || i.estado === 'EN_CURSO' || i.estado === 'COMPLETADA').length,
      solicitudesPendientes: solicitudes.filter(s => s.estado === 'PENDIENTE').length,
    },
    dotacionPorLocacion: [...porLocacion.values()].sort((a, b) => b.count - a.count),
    dotacionPorMarca: [...porMarca.values()].sort((a, b) => b.count - a.count),
    dotacionPorDepartamento: [...porDepto.entries()].map(([departamento, count]) => ({ departamento, count })).sort((a, b) => b.count - a.count),
    altasBajasPorMes: meses,
    proximosVencimientos,
    antiguedadDistribucion,
    cumpleanosDelMes,
  }
}
