import Link from 'next/link'
import type { DashboardData } from '@/lib/dashboard/getDashboard'
import { estadoTango } from '@/lib/dashboard/controlTango'
import { formatMoney } from '@/lib/money'
import {
  TrendingUp, Scale, Truck, Receipt, Wallet, Coins, ClipboardCheck, AlertTriangle,
  CheckCircle2, Package, Building2, Sun, Moon, ArrowRight, PiggyBank,
} from 'lucide-react'

/* ---------- helpers visuales (coherentes con Tablero.tsx) ---------- */

const CANAL_COLOR: Record<string, string> = {
  efectivo: '#10b981', tarjetas: '#6366f1', pedidosya: '#e11d48', pedidosya_efectivo: '#fb7185',
  mercado_pedidos: '#2563eb', mercadopago: '#0ea5e9', pvs_qr: '#14b8a6', rappi: '#f97316',
  uber: '#0f172a', delivery_propio: '#8b5cf6', varios: '#94a3b8',
}
const PLAT_COLOR: Record<string, string> = {
  PedidosYa: '#e11d48', 'Mercado Delivery': '#2563eb', 'Mercado Pago': '#0ea5e9', Rappi: '#f97316', Uber: '#0f172a',
}
const MARCA_COLOR: Record<string, string> = {
  Desembarco: '#2563eb', 'Mr Tasty': '#f97316', 'Mila & Go': '#8b5cf6',
}

function diffTone(diff: number) {
  const abs = Math.abs(diff)
  if (abs < 1) return { text: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500', bar: '#10b981', label: 'cuadra' }
  if (abs <= 1000) return { text: 'text-amber-700', bg: 'bg-amber-50', dot: 'bg-amber-500', bar: '#f59e0b', label: 'revisar' }
  return { text: 'text-rose-700', bg: 'bg-rose-50', dot: 'bg-rose-500', bar: '#f43f5e', label: 'descuadre' }
}

function KpiCard({ label, value, sub, icon, tone = 'slate' }: {
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

function Card({ title, icon, right, children }: { title: string; icon: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="text-slate-400">{icon}</span> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function Donut({ segs, total }: { segs: { color: string; value: number }[]; total: number }) {
  const r = 52, c = 2 * Math.PI * r
  let acc = 0
  return (
    <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
      {total > 0 && segs.map((s, i) => {
        const frac = s.value / total
        const dash = frac * c
        const el = (
          <circle key={i} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16"
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} />
        )
        acc += dash
        return el
      })}
    </svg>
  )
}

function Sparkline({ points }: { points: number[] }) {
  const w = 240, h = 44, max = Math.max(1, ...points)
  const step = points.length > 1 ? w / (points.length - 1) : w
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(h - (p / max) * (h - 6) - 3).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none">
      <polyline points={coords.join(' ')} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.length > 0 && (
        <circle cx={(w).toFixed(1)} cy={(h - (points[points.length - 1] / max) * (h - 6) - 3).toFixed(1)} r="3" fill="#2563eb" />
      )}
    </svg>
  )
}

// Chip del control "declarado vs Tango" (facturación real). Sin datos → guion.
function TangoChip({ ventaTango, difTango, faltaCierre }: { ventaTango: number | null; difTango: number | null; faltaCierre: boolean }) {
  if (faltaCierre || ventaTango == null || difTango == null || ventaTango <= 0) {
    return <span className="text-xs text-slate-300" title="Sin datos de Tango para este día (el BI sincroniza a la mañana siguiente)">—</span>
  }
  const estado = estadoTango(difTango, ventaTango)
  const titulo = `Tango facturó ${formatMoney(ventaTango)} · declarado ${formatMoney(ventaTango + difTango)}`
  if (estado === 'cuadra') {
    return (
      <span title={titulo} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 size={12} /> cuadra
      </span>
    )
  }
  const cls = estado === 'leve' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
  return (
    <span title={titulo} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${cls}`}>
      <AlertTriangle size={12} /> {formatMoney(difTango)}
    </span>
  )
}

function StatusChip({ estado, label, icon }: { estado: string | null; label: string; icon: React.ReactNode }) {
  const s = estado === 'cerrado'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : estado === 'borrador'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-50 text-slate-400 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${s}`}>
      {icon} {label}
    </span>
  )
}

/* ---------- componente principal ---------- */

export function Dashboard({ data, hoy, ayer }: { data: DashboardData; hoy: string; ayer: string }) {
  const { tablero, porMarca, ventaPorCanal, alertas, ctaCte, fondoFijo, serie } = data
  const g = tablero.grupo
  const fechaTxt = new Date(`${data.fecha}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const dTone = diffTone(g.diferenciaCaja)
  const descuadrados = tablero.porLocal.filter((l) => !l.faltaCierre && Math.abs(l.diferenciaCaja) > 1000).length
  const ticketProm = g.tickets > 0 ? g.ventaTotal / g.tickets : 0
  const maxVenta = Math.max(1, ...tablero.porLocal.map((l) => l.ventaTotal))
  const maxConc = Math.max(1, ...tablero.delivery.map((r) => Math.max(r.declarado, r.app)))
  const rankeados = [...tablero.porLocal].sort((a, b) => b.ventaTotal - a.ventaTotal)
  const sinCargar = [...tablero.porLocal].sort((a, b) => Number(a.faltaCierre === false) - Number(b.faltaCierre === false) || a.localNombre.localeCompare(b.localNombre))
  const canalSegs = ventaPorCanal.map((v) => ({ color: CANAL_COLOR[v.canal] ?? '#94a3b8', value: v.total }))
  const totalCanal = ventaPorCanal.reduce((s, v) => s + v.total, 0)

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-blue-100">Panel de administración · Grupo Desembarco</div>
            <h1 className="mt-0.5 text-2xl font-bold capitalize">{fechaTxt}</h1>
            <p className="mt-0.5 text-sm text-blue-100">{g.localesCargados} de {g.localesTotal} locales cargaron · {g.tickets.toLocaleString('es-AR')} tickets</p>
          </div>
          <form method="GET" className="flex items-center gap-1.5">
            <Link href={`/dashboard?fecha=${ayer}`} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">Ayer</Link>
            <Link href={`/dashboard?fecha=${hoy}`} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">Hoy</Link>
            <input type="date" name="fecha" defaultValue={data.fecha} max={hoy} className="rounded-lg border-0 px-2.5 py-1.5 text-sm text-slate-800 tabular-nums" />
            <button className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">Ver</button>
          </form>
        </div>
      </div>

      {/* Hero KPIs */}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Venta del grupo" tone="blue" icon={<TrendingUp size={18} />} value={formatMoney(g.ventaTotal)}
          sub={<>{g.tickets.toLocaleString('es-AR')} tickets · prom {formatMoney(ticketProm)}</>} />
        <KpiCard label="Neto estimado" tone="emerald" icon={<Coins size={18} />} value={formatMoney(g.neto)}
          sub="venta − gastos − comisiones" />
        <KpiCard label="Diferencia de caja" tone={g.diferenciaCaja === 0 ? 'emerald' : Math.abs(g.diferenciaCaja) > 1000 ? 'rose' : 'amber'} icon={<Scale size={18} />}
          value={formatMoney(g.diferenciaCaja)} sub={<>{descuadrados} local{descuadrados === 1 ? '' : 'es'} descuadrado{descuadrados === 1 ? '' : 's'}</>} />
        <KpiCard label="Cobertura de carga" tone={g.localesCargados < g.localesTotal ? 'amber' : 'emerald'} icon={<ClipboardCheck size={18} />}
          value={`${g.localesCargados}/${g.localesTotal}`} sub={<>{g.turnosBorrador} turno{g.turnosBorrador === 1 ? '' : 's'} en borrador</>} />
        <KpiCard label="Delivery neto" tone="emerald" icon={<Truck size={18} />} value={formatMoney(g.deliveryNeto)}
          sub={<>comisiones {formatMoney(g.comision)}</>} />
        <KpiCard label="Gastos del grupo" tone="slate" icon={<Receipt size={18} />} value={formatMoney(g.gastos)} />
        <KpiCard label="Efectivo a depositar" tone="amber" icon={<Wallet size={18} />} value={formatMoney(g.efectivoADepositar)}
          sub="venta efectivo − gastos efvo." />
        <KpiCard label="Alertas del día" tone={alertas.length ? 'rose' : 'emerald'} icon={<AlertTriangle size={18} />}
          value={String(alertas.length)} sub={alertas.length ? 'requieren revisión' : 'todo en orden'} />
      </section>

      {/* Sparkline + marcas */}
      <section className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card title="Venta del grupo · últimos 7 días" icon={<TrendingUp size={16} />}>
          <Sparkline points={serie.map((s) => s.total)} />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            {serie.map((s) => <span key={s.fecha}>{s.fecha.slice(8, 10)}/{s.fecha.slice(5, 7)}</span>)}
          </div>
        </Card>
        {porMarca.slice(0, 2).map((m) => (
          <div key={m.marca} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MARCA_COLOR[m.marca] ?? '#64748b' }} />
              <span className="text-sm font-semibold text-slate-800">{m.marca}</span>
              <span className="ml-auto text-xs text-slate-400">{m.localesCargados}/{m.localesTotal} cargaron</span>
            </div>
            <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{formatMoney(m.ventaTotal)}</p>
            <p className={`text-xs ${diffTone(m.diferenciaCaja).text}`}>diferencia {formatMoney(m.diferenciaCaja)}</p>
          </div>
        ))}
      </section>

      {/* Zona principal: cobertura + ranking | alertas */}
      <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Cobertura */}
          <Card title="Cobertura de carga — quién cargó y quién no" icon={<ClipboardCheck size={16} />}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sinCargar.map((l) => (
                <div key={l.localId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <span className="truncate text-sm text-slate-700">{l.localNombre}</span>
                  <span className="flex shrink-0 gap-1">
                    <StatusChip estado={l.manana} label="M" icon={<Sun size={10} />} />
                    <StatusChip estado={l.tarde} label="T" icon={<Moon size={10} />} />
                  </span>
                </div>
              ))}
            </div>
          </Card>
          {/* Ranking */}
          <Card title="Ranking de locales del día" icon={<Building2 size={16} />}>
            {rankeados.every((l) => l.ventaTotal === 0) ? (
              <p className="py-8 text-center text-sm text-slate-400">Todavía no hay ventas cargadas para este día.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-2 font-medium">Local</th>
                      <th className="px-2 py-2 font-medium" style={{ width: '28%' }}>Venta</th>
                      <th className="px-2 py-2 text-right font-medium" title="Declarado vs facturación real de Tango">vs Tango</th>
                      <th className="px-2 py-2 text-right font-medium">Diferencia</th>
                      <th className="px-2 py-2 text-right font-medium">Delivery neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankeados.filter((l) => l.ventaTotal > 0 || !l.faltaCierre).map((l) => {
                      const t = diffTone(l.diferenciaCaja)
                      return (
                        <tr key={l.localId} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-2">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MARCA_COLOR[l.marca] ?? '#64748b' }} />
                              <span className="truncate text-slate-700">{l.localNombre}</span>
                              {l.faltaImportacion && l.deliveryCobrado === 0 && <span title="Sin importación MP/apps"><AlertTriangle size={12} className="text-amber-400" /></span>}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <div className="min-w-[70px] flex-1"><Bar frac={l.ventaTotal / maxVenta} color="#2563eb" /></div>
                              <span className="w-24 shrink-0 text-right tabular-nums text-slate-800">{formatMoney(l.ventaTotal)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <TangoChip ventaTango={l.ventaTango} difTango={l.difTango} faltaCierre={l.faltaCierre} />
                          </td>
                          <td className="px-2 py-2 text-right">
                            {l.faltaCierre ? <span className="text-xs text-slate-300">—</span> : (
                              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${t.bg} ${t.text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />{formatMoney(l.diferenciaCaja)}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-600">{l.deliveryNeto ? formatMoney(l.deliveryNeto) : <span className="text-slate-300">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Alertas */}
        <div className="lg:col-span-1">
          <Card title="Alertas del día" icon={<AlertTriangle size={16} />} right={<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{alertas.length}</span>}>
            {alertas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 size={30} className="text-emerald-500" />
                <p className="text-sm text-slate-600">Todo en orden hoy.</p>
              </div>
            ) : (
              <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
                {alertas.map((a, i) => {
                  const rose = a.severidad === 'alta'
                  return (
                    <Link key={i} href={a.href} className={`flex items-start gap-2 rounded-lg border-l-4 py-2 pl-2.5 pr-2 hover:bg-slate-50 ${rose ? 'border-rose-400 bg-rose-50/40' : 'border-amber-400 bg-amber-50/40'}`}>
                      <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${rose ? 'text-rose-500' : 'text-amber-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-slate-800">{a.localNombre}</span>
                          {a.monto != null && <span className={`shrink-0 text-xs font-medium tabular-nums ${rose ? 'text-rose-600' : 'text-amber-600'}`}>{formatMoney(a.monto)}</span>}
                        </span>
                        <span className="block text-xs text-slate-500">{a.tipo} · {a.detalle}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Venta por canal (donut) + Delivery/MP */}
      <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Venta por canal del grupo" icon={<TrendingUp size={16} />}>
          {totalCanal === 0 ? <p className="py-8 text-center text-sm text-slate-400">Sin ventas cargadas.</p> : (
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Donut segs={canalSegs} total={totalCanal} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-400">total</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800">{formatMoney(totalCanal)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {ventaPorCanal.slice(0, 7).map((v) => (
                  <div key={v.canal} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CANAL_COLOR[v.canal] ?? '#94a3b8' }} />
                    <span className="flex-1 truncate text-slate-600">{v.label}</span>
                    <span className="tabular-nums text-slate-500">{v.porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 0 })}%</span>
                    <span className="w-20 text-right tabular-nums font-medium text-slate-800">{formatMoney(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Delivery / Mercado Pago del grupo" icon={<Truck size={16} />}>
          {tablero.delivery.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Sin delivery declarado.</p> : (
            <div className="space-y-3">
              {tablero.delivery.map((r) => {
                const t = diffTone(r.diferencia)
                return (
                  <div key={r.plataforma}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PLAT_COLOR[r.plataforma] ?? '#64748b' }} />{r.plataforma}
                      </span>
                      <span className="tabular-nums text-slate-500">cobrado {formatMoney(r.app)}{r.comision ? <span className="text-amber-600"> · com {formatMoney(r.comision)}</span> : null}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <Bar frac={r.declarado / maxConc} color="#94a3b8" />
                        <Bar frac={r.app / maxConc} color={PLAT_COLOR[r.plataforma] ?? '#64748b'} />
                      </div>
                      <span className={`w-20 shrink-0 rounded-md px-1.5 py-0.5 text-right text-[11px] font-medium ${t.bg} ${t.text}`}>{formatMoney(r.diferencia)}</span>
                    </div>
                  </div>
                )
              })}
              <p className="pt-1 text-[11px] text-slate-400">Barra gris = declarado por el local · barra de color = cobrado por la app.</p>
            </div>
          )}
        </Card>
      </section>

      {/* Cuenta corriente + Fondo fijo (saldos actuales) */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Cuenta corriente — se debe a proveedores" icon={<Package size={16} />}
          right={<Link href="/cuenta-corriente" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">ver todo <ArrowRight size={12} /></Link>}>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-amber-600">{formatMoney(ctaCte.saldoPendiente)}</span>
            <span className="text-xs text-slate-400">saldo actual · {ctaCte.cantidadPendientes} movimiento{ctaCte.cantidadPendientes === 1 ? '' : 's'}</span>
          </div>
          {ctaCte.porProveedor.length === 0 ? <p className="py-2 text-sm text-slate-400">Sin deuda pendiente.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {ctaCte.porProveedor.slice(0, 6).map((p) => (
                  <tr key={p.nombre} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 text-slate-600">{p.nombre} <span className="text-xs text-slate-400">· {p.count}</span></td>
                    <td className="py-1.5 text-right tabular-nums font-medium text-slate-800">{formatMoney(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Fondo fijo — a reponer" icon={<PiggyBank size={16} />}
          right={<Link href="/fondo-fijo" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">ver todo <ArrowRight size={12} /></Link>}>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums text-amber-600">{formatMoney(fondoFijo.totalAReponer)}</span>
            <span className="text-xs text-slate-400">saldo actual · {fondoFijo.cantidad} local{fondoFijo.cantidad === 1 ? '' : 'es'} a reponer</span>
          </div>
          {fondoFijo.filas.length === 0 ? <p className="py-2 text-sm text-slate-400">Todos los locales con el fondo completo.</p> : (
            <table className="w-full text-sm">
              <tbody>
                {fondoFijo.filas.slice(0, 6).map((f) => (
                  <tr key={f.localId} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 text-slate-600">{f.localNombre}</td>
                    <td className={`py-1.5 text-right tabular-nums ${f.saldoActual < 0 ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>saldo {formatMoney(f.saldoActual)}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium text-amber-600">{formatMoney(f.aReponer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </main>
  )
}
