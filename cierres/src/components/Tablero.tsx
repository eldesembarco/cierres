import type { TableroResult } from '@/lib/control/getTablero'
import { CANAL_LABEL } from '@/lib/informes/report'
import { formatMoney } from '@/lib/money'
import {
  Wallet, Scale, Truck, Receipt, TrendingUp, ArrowDownRight, ArrowUpRight,
  CheckCircle2, AlertTriangle, Coins,
} from 'lucide-react'

const TURNO_LABEL: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde' }

const CANAL_COLOR: Record<string, string> = {
  efectivo: '#10b981', tarjetas: '#6366f1', pedidosya: '#e11d48', pedidosya_efectivo: '#fb7185',
  mercado_pedidos: '#2563eb', mercadopago: '#0ea5e9', rappi: '#f97316', uber: '#0f172a',
  delivery_propio: '#8b5cf6', varios: '#94a3b8',
}

const PLAT_COLOR: Record<string, string> = {
  PedidosYa: '#e11d48', 'Mercado Delivery': '#2563eb', 'Mercado Pago': '#0ea5e9', Rappi: '#f97316', Uber: '#0f172a',
}

function diffTone(diff: number) {
  const abs = Math.abs(diff)
  if (abs < 1) return { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500', bar: '#10b981', label: 'cuadra' }
  if (abs <= 1000) return { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500', bar: '#f59e0b', label: 'revisar' }
  return { text: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500', bar: '#f43f5e', label: 'descuadre' }
}

function KpiCard({
  label, value, sub, icon, tone = 'slate',
}: {
  label: string; value: string; sub?: React.ReactNode; icon: React.ReactNode
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate'
}) {
  const tones = {
    blue: 'from-blue-50 to-white border-blue-100 text-blue-600',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-600',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-600',
    rose: 'from-rose-50 to-white border-rose-100 text-rose-600',
    slate: 'from-slate-50 to-white border-slate-200 text-slate-500',
  }[tone]
  return (
    <div className={`rounded-2xl border bg-gradient-to-b p-4 shadow-sm ${tones}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function Bar({ frac, color }: { frac: number; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%`, background: color }} />
    </div>
  )
}

export function Tablero({ result, localNombre }: { result: TableroResult; localNombre: string }) {
  const { dia, delivery, conciliacion, ventaPorCanal, turnos } = result
  const fechaTxt = new Date(`${result.fecha.toISOString().slice(0, 10)}T00:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
  const dTone = diffTone(dia.diferenciaCaja)
  const maxCanal = Math.max(1, ...ventaPorCanal.map((v) => v.monto))
  const maxConc = Math.max(1, ...conciliacion.map((r) => Math.max(r.declarado, r.app)))

  return (
    <div className="flex flex-col gap-5">
      {/* Header con degradé */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-blue-100">Tablero del día</p>
            <h1 className="text-2xl font-semibold">{localNombre}</h1>
            <p className="text-sm capitalize text-blue-100">{fechaTxt}</p>
          </div>
          <div className="flex gap-2">
            {turnos.length === 0 && (
              <span className="rounded-lg bg-white/15 px-3 py-1 text-sm">Sin cierre cargado</span>
            )}
            {turnos.map((t) => (
              <span key={t.turno} className="rounded-lg bg-white/15 px-3 py-1 text-sm">
                {TURNO_LABEL[t.turno]} · {t.estado === 'cerrado' ? '✓ cerrado' : 'borrador'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Venta del día" value={formatMoney(dia.ventaTotal)} icon={<TrendingUp size={18} />} tone="blue"
          sub={`${dia.tickets || '—'} tickets`} />
        <KpiCard label="Diferencia de caja" value={formatMoney(dia.diferenciaCaja)} icon={<Scale size={18} />}
          tone={Math.abs(dia.diferenciaCaja) < 1 ? 'emerald' : Math.abs(dia.diferenciaCaja) <= 1000 ? 'amber' : 'rose'}
          sub={<span className={`inline-flex items-center gap-1 font-medium ${dTone.text}`}><span className={`h-1.5 w-1.5 rounded-full ${dTone.dot}`} />{dTone.label}</span>} />
        <KpiCard label="Delivery cobrado (neto)" value={formatMoney(delivery.neto)} icon={<Truck size={18} />} tone="emerald"
          sub={`bruto ${formatMoney(delivery.cobrado)}`} />
        <KpiCard label="Comisión apps" value={formatMoney(delivery.comision)} icon={<Coins size={18} />} tone="amber"
          sub="lo que se llevan las plataformas" />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Conciliación delivery */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <Truck size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Conciliación de delivery</h2>
            <span className="ml-auto text-xs text-slate-400">declarado vs plata real</span>
          </div>

          {conciliacion.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Sin canales de delivery para comparar. Cargá un cierre e importá Mercado Pago / PedidosYa.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {conciliacion.map((r) => {
                const tone = diffTone(r.diferencia)
                return (
                  <div key={r.plataforma} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium text-slate-900">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAT_COLOR[r.plataforma] ?? '#64748b' }} />
                        {r.plataforma}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${tone.bg} ${tone.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                        {r.diferencia > 0 ? <ArrowUpRight size={12} /> : r.diferencia < 0 ? <ArrowDownRight size={12} /> : <CheckCircle2 size={12} />}
                        {formatMoney(r.diferencia)}
                      </span>
                    </div>
                    {/* doble barra declarado vs cobrado */}
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[11px] text-slate-500">Declarado</span>
                        <Bar frac={r.declarado / maxConc} color="#94a3b8" />
                        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-700">{formatMoney(r.declarado)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-[11px] text-slate-500">Cobrado</span>
                        <Bar frac={r.app / maxConc} color={PLAT_COLOR[r.plataforma] ?? '#2563eb'} />
                        <span className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-700">{formatMoney(r.app)}</span>
                      </div>
                    </div>
                    {r.comision > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        Comisión <span className="font-medium tabular-nums text-amber-700">{formatMoney(r.comision)}</span>
                        {' · '}Neto a la cuenta <span className="font-medium tabular-nums text-emerald-700">{formatMoney(r.neto)}</span>
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Venta por canal */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Receipt size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Venta por canal</h2>
          </div>
          {ventaPorCanal.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Sin ventas cargadas.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ventaPorCanal.map((v) => (
                <li key={v.canal}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-700">{CANAL_LABEL[v.canal] ?? v.canal}</span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatMoney(v.monto)}
                      <span className="ml-1.5 text-xs text-slate-400">{Math.round((v.monto / dia.ventaTotal) * 100)}%</span>
                    </span>
                  </div>
                  <Bar frac={v.monto / maxCanal} color={CANAL_COLOR[v.canal] ?? '#64748b'} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Caja por turno */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Wallet size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-900">Caja por turno</h2>
        </div>
        {turnos.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Todavía no hay cierres de este día.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {turnos.map((t) => {
              const esperado = t.totales.saldoEfectivo
              const tone = diffTone(t.totales.diferenciaCaja)
              return (
                <div key={t.turno} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-slate-900">{TURNO_LABEL[t.turno]}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${tone.bg} ${tone.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{formatMoney(t.totales.diferenciaCaja)}
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-slate-500">Efectivo esperado</dt><dd className="font-medium tabular-nums text-slate-800">{formatMoney(esperado)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Depositado</dt><dd className="font-medium tabular-nums text-slate-800">{formatMoney(t.efectivoDepositado)}</dd></div>
                    <div><dt className="text-xs text-slate-500">Venta turno</dt><dd className="font-medium tabular-nums text-slate-800">{formatMoney(t.totales.ventaTotal)}</dd></div>
                  </dl>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
