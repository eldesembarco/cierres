import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas, puedeMarcarPagado } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { getSaldoFondoFijo, getSaldosFondoFijoTodos } from '@/lib/cierre/getSaldoFondoFijo'
import { formatMoney } from '@/lib/money'
import { FondoFijoTabla, type SaldoRow } from '@/components/FondoFijoTabla'
import { Coins, Lock, Wallet, TrendingDown, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function FondoFijoPage() {
  const session = await auth()
  if (!session) return null
  const rol = session.user.rol
  const puedeReponer = puedeMarcarPagado(rol)
  const verTodos = puedeVerFinanzas(rol)

  let filas: SaldoRow[]
  if (verTodos) {
    filas = await getSaldosFondoFijoTodos()
  } else {
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
    const s = await getSaldoFondoFijo(session.user.localId)
    const local = await prisma.local.findUnique({ where: { id: session.user.localId }, select: { nombre: true } })
    filas = [{ localId: session.user.localId, localNombre: local?.nombre ?? 'Mi local', ...s }]
  }

  const totBase = filas.reduce((s, f) => s + f.base, 0)
  const totSaldo = filas.reduce((s, f) => s + f.saldoActual, 0)
  const totAReponer = filas.reduce((s, f) => s + f.aReponer, 0)

  // Reposiciones recientes (histórico: cuánto, cuándo, quién).
  const localIds = filas.map((f) => f.localId)
  const reposiciones = await prisma.reposicionFondoFijo.findMany({
    where: { localId: { in: localIds } },
    include: { local: { select: { nombre: true } } },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: 30,
  })
  const usuarioIds = [...new Set(reposiciones.map((r) => r.creadoPor))]
  const usuarios = usuarioIds.length
    ? await prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, nombre: true, email: true } })
    : []
  const nombreUsuario = new Map(usuarios.map((u) => [u.id, u.nombre || u.email]))

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Coins size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Fondo fijo (caja chica)</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Saldo corriente de la caja chica por local. Baja con cada gasto pagado con fondo fijo y sube cuando administración repone.
        {puedeReponer ? '' : ' Sólo lectura.'}
      </p>

      {/* KPIs */}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard icon={<Wallet size={16} />} titulo="Fondo (base)" valor={formatMoney(totBase)} tono="slate" />
        <KpiCard icon={<Coins size={16} />} titulo="Saldo actual" valor={formatMoney(totSaldo)} tono={totSaldo < 0 ? 'red' : 'green'} />
        <KpiCard icon={<TrendingDown size={16} />} titulo="A reponer" valor={formatMoney(totAReponer)} tono={totAReponer > 0 ? 'amber' : 'green'} />
      </section>

      {/* Saldo por local + botón Reponer */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Saldo por local</h2>
        </div>
        <FondoFijoTabla filas={filas} puedeReponer={puedeReponer} />
      </section>

      {/* Histórico de reposiciones */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Reposiciones recientes</h2>
        </div>
        {reposiciones.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox size={28} className="text-slate-300" />
            <p className="text-sm text-slate-600">Todavía no hay reposiciones registradas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Local</th>
                  <th className="px-3 py-2 font-medium">Detalle</th>
                  <th className="px-3 py-2 font-medium">Cargó</th>
                  <th className="px-4 py-2 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {reposiciones.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-slate-600">
                      {new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }).format(r.fecha)}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{r.local.nombre}</td>
                    <td className="px-3 py-2 text-slate-500">{r.descripcion ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{nombreUsuario.get(r.creadoPor) ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-700">{formatMoney(Number(r.monto))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

const TONOS: Record<string, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
}

function KpiCard({ icon, titulo, valor, tono }: { icon: React.ReactNode; titulo: string; valor: string; tono: keyof typeof TONOS }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${TONOS[tono]}`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
      </div>
      <p className="tabular-nums text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  )
}
