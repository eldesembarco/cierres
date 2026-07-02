import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas, puedeMarcarPagado } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { CuentaCorrienteTabla, type MovimientoRow } from '@/components/CuentaCorrienteTabla'
import { Wallet, Lock, Inbox, Building2, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ estado?: string; localId?: string }>
type Estado = 'pendiente' | 'pagado' | 'todos'

export default async function CuentaCorrientePage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session) return null
  // Ver todos los locales: central/admin/contable. Marcar pagado (editar): sólo central/admin.
  const verTodos = puedeVerFinanzas(session.user.rol)
  const puedeMarcar = puedeMarcarPagado(session.user.rol)

  const sp = await searchParams
  const estado: Estado = sp.estado === 'pagado' ? 'pagado' : sp.estado === 'todos' ? 'todos' : 'pendiente'

  // Alcance: el encargado ve sólo su local; administración/contable ven todos (o filtran por uno).
  let scopeLocalId: number | null = null
  if (!verTodos) {
    if (!session.user.localId) {
      return (
        <main className="mx-auto w-full max-w-5xl px-4 py-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            <Lock size={18} className="text-slate-400" />
            <p>Tu usuario no tiene un local asignado.</p>
          </div>
        </main>
      )
    }
    scopeLocalId = session.user.localId
  } else if (sp.localId && /^\d+$/.test(sp.localId)) {
    scopeLocalId = Number(sp.localId)
  }

  const whereScope = scopeLocalId != null ? { localId: scopeLocalId } : {}

  const [movs, locales] = await Promise.all([
    prisma.movimientoCtaCte.findMany({
      where: whereScope,
      include: { proveedor: true, local: true },
      orderBy: [{ pagado: 'asc' }, { fecha: 'desc' }, { id: 'desc' }],
    }),
    verTodos ? prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }) : Promise.resolve([]),
  ])

  const pendientes = movs.filter((m) => !m.pagado)
  const saldoPendiente = pendientes.reduce((s, m) => s + Number(m.monto), 0)
  const totalPagado = movs.filter((m) => m.pagado).reduce((s, m) => s + Number(m.monto), 0)

  // Saldo pendiente agrupado por proveedor y por local (sólo sobre lo pendiente).
  const porProveedor = agrupar(pendientes, (m) => m.proveedor?.nombre ?? '(sin asignar)', (m) => Number(m.monto))
  const porLocal = agrupar(pendientes, (m) => m.local.nombre, (m) => Number(m.monto))

  const lista = estado === 'todos' ? movs : estado === 'pagado' ? movs.filter((m) => m.pagado) : pendientes
  const filas: MovimientoRow[] = lista.map((m) => ({
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <Wallet size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Cuenta corriente</h1>
      </div>
      <p className="mb-5 -mt-3 text-sm text-slate-500">
        Gastos cargados en cuenta corriente (lo que se le debe a proveedores).
        {puedeMarcar
          ? ' Marcá cada uno como pagado cuando administración lo abona.'
          : verTodos
            ? ' Sólo lectura.'
            : ' Sólo lectura de tu local.'}
      </p>

      {/* Filtros */}
      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Estado</span>
          <select name="estado" defaultValue={estado} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            <option value="pendiente">Pendientes</option>
            <option value="pagado">Pagados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        {verTodos && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Local</span>
            <select name="localId" defaultValue={scopeLocalId != null ? String(scopeLocalId) : ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-56">
              <option value="">Todos los locales</option>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Aplicar
        </button>
      </form>

      {/* KPIs */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard titulo="Saldo pendiente" valor={formatMoney(saldoPendiente)} tono="amber" />
        <KpiCard titulo="Movimientos pendientes" valor={String(pendientes.length)} tono="slate" />
        <KpiCard titulo="Pagado (histórico)" valor={formatMoney(totalPagado)} tono="green" />
      </section>

      {pendientes.length > 0 && (
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownCard titulo="Saldo por proveedor" icon={<Package size={16} />} filas={porProveedor} />
          {verTodos && porLocal.length > 1 && (
            <BreakdownCard titulo="Saldo por local" icon={<Building2 size={16} />} filas={porLocal} />
          )}
        </section>
      )}

      {/* Detalle */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Detalle de movimientos</h2>
        </div>
        {movs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <Inbox size={32} className="text-slate-300" />
            <p className="text-sm text-slate-600">Todavía no hay gastos cargados en cuenta corriente.</p>
            <p className="text-xs text-slate-400">Aparecen acá cuando un local carga un gasto con forma de pago “Cuenta corriente”.</p>
          </div>
        ) : (
          <CuentaCorrienteTabla filas={filas} puedeMarcar={puedeMarcar} />
        )}
      </section>
    </main>
  )
}

function agrupar<T>(rows: T[], key: (m: T) => string, monto: (m: T) => number) {
  const map = new Map<string, { nombre: string; total: number; count: number }>()
  for (const m of rows) {
    const k = key(m)
    const prev = map.get(k) ?? { nombre: k, total: 0, count: 0 }
    prev.total += monto(m)
    prev.count += 1
    map.set(k, prev)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

const TONOS: Record<string, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
}

function KpiCard({ titulo, valor, tono }: { titulo: string; valor: string; tono: keyof typeof TONOS }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${TONOS[tono]}`}>
          <Wallet size={16} />
        </span>
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
      </div>
      <p className="tabular-nums text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  )
}

function BreakdownCard({
  titulo,
  icon,
  filas,
}: {
  titulo: string
  icon: React.ReactNode
  filas: { nombre: string; total: number; count: number }[]
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <span className="text-slate-400">{icon}</span> {titulo}
      </h3>
      <table className="w-full text-sm">
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre} className="border-b border-slate-100 last:border-0">
              <td className="px-2 py-1.5 text-slate-600">
                {f.nombre} <span className="text-xs text-slate-400">· {f.count}</span>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-800">{formatMoney(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
