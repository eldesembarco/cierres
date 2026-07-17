// Dataset de ejemplo del MODO DEMO (sin DATABASE_URL). Determinístico: mismo
// seed → mismos datos, con fechas relativas a hoy para que vencimientos,
// altas/bajas y cumpleaños siempre se vean vivos.
import type {
  CatalogoItem, Catalogos, DocumentoTipo, Documento, EmpleadoDetalle,
  EmpleadoResumen, EstadoDocumento, EstadoEmpleado, HistorialPuesto, Invitacion,
  Locacion, Marca, OrgNode, Posicion, Solicitud, VacacionSaldo,
} from './types'

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const hoy = () => new Date()
const addDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
const mesesEntre = (desde: Date, hasta: Date) =>
  Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / (30.44 * 86400000)))

// ── Catálogos ────────────────────────────────────────────────────────────────

export const demoEmpresas: CatalogoItem[] = [
  { id: 1, nombre: 'Cloud Managment Capital SRL' },
  { id: 2, nombre: 'Desembarco Burgers SA' },
  { id: 3, nombre: 'Tasty Foods SRL' },
]

export const demoMarcas: Marca[] = [
  { id: 1, nombre: 'Desembarco', color: '#e8590c' },
  { id: 2, nombre: 'Mr. Tasty', color: '#e0a100' },
  { id: 3, nombre: 'Mila & Go', color: '#2f9e44' },
]

const localNames: [string, number][] = [
  ['Recoleta', 1], ['Palermo', 1], ['Belgrano', 1], ['Devoto', 1], ['Caballito', 1],
  ['San Telmo', 1], ['Núñez', 1], ['Villa Urquiza', 1], ['Colegiales', 1], ['Almagro', 1],
  ['Mrt Belgrano', 2], ['Mrt Devoto', 2], ['Mrt Flores', 2], ['Mrt Avellaneda', 2], ['Mrt Morón', 2],
  ['Mila Palermo', 3], ['Mila Caballito', 3], ['Mila Martínez', 3],
]

export const demoLocaciones: Locacion[] = [
  ...localNames.map(([nombre, marcaId], i) => ({
    id: i + 1,
    nombre,
    marcaId,
    marca: demoMarcas[marcaId - 1].nombre,
    marcaColor: demoMarcas[marcaId - 1].color,
    tipo: 'LOCAL' as const,
    direccion: null,
    activo: true,
  })),
  { id: 19, nombre: 'Oficina Central', marcaId: null, marca: null, marcaColor: null, tipo: 'OFICINA', direccion: 'CABA', activo: true },
]

export const demoDepartamentos: CatalogoItem[] = [
  { id: 1, nombre: 'Locales Propios' },
  { id: 2, nombre: 'Administración' },
  { id: 3, nombre: 'Operaciones' },
  { id: 4, nombre: 'Marketing' },
  { id: 5, nombre: 'RRHH' },
]

export const demoDocumentoTipos: DocumentoTipo[] = [
  { id: 1, nombre: 'DNI', requiereVencimiento: false },
  { id: 2, nombre: 'Alta temprana ARCA', requiereVencimiento: false },
  { id: 3, nombre: 'Carnet de manipulación de alimentos', requiereVencimiento: true },
  { id: 4, nombre: 'Licencia de conducir', requiereVencimiento: true },
  { id: 5, nombre: 'Certificado médico preocupacional', requiereVencimiento: false },
  { id: 6, nombre: 'Constancia de CBU', requiereVencimiento: false },
  { id: 7, nombre: 'Libreta sanitaria', requiereVencimiento: true },
]

export const demoPosiciones: Posicion[] = [
  { id: 1, nombre: 'Director/a General', departamentoId: 3, departamento: 'Operaciones', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2] },
  { id: 2, nombre: 'Gerente de Operaciones', departamentoId: 3, departamento: 'Operaciones', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2] },
  { id: 3, nombre: 'Supervisor/a de Zona', departamentoId: 3, departamento: 'Operaciones', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2, 3] },
  { id: 4, nombre: 'Encargado/a de Local', departamentoId: 1, departamento: 'Locales Propios', convenio: 'UTHGRA', documentosRequeridos: [1, 2, 3, 7] },
  { id: 5, nombre: 'Cajero/a', departamentoId: 1, departamento: 'Locales Propios', convenio: 'UTHGRA', documentosRequeridos: [1, 2, 3] },
  { id: 6, nombre: 'Cocinero/a', departamentoId: 1, departamento: 'Locales Propios', convenio: 'UTHGRA', documentosRequeridos: [1, 2, 3, 7] },
  { id: 7, nombre: 'Parrillero/a', departamentoId: 1, departamento: 'Locales Propios', convenio: 'UTHGRA', documentosRequeridos: [1, 2, 3, 7] },
  { id: 8, nombre: 'Runner', departamentoId: 1, departamento: 'Locales Propios', convenio: 'UTHGRA', documentosRequeridos: [1, 2, 3] },
  { id: 9, nombre: 'Chofer de Reparto', departamentoId: 3, departamento: 'Operaciones', convenio: 'UTHGRA', documentosRequeridos: [1, 2, 4] },
  { id: 10, nombre: 'Analista de RRHH', departamentoId: 5, departamento: 'RRHH', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2] },
  { id: 11, nombre: 'Liquidador/a de Sueldos', departamentoId: 5, departamento: 'RRHH', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2] },
  { id: 12, nombre: 'Administrativo/a', departamentoId: 2, departamento: 'Administración', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2] },
  { id: 13, nombre: 'Community Manager', departamentoId: 4, departamento: 'Marketing', convenio: 'Fuera de convenio', documentosRequeridos: [1, 2] },
]

// ── Empleados ────────────────────────────────────────────────────────────────

const nombres = ['María', 'Juan', 'Lucía', 'Franco', 'Camila', 'Nicolás', 'Sofía', 'Matías', 'Valentina', 'Joaquín', 'Martina', 'Bruno', 'Agustina', 'Tomás', 'Julieta', 'Lautaro', 'Milagros', 'Facundo', 'Abril', 'Santiago', 'Carla', 'Ramiro', 'Florencia', 'Iván', 'Rocío', 'Gonzalo', 'Belén', 'Ezequiel', 'Antonella', 'Federico', 'Daniela', 'Marcos', 'Paula', 'Leandro', 'Micaela', 'Damián']
const apellidos = ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Sánchez', 'Romero', 'Sosa', 'Torres', 'Álvarez', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Giménez', 'Molina', 'Silva', 'Castro', 'Rojas', 'Ortiz', 'Núñez', 'Luna', 'Cabrera', 'Ríos', 'Morales', 'Godoy', 'Vega', 'Campos', 'Ferreyra', 'Ponce', 'Quiroga']
const obras = ['OSDE', 'Swiss Medical', 'OSUTHGRA', 'Galeno', 'Medifé', 'OSECAC']
const localidades = ['CABA', 'Avellaneda', 'Lanús', 'Morón', 'San Martín', 'Quilmes', 'Vicente López', 'La Matanza']

interface Row {
  resumen: EmpleadoResumen
  detalle: EmpleadoDetalle
}

function construir(): {
  filas: Row[]
  documentos: Documento[]
  solicitudes: Solicitud[]
  invitaciones: Invitacion[]
} {
  const rnd = mulberry32(20260717)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const now = hoy()
  const filas: Row[] = []
  const documentos: Documento[] = []
  const solicitudes: Solicitud[] = []
  let docId = 1
  let solId = 1
  let histId = 1
  let saldoId = 1

  const empresaDeMarca = (marcaId: number | null) => (marcaId === 2 ? 3 : marcaId === 3 ? 2 : 1)

  function agregar(opts: {
    id: number; posicionId: number; locacionId: number | null; reportaAId: number | null
    estado?: EstadoEmpleado; ingresoMesesAtras: number; egresoDiasAtras?: number
  }): Row {
    const pos = demoPosiciones.find(p => p.id === opts.posicionId)!
    const loc = opts.locacionId ? demoLocaciones.find(l => l.id === opts.locacionId)! : null
    const nombre = `${pick(nombres)} ${pick(apellidos)}`
    const ingreso = addDias(now, -Math.round(opts.ingresoMesesAtras * 30.44 + rnd() * 20))
    const estado: EstadoEmpleado = opts.estado ?? 'ACTIVO'
    const egreso = estado === 'EGRESADO' ? addDias(now, -(opts.egresoDiasAtras ?? Math.floor(rnd() * 300) + 10)) : null
    const nacimiento = addDias(now, -(365 * (20 + Math.floor(rnd() * 25)) + Math.floor(rnd() * 365)))
    const empresaId = empresaDeMarca(loc?.marcaId ?? null)
    const empresa = demoEmpresas.find(e => e.id === empresaId)!
    const dni = String(20000000 + Math.floor(rnd() * 25000000))
    const cuil = `${rnd() > 0.5 ? 20 : 27}${dni}${Math.floor(rnd() * 10)}`
    const slug = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').split(' ')
    const email = `${slug[0]}${slug[1] ?? ''}${Math.floor(rnd() * 90) + 10}@gmail.com`

    const historial: HistorialPuesto[] = [{
      id: histId++, posicion: pos.nombre, departamento: pos.departamento,
      salario: null, desde: iso(ingreso), hasta: egreso ? iso(egreso) : null,
    }]
    if (rnd() > 0.72 && opts.posicionId >= 5 && opts.posicionId <= 8) {
      const antes = addDias(ingreso, -Math.floor(rnd() * 400 + 200))
      historial.unshift({ id: histId++, posicion: 'Runner', departamento: 'Locales Propios', salario: null, desde: iso(antes), hasta: iso(ingreso) })
    }

    const saldos: VacacionSaldo[] = estado === 'ACTIVO' ? [
      { id: saldoId++, empleadoId: opts.id, anio: now.getFullYear() - 1, diasCorrespondientes: 14, diasTomados: Math.min(14, Math.floor(rnd() * 15)) },
      { id: saldoId++, empleadoId: opts.id, anio: now.getFullYear(), diasCorrespondientes: mesesEntre(ingreso, now) > 60 ? 21 : 14, diasTomados: Math.floor(rnd() * 8) },
    ] : []

    // Documentos del legajo según reglas de la posición
    const docs: Documento[] = []
    for (const tipoId of pos.documentosRequeridos) {
      const tipo = demoDocumentoTipos.find(t => t.id === tipoId)!
      const r = rnd()
      let estadoDoc: EstadoDocumento = 'APROBADO'
      let archivo = true
      if (estado === 'ONBOARDING') { estadoDoc = r > 0.4 ? 'PENDIENTE' : 'APROBADO'; archivo = r > 0.2 }
      else if (r > 0.9) { estadoDoc = 'PENDIENTE' }
      else if (r > 0.86) { estadoDoc = 'RECHAZADO' }
      let vencimiento: string | null = null
      let diasAlVenc: number | null = null
      if (tipo.requiereVencimiento && archivo) {
        const dias = Math.floor(rnd() * 540) - 40 // algunos ya vencidos, varios por vencer
        vencimiento = iso(addDias(now, dias))
        diasAlVenc = dias
      }
      const doc: Documento = {
        id: docId++, empleadoId: opts.id, empleado: nombre, empleadoLocacion: loc?.nombre ?? 'Oficina Central',
        tipoId, tipo: tipo.nombre,
        archivoUrl: archivo ? '#' : null,
        archivoNombre: archivo ? `${tipo.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf` : null,
        vencimiento, diasAlVencimiento: diasAlVenc, estado: estadoDoc,
        observacion: estadoDoc === 'RECHAZADO' ? 'Ilegible, volver a subir' : null,
        subidoEn: iso(addDias(ingreso, Math.floor(rnd() * 10))),
      }
      docs.push(doc)
      if (estado !== 'EGRESADO') documentos.push(doc)
    }

    // Solicitudes
    if (estado === 'ACTIVO' && rnd() > 0.6) {
      const tipos: Solicitud['tipo'][] = ['VACACIONES', 'VACACIONES', 'ENFERMEDAD', 'ESTUDIO']
      const t = pick(tipos)
      const desde = addDias(now, Math.floor(rnd() * 40) - 15)
      const dias = t === 'VACACIONES' ? 7 + Math.floor(rnd() * 8) : 1 + Math.floor(rnd() * 3)
      const sol: Solicitud = {
        id: solId++, empleadoId: opts.id, empleado: nombre, empleadoLocacion: loc?.nombre ?? 'Oficina Central',
        tipo: t, desde: iso(desde), hasta: iso(addDias(desde, dias - 1)), dias,
        estado: desde < now ? (rnd() > 0.2 ? 'APROBADA' : 'RECHAZADA') : rnd() > 0.5 ? 'PENDIENTE' : 'APROBADA',
        observacion: null, creadaEn: iso(addDias(desde, -Math.floor(rnd() * 15) - 3)),
      }
      solicitudes.push(sol)
    }

    const resumen: EmpleadoResumen = {
      id: opts.id, legajo: 100 + opts.id, nombreCompleto: nombre, cuil, email,
      telefono: `11${Math.floor(rnd() * 90000000 + 10000000)}`,
      empresa: empresa.nombre, empresaId,
      locacion: loc?.nombre ?? 'Oficina Central', locacionId: opts.locacionId ?? 19,
      marca: loc?.marca ?? null, marcaColor: loc?.marcaColor ?? null,
      departamento: pos.departamento, departamentoId: pos.departamentoId,
      posicion: pos.nombre, posicionId: pos.id, convenio: pos.convenio,
      estado, fechaIngreso: iso(ingreso), fechaEgreso: egreso ? iso(egreso) : null,
      antiguedadMeses: mesesEntre(ingreso, egreso ?? now), fotoUrl: null,
      reportaAId: opts.reportaAId,
      docsPendientes: docs.filter(d => d.estado === 'PENDIENTE' || d.estado === 'RECHAZADO').length,
      docsPorVencer: docs.filter(d => d.diasAlVencimiento !== null && d.diasAlVencimiento <= 30).length,
    }
    const detalle: EmpleadoDetalle = {
      ...resumen,
      dni, fechaNacimiento: iso(nacimiento), nacionalidad: rnd() > 0.15 ? 'Argentina' : pick(['Paraguaya', 'Venezolana', 'Peruana', 'Boliviana']),
      estadoCivil: pick(['Soltero/a', 'Soltero/a', 'Casado/a', 'Concubinato']),
      direccion: `${pick(apellidos)} ${Math.floor(rnd() * 4000) + 100}`, pisoDpto: rnd() > 0.7 ? `${Math.floor(rnd() * 8) + 1}º ${pick(['A', 'B', 'C'])}` : null,
      localidad: pick(localidades), cp: String(1000 + Math.floor(rnd() * 900)),
      cbu: `00000031000${Math.floor(rnd() * 1e10).toString().padStart(11, '0')}`,
      emergenciaNombre: pick(nombres), emergenciaTelefono: `11${Math.floor(rnd() * 90000000 + 10000000)}`,
      emergenciaRelacion: pick(['Madre', 'Padre', 'Pareja', 'Hermano/a']),
      obraSocial: pick(obras), art: 'Provincia ART',
      motivoEgreso: estado === 'EGRESADO' ? pick(['Renuncia', 'Renuncia', 'Mutuo acuerdo', 'Fin de contrato']) : null,
      notas: null,
      reportaA: null, reportes: [], historial, documentos: docs, saldos, solicitudes: solicitudes.filter(s => s.empleadoId === opts.id),
    }
    const row = { resumen, detalle }
    filas.push(row)
    return row
  }

  let id = 1
  // Cúpula
  const director = agregar({ id: id++, posicionId: 1, locacionId: null, reportaAId: null, ingresoMesesAtras: 96 })
  const gteOps = agregar({ id: id++, posicionId: 2, locacionId: null, reportaAId: director.resumen.id, ingresoMesesAtras: 70 })
  const rrhh1 = agregar({ id: id++, posicionId: 10, locacionId: null, reportaAId: director.resumen.id, ingresoMesesAtras: 40 })
  agregar({ id: id++, posicionId: 11, locacionId: null, reportaAId: rrhh1.resumen.id, ingresoMesesAtras: 25 })
  agregar({ id: id++, posicionId: 12, locacionId: null, reportaAId: director.resumen.id, ingresoMesesAtras: 55 })
  agregar({ id: id++, posicionId: 13, locacionId: null, reportaAId: director.resumen.id, ingresoMesesAtras: 18 })
  // Supervisores de zona
  const sup1 = agregar({ id: id++, posicionId: 3, locacionId: null, reportaAId: gteOps.resumen.id, ingresoMesesAtras: 58 })
  const sup2 = agregar({ id: id++, posicionId: 3, locacionId: null, reportaAId: gteOps.resumen.id, ingresoMesesAtras: 44 })
  const sup3 = agregar({ id: id++, posicionId: 3, locacionId: null, reportaAId: gteOps.resumen.id, ingresoMesesAtras: 31 })
  const supervisores = [sup1, sup2, sup3]
  // Choferes
  agregar({ id: id++, posicionId: 9, locacionId: null, reportaAId: gteOps.resumen.id, ingresoMesesAtras: 20 })
  agregar({ id: id++, posicionId: 9, locacionId: null, reportaAId: gteOps.resumen.id, ingresoMesesAtras: 9 })

  // Locales: encargado + staff
  demoLocaciones.filter(l => l.tipo === 'LOCAL').forEach((loc, i) => {
    const sup = supervisores[i % 3]
    const enc = agregar({ id: id++, posicionId: 4, locacionId: loc.id, reportaAId: sup.resumen.id, ingresoMesesAtras: 12 + Math.floor(rnd() * 48) })
    const staffPosiciones = [5, 6, 7, 8]
    const staffCount = 3 + Math.floor(rnd() * 3) // 3 a 5 por local
    for (let s = 0; s < staffCount; s++) {
      const r = rnd()
      const estado: EstadoEmpleado = r > 0.94 ? 'ONBOARDING' : r > 0.82 ? 'EGRESADO' : 'ACTIVO'
      agregar({
        id: id++, posicionId: staffPosiciones[Math.floor(rnd() * staffPosiciones.length)],
        locacionId: loc.id, reportaAId: enc.resumen.id,
        estado, ingresoMesesAtras: estado === 'ONBOARDING' ? 0 : 1 + Math.floor(rnd() * 40),
      })
    }
  })

  // Cross-links de jerarquía en detalle
  const porId = new Map(filas.map(f => [f.resumen.id, f]))
  for (const f of filas) {
    const jefe = f.resumen.reportaAId ? porId.get(f.resumen.reportaAId) : null
    if (jefe) f.detalle.reportaA = { id: jefe.resumen.id, nombreCompleto: jefe.resumen.nombreCompleto, posicion: jefe.resumen.posicion }
    f.detalle.reportes = filas
      .filter(x => x.resumen.reportaAId === f.resumen.id && x.resumen.estado !== 'EGRESADO')
      .map(x => ({ id: x.resumen.id, nombreCompleto: x.resumen.nombreCompleto, posicion: x.resumen.posicion, locacion: x.resumen.locacion }))
  }

  // Invitaciones de onboarding
  const invitaciones: Invitacion[] = []
  const onboardings = filas.filter(f => f.resumen.estado === 'ONBOARDING')
  let invId = 1
  for (const f of onboardings) {
    invitaciones.push({
      id: invId++, token: `demo-${f.resumen.id}`, email: f.resumen.email ?? '',
      nombre: f.resumen.nombreCompleto, posicion: f.resumen.posicion, posicionId: f.resumen.posicionId,
      locacion: f.resumen.locacion, locacionId: f.resumen.locacionId,
      estado: 'COMPLETADA', empleadoId: f.resumen.id,
      creadaEn: iso(addDias(now, -6)), expiraEn: iso(addDias(now, 8)),
    })
  }
  invitaciones.push(
    { id: invId++, token: 'demo-nuevo-1', email: 'candidato.parrilla@gmail.com', nombre: 'Kevin Barrios', posicion: 'Parrillero/a', posicionId: 7, locacion: 'Palermo', locacionId: 2, estado: 'ENVIADA', empleadoId: null, creadaEn: iso(addDias(now, -2)), expiraEn: iso(addDias(now, 12)) },
    { id: invId++, token: 'demo-nuevo-2', email: 'caja.devoto@gmail.com', nombre: null, posicion: 'Cajero/a', posicionId: 5, locacion: 'Devoto', locacionId: 4, estado: 'EN_CURSO', empleadoId: null, creadaEn: iso(addDias(now, -4)), expiraEn: iso(addDias(now, 10)) },
    { id: invId++, token: 'demo-vencida', email: 'runner.nunez@gmail.com', nombre: null, posicion: 'Runner', posicionId: 8, locacion: 'Núñez', locacionId: 7, estado: 'EXPIRADA', empleadoId: null, creadaEn: iso(addDias(now, -40)), expiraEn: iso(addDias(now, -26)) },
  )

  return { filas, documentos, solicitudes, invitaciones }
}

// Cache por proceso (estable dentro de la sesión del server)
let cache: ReturnType<typeof construir> | null = null
export function demoData() {
  if (!cache) cache = construir()
  return cache
}

export function demoCatalogos(): Catalogos {
  return {
    empresas: demoEmpresas,
    marcas: demoMarcas,
    locaciones: demoLocaciones,
    departamentos: demoDepartamentos,
    posiciones: demoPosiciones,
    documentoTipos: demoDocumentoTipos,
  }
}

export function demoOrganigrama(): OrgNode {
  const { filas } = demoData()
  const build = (id: number): OrgNode => {
    const f = filas.find(x => x.resumen.id === id)!
    return {
      id, nombreCompleto: f.resumen.nombreCompleto, posicion: f.resumen.posicion,
      locacion: f.resumen.locacion, marca: f.resumen.marca, marcaColor: f.resumen.marcaColor,
      fotoUrl: null,
      hijos: filas
        .filter(x => x.resumen.reportaAId === id && x.resumen.estado !== 'EGRESADO')
        .map(x => build(x.resumen.id)),
    }
  }
  const root = filas.find(f => f.resumen.reportaAId === null)!
  return build(root.resumen.id)
}
