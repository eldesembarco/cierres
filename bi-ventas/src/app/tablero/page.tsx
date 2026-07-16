import { BiTabs } from '@/components/BiTabs'
import { formatMoney } from '@/lib/money'
import { type Alcance } from '@/lib/bi'
import { tablero, mesesDisponibles, type SemanaBucket, type FilaSemanal } from '@/lib/biTablero'
import { LayoutDashboard, Inbox, TrendingUp, TrendingDown, Minus, Crown } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ alcance?: string; mes?: string; marca?: string }>

const ALCANCES: { valor: Alcance; etiqueta: string }[] = [
  { valor: 'propios', etiqueta: 'Locales propios' },
  { valor: 'franquicias', etiqueta: 'Franquicias' },
  { valor: 'todos', etiqueta: 'Todos los locales' },
]

const fmtM = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : formatMoney(n)
const fmtInt = (n: number) => Math.round(n).toLocaleString('es-AR')
const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
const fmtDia = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

export default async function TableroPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const alcance: Alcance = sp.alcance === 'franquicias' || sp.alcance === 'todos' ? sp.alcance : 'propios'
  const meses = mesesDisponibles()
  const mes = sp.mes && meses.some((m) => m.valor === sp.mes) ? sp.mes : undefined
  const marca = sp.marca === 'D' || sp.marca === 'T' ? sp.marca : undefined

  const t = await tablero({ alcance, mes, marca })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <BiTabs actual="/tablero" />
      <div className="mb-1 flex items-center gap-2">
        <LayoutDashboard size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Tablero</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Pulso de la red con venta facturada de Tango: KPIs del período, evolución semanal y comparativa por sucursal.
        {t.ultimaSync && <> Datos al <b>{t.ultimaSync}</b> (se actualiza solo cada mañana).</>}
      </p>

      {/* Filtros */}
      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Mes</span>
          <select name="mes" defaultValue={mes ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            <option value="">Todo el histórico</option>
            {meses.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Alcance</span>
          <select name="alcance" defaultValue={alcance} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            {ALCANCES.map((a) => (
              <option key={a.valor} value={a.valor}>{a.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Marca</span>
          <select name="marca" defaultValue={marca ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            <option value="">Todas</option>
            <option value="D">Desembarco</option>
            <option value="T">Tasty / Mila&Go</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Aplicar
        </button>
      </form>

      {t.sinDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Sin datos para estos filtros.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Ventas" value={fmtM(t.kpis.venta)} sub={`${t.kpis.desde.slice(5)} → ${t.kpis.hasta.slice(5)}`} destacado />
            <KpiVar label="vs anterior" variacion={t.kpis.variacionVenta} />
            <Kpi label="Tickets" value={fmtInt(t.kpis.tickets)} sub={`${t.kpis.sucursalesConVenta} sucursales`} />
            <Kpi label="Ticket promedio" value={formatMoney(t.kpis.ticketPromedio)} sub="por transacción" />
            <Kpi
              label="Mejor día"
              value={t.kpis.mejorDia ? fmtM(t.kpis.mejorDia.monto) : '—'}
              sub={t.kpis.mejorDia ? fmtDia(t.kpis.mejorDia.fecha) : ''}
              icono={<Crown size={13} className="text-amber-500" />}
            />
            <Kpi
              label="Food cost teórico"
              value={t.kpis.foodCostPct != null ? `${t.kpis.foodCostPct.toFixed(1)}%` : '—'}
              sub={t.kpis.foodCostPct != null ? `${fmtM(t.kpis.costoInsumos)} a reposición` : 'sin consumo sincronizado'}
            />
          </div>

          {/* Evolución semanal */}
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Evolución semanal</h2>
              <span className="text-xs text-slate-400">últimas 5 semanas · lunes a domingo</span>
            </div>
            <GraficoSemanas semanas={t.semanas} />
          </section>

          {/* Comparativa por sucursal */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Comparativa semana a semana</h2>
              <span className="ml-auto text-xs text-slate-400">{t.filas.length} sucursales con venta</span>
            </div>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="sticky top-0 z-10 bg-slate-50 px-4 py-2 text-left font-medium">Sucursal</th>
                    {t.semanas.map((s) => (
                      <th key={s.desde} className="sticky top-0 z-10 bg-slate-50 px-3 py-2 text-right font-medium">
                        {s.etiqueta}
                        {s.parcial && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">PARCIAL</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.filas.map((f) => (
                    <FilaSucursal key={f.sucursalId} f={f} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="mt-3 text-xs text-slate-400">
            Venta facturada en Tango (definición Z, con IVA). Food cost teórico = consumo por recetas a precio de
            reposición sobre la venta. La semana PARCIAL compara contra días equivalentes recién al cerrar.
          </p>
        </>
      )}
    </main>
  )
}

function Kpi({ label, value, sub, destacado, icono }: { label: string; value: string; sub?: string; destacado?: boolean; icono?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${destacado ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-1 text-xs font-medium text-slate-500">{icono}{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

function KpiVar({ label, variacion }: { label: string; variacion: number | null }) {
  const Icon = variacion == null ? Minus : variacion >= 0 ? TrendingUp : TrendingDown
  const cls = variacion == null ? 'text-slate-400' : variacion >= 0 ? 'text-emerald-700' : 'text-red-600'
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums ${cls}`}>
        <Icon size={17} />
        {variacion == null ? 'sin base' : fmtPct(variacion)}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400">período previo igual</div>
    </div>
  )
}

function GraficoSemanas({ semanas }: { semanas: SemanaBucket[] }) {
  const max = Math.max(1, ...semanas.map((s) => s.monto))
  return (
    <div>
      <div className="flex h-44 items-end gap-3">
        {semanas.map((s) => (
          <div key={s.desde} className="flex h-full flex-1 flex-col justify-end gap-1 text-center">
            <div className="text-xs font-semibold tabular-nums text-slate-700">{fmtM(s.monto)}</div>
            <div
              className={`mx-auto w-full max-w-24 rounded-t-md ${s.parcial ? 'bg-blue-300 [background-image:repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(255,255,255,.45)_6px,rgba(255,255,255,.45)_12px)]' : 'bg-blue-500'}`}
              style={{ height: `${Math.max(3, (s.monto / max) * 100)}%` }}
              title={`${s.etiqueta} · ${formatMoney(s.monto)} · ${fmtInt(s.tickets)} tickets`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3 text-center text-[10.5px] text-slate-400">
        {semanas.map((s) => (
          <div key={s.desde} className="flex-1">
            {s.etiqueta}
            {s.parcial ? ' ·parcial' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function FilaSucursal({ f }: { f: FilaSemanal }) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-1.5 text-left">
        <span className="font-medium text-slate-800">{f.nombre}</span>
        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] text-slate-500">{f.marca}</span>
        {f.esPropia && <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10.5px] font-medium text-blue-600">propio</span>}
      </td>
      {f.montos.map((m, i) => (
        <td key={i} className="px-3 py-1.5 text-right align-top">
          {m == null ? (
            <span className="text-slate-300">—</span>
          ) : (
            <div>
              <div className="font-semibold text-slate-800">{fmtM(m)}</div>
              {f.variaciones[i] != null && (
                <div className={`text-[11px] font-medium ${f.variaciones[i]! >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {f.variaciones[i]! >= 0 ? '▲' : '▼'} {Math.abs(f.variaciones[i]! * 100).toFixed(1)}%
                </div>
              )}
            </div>
          )}
        </td>
      ))}
    </tr>
  )
}
