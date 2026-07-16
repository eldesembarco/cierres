// Capa de cache de datos (unstable_cache) para bajar el consumo de CPU en Vercel.
// Las páginas siguen siendo dinámicas (usan sesión/cookies), pero las consultas
// pesadas de Prisma + agregación se sirven desde el Data Cache, keyeadas por sus
// argumentos e invalidadas por tag desde las acciones que escriben.
// Referencia: guía "caching without cache components" de Next 16 (unstable_cache
// es la API bendecida cuando cacheComponents no está habilitado).
//
// IMPORTANTE: unstable_cache serializa el resultado (JSON) → acá solo se devuelven
// datos PLANOS (números/strings/null). Nada de Date ni Prisma.Decimal.
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { hoyAr } from '@/lib/fecha'
import { getDashboard, type DashboardData } from '@/lib/dashboard/getDashboard'
import { getSaldosFondoFijoTodos, getSaldoFondoFijo, type SaldoFondoFijo, type SaldoFondoFijoLocal } from '@/lib/cierre/getSaldoFondoFijo'
import { resumenAnuladas, type FiltroAnuladas, type ResumenAnuladas } from '@/lib/tango/anuladas'

// ---------- Tags ----------
export const tagCierre = (localId: number, fecha: string) => `cierre-${localId}-${fecha}`
export const TAG_DASHBOARD = 'dashboard'
export const TAG_FONDO_FIJO = 'fondo-fijo'
export const TAG_CTA_CTE = 'cta-cte'
export const TAG_ANULACIONES = 'anulaciones'
// Operaciones de MP parseadas del SFTP (ver src/lib/mp/operacionesMpDia.ts).
export const TAG_MP_SFTP = 'mp-sftp'

// ---------- Planilla de /cierres/[fecha] ----------
export interface PlanillaCierrePlano {
  turno: 'manana' | 'tarde'
  estado: string
  fondoFijo: number
  montoZ: number
  efectivoDepositado: number
  retiroFondoFijo: number
  notaCredito: number
  cantidadTickets: number | null
  nota: string | null
  ventas: { canal: string; monto: number }[]
  tarjetas: { tipo: string; monto: number; lote: string | null }[]
  detalles: { canal: string; referencia: string; importe: number }[]
  gastos: {
    tipo: string
    formaPago: string
    monto: number
    descripcion: string | null
    comprobanteId: number | null
    facturaNumero: string | null
    facturaTotal: number | null
    proveedorId: number | null
  }[]
  auditorias: { usuarioNombre: string; accion: string; observacion: string; creadoEn: string }[]
}

async function planillaData(localId: number, fecha: string): Promise<PlanillaCierrePlano[]> {
  const cierres = await prisma.cierre.findMany({
    where: { localId, fecha: new Date(fecha) },
    include: {
      ventas: true,
      tarjetas: true,
      detalles: true,
      gastos: true,
      auditorias: { orderBy: { creadoEn: 'desc' } },
    },
  })
  return cierres.map((c) => ({
    turno: c.turno as 'manana' | 'tarde',
    estado: c.estado,
    fondoFijo: Number(c.fondoFijo),
    montoZ: Number(c.montoZ),
    efectivoDepositado: Number(c.efectivoDepositado),
    retiroFondoFijo: Number(c.retiroFondoFijo),
    notaCredito: Number(c.notaCredito),
    cantidadTickets: c.cantidadTickets,
    nota: c.nota,
    ventas: c.ventas.map((v) => ({ canal: v.canal, monto: Number(v.monto) })),
    tarjetas: c.tarjetas.map((t) => ({ tipo: t.tipo, monto: Number(t.monto), lote: t.lote })),
    detalles: c.detalles.map((d) => ({ canal: d.canal, referencia: d.referencia, importe: Number(d.importe) })),
    gastos: c.gastos.map((g) => ({
      tipo: g.tipo,
      formaPago: g.formaPago,
      monto: Number(g.monto),
      descripcion: g.descripcion,
      comprobanteId: g.comprobanteId,
      facturaNumero: g.facturaNumero,
      facturaTotal: g.facturaTotal == null ? null : Number(g.facturaTotal),
      proveedorId: g.proveedorId,
    })),
    auditorias: c.auditorias.map((a) => ({
      usuarioNombre: a.usuarioNombre,
      accion: a.accion,
      observacion: a.observacion,
      creadoEn: a.creadoEn.toISOString(),
    })),
  }))
}

/**
 * Planilla cacheada. TTL: 60s para hoy (se edita en vivo; además guardar/reabrir
 * invalidan el tag) y 24h para fechas pasadas (solo cambian vía reapertura, que
 * también invalida el tag — incluidas las reaperturas por SQL directo, que deben
 * pegar a POST /api/revalidar).
 */
export function getPlanillaCached(localId: number, fecha: string): Promise<PlanillaCierrePlano[]> {
  const esHoy = fecha >= hoyAr()
  return unstable_cache(planillaData, ['planilla-v1'], {
    tags: [tagCierre(localId, fecha)],
    revalidate: esHoy ? 60 : 86_400,
  })(localId, fecha)
}

// ---------- Dashboard ----------
export function getDashboardCached(fecha: string): Promise<DashboardData> {
  return unstable_cache((f: string) => getDashboard(f), ['dashboard-v1'], {
    tags: [TAG_DASHBOARD],
    revalidate: 120,
  })(fecha)
}

// ---------- Fondo fijo ----------
export function getSaldosFondoFijoTodosCached(): Promise<SaldoFondoFijoLocal[]> {
  return unstable_cache(() => getSaldosFondoFijoTodos(), ['fondo-fijo-todos-v1'], {
    tags: [TAG_FONDO_FIJO],
    revalidate: 120,
  })()
}

export function getSaldoFondoFijoCached(localId: number): Promise<SaldoFondoFijo> {
  return unstable_cache((id: number) => getSaldoFondoFijo(id), ['fondo-fijo-local-v1'], {
    tags: [TAG_FONDO_FIJO],
    revalidate: 120,
  })(localId)
}

// ---------- Cuenta corriente ----------
export interface MovimientoCtaCtePlano {
  id: number
  fecha: string // ISO
  localNombre: string
  proveedorNombre: string | null
  concepto: string
  descripcion: string | null
  monto: number
  pagado: boolean
  pagadoEn: string | null
}

export interface CtaCtePageData {
  movs: MovimientoCtaCtePlano[]
  saldoPendiente: number
  totalPagado: number
}

async function ctaCteData(scopeLocalId: number | null): Promise<CtaCtePageData> {
  const movs = await prisma.movimientoCtaCte.findMany({
    where: scopeLocalId != null ? { localId: scopeLocalId } : {},
    include: { proveedor: true, local: true },
    orderBy: [{ pagado: 'asc' }, { fecha: 'desc' }, { id: 'desc' }],
  })
  const planos: MovimientoCtaCtePlano[] = movs.map((m) => ({
    id: m.id,
    fecha: m.fecha.toISOString(),
    localNombre: m.local.nombre,
    proveedorNombre: m.proveedor?.nombre ?? null,
    concepto: m.concepto,
    descripcion: m.descripcion,
    monto: Number(m.monto),
    pagado: m.pagado,
    pagadoEn: m.pagadoEn?.toISOString() ?? null,
  }))
  return {
    movs: planos,
    saldoPendiente: planos.filter((m) => !m.pagado).reduce((s, m) => s + m.monto, 0),
    totalPagado: planos.filter((m) => m.pagado).reduce((s, m) => s + m.monto, 0),
  }
}

export function getCtaCteCached(scopeLocalId: number | null): Promise<CtaCtePageData> {
  return unstable_cache(ctaCteData, ['cta-cte-v1'], {
    tags: [TAG_CTA_CTE],
    revalidate: 120,
  })(scopeLocalId)
}

// ---------- Anulaciones ----------
// resumenAnuladas ya devuelve datos planos (fechas como string ISO). Escriben:
// justificarAnulacion (updateTag) y el sync diario del BI, que corre en otra app
// → lo cubre el TTL; un resync manual puede invalidar vía POST /api/revalidar.
async function anuladasData(desde: string, hasta: string, localId: number | null): Promise<ResumenAnuladas> {
  return resumenAnuladas({ desde, hasta, localId: localId ?? undefined })
}

export function getResumenAnuladasCached(f: FiltroAnuladas): Promise<ResumenAnuladas> {
  return unstable_cache(anuladasData, ['anuladas-v1'], {
    tags: [TAG_ANULACIONES],
    revalidate: 600,
  })(f.desde, f.hasta, f.localId ?? null)
}
