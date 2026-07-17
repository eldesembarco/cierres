// Tipos de dominio de la capa de datos. Independientes de Prisma para que el
// modo demo (sin base) comparta exactamente los mismos contratos que el modo
// conectado. Fechas siempre como ISO string (yyyy-mm-dd) para serializar RSC.

export type EstadoEmpleado = 'ONBOARDING' | 'ACTIVO' | 'EGRESADO'
export type EstadoDocumento = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
export type EstadoInvitacion = 'ENVIADA' | 'EN_CURSO' | 'COMPLETADA' | 'APROBADA' | 'EXPIRADA'
export type TipoSolicitud = 'VACACIONES' | 'ESTUDIO' | 'ENFERMEDAD' | 'HORAS_EXTRA' | 'OTRO'
export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

export interface CatalogoItem {
  id: number
  nombre: string
  activo?: boolean
}

export interface Marca extends CatalogoItem {
  color: string
}

export interface Locacion extends CatalogoItem {
  marcaId: number | null
  marca: string | null
  marcaColor: string | null
  tipo: 'LOCAL' | 'OFICINA' | 'PLANTA'
  direccion: string | null
}

export interface Posicion extends CatalogoItem {
  departamentoId: number | null
  departamento: string | null
  convenio: string | null
  documentosRequeridos: number[] // ids de DocumentoTipo
}

export interface DocumentoTipo extends CatalogoItem {
  requiereVencimiento: boolean
}

export interface EmpleadoResumen {
  id: number
  legajo: number | null
  nombreCompleto: string
  cuil: string | null
  email: string | null
  telefono: string | null
  empresa: string | null
  empresaId: number | null
  locacion: string | null
  locacionId: number | null
  marca: string | null
  marcaColor: string | null
  departamento: string | null
  departamentoId: number | null
  posicion: string | null
  posicionId: number | null
  convenio: string | null
  estado: EstadoEmpleado
  fechaIngreso: string | null
  fechaEgreso: string | null
  antiguedadMeses: number | null
  fotoUrl: string | null
  reportaAId: number | null
  docsPendientes: number
  docsPorVencer: number
}

export interface EmpleadoDetalle extends EmpleadoResumen {
  dni: string | null
  fechaNacimiento: string | null
  nacionalidad: string | null
  estadoCivil: string | null
  direccion: string | null
  pisoDpto: string | null
  localidad: string | null
  cp: string | null
  cbu: string | null
  emergenciaNombre: string | null
  emergenciaTelefono: string | null
  emergenciaRelacion: string | null
  obraSocial: string | null
  art: string | null
  motivoEgreso: string | null
  notas: string | null
  reportaA: { id: number; nombreCompleto: string; posicion: string | null } | null
  reportes: { id: number; nombreCompleto: string; posicion: string | null; locacion: string | null }[]
  historial: HistorialPuesto[]
  documentos: Documento[]
  saldos: VacacionSaldo[]
  solicitudes: Solicitud[]
}

export interface HistorialPuesto {
  id: number
  posicion: string
  departamento: string | null
  salario: number | null
  desde: string
  hasta: string | null
}

export interface Documento {
  id: number
  empleadoId: number
  empleado: string
  empleadoLocacion: string | null
  tipoId: number
  tipo: string
  archivoUrl: string | null
  archivoNombre: string | null
  vencimiento: string | null
  diasAlVencimiento: number | null
  estado: EstadoDocumento
  observacion: string | null
  subidoEn: string
}

export interface Invitacion {
  id: number
  token: string
  email: string
  nombre: string | null
  posicion: string | null
  posicionId: number | null
  locacion: string | null
  locacionId: number | null
  estado: EstadoInvitacion
  empleadoId: number | null
  creadaEn: string
  expiraEn: string
}

export interface VacacionSaldo {
  id: number
  empleadoId: number
  anio: number
  diasCorrespondientes: number
  diasTomados: number
}

export interface Solicitud {
  id: number
  empleadoId: number
  empleado: string
  empleadoLocacion: string | null
  tipo: TipoSolicitud
  desde: string
  hasta: string
  dias: number
  estado: EstadoSolicitud
  observacion: string | null
  creadaEn: string
}

export interface OrgNode {
  id: number
  nombreCompleto: string
  posicion: string | null
  locacion: string | null
  marca: string | null
  marcaColor: string | null
  fotoUrl: string | null
  vacante?: boolean
  hijos: OrgNode[]
}

export interface DashboardData {
  kpis: {
    activos: number
    altasMes: number
    bajasMes: number
    rotacionAnualPct: number
    docsPendientes: number
    docsPorVencer: number
    onboardingEnCurso: number
    solicitudesPendientes: number
  }
  dotacionPorLocacion: { locacion: string; marca: string | null; color: string; count: number }[]
  dotacionPorMarca: { marca: string; color: string; count: number }[]
  dotacionPorDepartamento: { departamento: string; count: number }[]
  altasBajasPorMes: { mes: string; altas: number; bajas: number }[]
  proximosVencimientos: Documento[]
  antiguedadDistribucion: { rango: string; count: number }[]
  cumpleanosDelMes: { id: number; nombreCompleto: string; fecha: string; locacion: string | null }[]
}

export interface Filtros {
  q?: string
  empresaId?: number
  locacionId?: number
  departamentoId?: number
  marcaId?: number
  estado?: EstadoEmpleado | 'TODOS'
}

export interface Catalogos {
  empresas: CatalogoItem[]
  marcas: Marca[]
  locaciones: Locacion[]
  departamentos: CatalogoItem[]
  posiciones: Posicion[]
  documentoTipos: DocumentoTipo[]
}
