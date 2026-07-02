import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { PlanillaDia } from '@/components/PlanillaDia'
import { esCentral } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
import type { Canal, FormaPago, TipoGasto, TipoTarjeta, Turno, TurnoInput } from '@/lib/cierre/types'
import type { CierreAuditoria } from '@/components/TurnoCierre'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

function formatFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

type CierreConHijos = {
  fondoFijo: unknown
  montoZ: unknown
  efectivoDepositado: unknown
  notaCredito: unknown
  cantidadTickets: number | null
  nota: string | null
  estado: string
  ventas: { canal: string; monto: unknown }[]
  tarjetas: { tipo: string; monto: unknown; lote: string | null }[]
  detalles: { canal: string; referencia: string; importe: unknown }[]
  gastos: { tipo: string; formaPago: string; monto: unknown; descripcion: string | null; comprobanteId: number | null; facturaNumero: string | null; facturaTotal: unknown; proveedorId: number | null }[]
  auditorias: { usuarioNombre: string; accion: string; observacion: string; creadoEn: Date }[]
}

function toAuditorias(c: CierreConHijos | undefined): CierreAuditoria[] {
  if (!c) return []
  return c.auditorias.map((a) => ({
    usuarioNombre: a.usuarioNombre,
    accion: a.accion,
    observacion: a.observacion,
    creadoEn: a.creadoEn.toISOString(),
  }))
}

function toInicial(c: CierreConHijos | undefined): (Partial<TurnoInput> & { nota?: string }) | undefined {
  if (!c) return undefined
  return {
    fondoFijo: Number(c.fondoFijo),
    montoZ: Number(c.montoZ),
    efectivoDepositado: Number(c.efectivoDepositado),
    notaCredito: Number(c.notaCredito),
    cantidadTickets: c.cantidadTickets,
    ventas: c.ventas.map((v) => ({ canal: v.canal as Canal, monto: Number(v.monto) })),
    tarjetas: c.tarjetas.map((t) => ({ tipo: t.tipo as TipoTarjeta, monto: Number(t.monto), lote: t.lote })),
    detalles: c.detalles.map((d) => ({ canal: d.canal as Canal, referencia: d.referencia, importe: Number(d.importe) })),
    gastos: c.gastos.map((g) => ({
      tipo: g.tipo as TipoGasto,
      formaPago: g.formaPago as FormaPago,
      monto: Number(g.monto),
      descripcion: g.descripcion,
      comprobanteId: g.comprobanteId,
      facturaNumero: g.facturaNumero,
      facturaTotal: g.facturaTotal == null ? null : Number(g.facturaTotal),
      proveedorId: g.proveedorId,
    })),
    nota: c.nota ?? '',
  }
}

function estadoLabel(c: CierreConHijos | undefined) {
  if (!c) return '—'
  return c.estado === 'cerrado' ? 'cerrado' : 'borrador'
}

export default async function CierreDiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params
  const session = await auth()
  if (!session) return null
  const central = esCentral(session.user.rol)
  const localId = await getLocalActivoId(session)
  const local = await prisma.local.findUniqueOrThrow({ where: { id: localId } })

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

  const proveedores = await prisma.proveedor.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })

  const byTurno = new Map<Turno, (typeof cierres)[number]>()
  for (const c of cierres) byTurno.set(c.turno as Turno, c)
  const manana = byTurno.get('manana') as CierreConHijos | undefined
  const tarde = byTurno.get('tarde') as CierreConHijos | undefined

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5">
        <Link
          href="/cierres"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} /> Cierres
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{local.nombre}</h1>
            <p className="text-sm text-slate-500">Cierre del {formatFecha(fecha)}</p>
          </div>
          <div className="mt-1 flex flex-col items-end gap-1 text-xs">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              Mañana {estadoLabel(manana)}
            </span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
              Tarde {estadoLabel(tarde)}
            </span>
          </div>
        </div>
      </div>

      <PlanillaDia
        // key por local+fecha: PlanillaDia/TurnoCierre cargan sus datos en useState
        // (una sola vez). Sin esta key, al cambiar de local con el selector el estado
        // del cliente quedaba con los datos del local anterior. La key fuerza el
        // re-montado con datos frescos cuando cambia el local o la fecha.
        key={`${localId}-${fecha}`}
        fecha={fecha}
        localId={localId}
        fondoFijoDefault={Number(local.fondoFijoDefault)}
        inicialManana={toInicial(manana)}
        inicialTarde={toInicial(tarde)}
        estadoManana={manana?.estado ?? null}
        estadoTarde={tarde?.estado ?? null}
        auditoriasManana={toAuditorias(manana)}
        auditoriasTarde={toAuditorias(tarde)}
        esCentral={central}
        puedeImportar={central}
        verDiferencia={central}
        proveedores={proveedores}
      />
    </main>
  )
}
