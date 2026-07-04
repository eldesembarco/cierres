import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { formatMoney } from '@/lib/money'
import { ayerAr } from '@/lib/fecha'
import { conciliarCobrosDia, type LocalConciliado } from '@/lib/tango/conciliacionCobros'
import { Landmark, Lock, CheckCircle2, AlertTriangle, XCircle, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ fecha?: string }>

export default async function ConciliacionCobrosPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !puedeVerFinanzas(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver la conciliación de cobros.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : ayerAr()
  const conc = await conciliarCobrosDia(fecha)

  const difTono = (d: number, cuadra: boolean) =>
    cuadra ? 'text-emerald-700' : d < 0 ? 'text-red-600' : 'text-amber-600'

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Landmark size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Conciliación de cobros (Tango)</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Choca lo que <b>Tango registró como cobrado</b> (la fuente) contra lo que <b>cargó cada encargado</b> en el
        cierre, por local y por canal. Sirve para cazar cargas incompletas o mal tipificadas.
      </p>

      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Fecha</span>
          <input name="fecha" type="date" defaultValue={fecha} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Conciliar día
        </button>
      </form>

      {conc.bridgeError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <b>No pude traer los cobros de Tango.</b> {conc.bridgeError}
            <div className="mt-0.5 text-xs text-red-700/80">Se muestra solo lo cargado por los encargados.</div>
          </div>
        </div>
      )}

      {conc.mediosDesconocidos.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <b>Medios de pago nuevos en Tango sin mapear:</b> {conc.mediosDesconocidos.join(', ')}. Van a “varios” hasta
            asignarlos a un canal.
          </div>
        </div>
      )}

      {/* KPIs del día */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Venta Tango" value={formatMoney(conc.totales.tango)} tone="slate" />
        <Kpi label="Venta cargada" value={formatMoney(conc.totales.cargado)} tone="slate" />
        <Kpi
          label="Diferencia"
          value={formatMoney(conc.totales.diferencia)}
          tone={Math.abs(conc.totales.diferencia) < 1 ? 'emerald' : 'red'}
        />
        <Kpi
          label="Locales con diferencia"
          value={String(conc.localesConDiferencia)}
          tone={conc.localesConDiferencia === 0 ? 'emerald' : 'amber'}
        />
      </div>

      {conc.locales.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">No hay datos para este día.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {conc.locales.map((l) => (
            <LocalCard key={l.localId} l={l} bridgeCaido={Boolean(conc.bridgeError)} difTono={difTono} />
          ))}
        </div>
      )}
    </main>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'red' | 'amber' }) {
  const toneCls: Record<string, string> = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    red: 'text-red-600',
    amber: 'text-amber-600',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${toneCls[tone]}`}>{value}</div>
    </div>
  )
}

function LocalCard({
  l,
  bridgeCaido,
  difTono,
}: {
  l: LocalConciliado
  bridgeCaido: boolean
  difTono: (d: number, cuadra: boolean) => string
}) {
  // Estado visual: cuadra (verde), no cargó (gris), sin cobros Tango (gris), con diferencia (rojo/ámbar).
  const chip = l.faltaCierre
    ? { icon: <Inbox size={16} className="text-slate-400" />, txt: 'No cargó', cls: 'bg-slate-100 text-slate-600' }
    : l.cuadra
      ? { icon: <CheckCircle2 size={16} className="text-emerald-600" />, txt: 'Cuadra', cls: 'bg-emerald-50 text-emerald-700' }
      : { icon: <AlertTriangle size={16} className="text-red-600" />, txt: 'Diferencia', cls: 'bg-red-50 text-red-700' }

  // Detalle por canal solo cuando importa (no cargó o no cuadra) y hay algo que mostrar.
  const mostrarDetalle = !l.cuadra && l.canales.length > 0 && !bridgeCaido

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
            {chip.icon}
            {chip.txt}
          </span>
          <h2 className="text-sm font-semibold text-slate-900">{l.local}</h2>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{l.marca}</span>
          {l.sinCobrosTango && !l.faltaCierre && (
            <span className="text-[11px] text-slate-400">· Tango sin cobros este día</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-right text-xs tabular-nums">
          <div>
            <div className="text-slate-400">Tango</div>
            <div className="font-semibold text-slate-700">{formatMoney(l.totalTango)}</div>
          </div>
          <div>
            <div className="text-slate-400">Cargado</div>
            <div className="font-semibold text-slate-700">{formatMoney(l.totalCargado)}</div>
          </div>
          <div>
            <div className="text-slate-400">Diferencia</div>
            <div className={`font-semibold ${difTono(l.diferencia, l.cuadra)}`}>{formatMoney(l.diferencia)}</div>
          </div>
        </div>
      </div>

      {mostrarDetalle && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-1 font-medium">Canal</th>
                <th className="pb-1 text-right font-medium">Tango</th>
                <th className="pb-1 text-right font-medium">Cargado</th>
                <th className="pb-1 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {l.canales.map((c) => {
                const cuadraCanal = Math.abs(c.diferencia) < 1
                return (
                  <tr key={c.canal} className="border-t border-slate-100">
                    <td className="py-1 text-slate-700">{c.label}</td>
                    <td className="py-1 text-right text-slate-600">{formatMoney(c.tango)}</td>
                    <td className="py-1 text-right text-slate-600">{formatMoney(c.cargado)}</td>
                    <td className={`py-1 text-right font-medium ${cuadraCanal ? 'text-slate-400' : difTono(c.diferencia, false)}`}>
                      {cuadraCanal ? '—' : formatMoney(c.diferencia)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
