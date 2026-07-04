import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas, esCentral } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { hoyAr, ayerAr, primerDiaDelMesAr } from '@/lib/fecha'
import { resumenBi, type LocalBi, type ArticuloBi } from '@/lib/ventas/bi'
import { sincronizarVentas } from '@/app/actions/tango'
import { TrendingUp, TrendingDown, Lock, Inbox, RefreshCw, AlertTriangle, Clock3, Trophy, Minus } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ desde?: string; hasta?: string; localId?: string; syncMsg?: string }>

const YMD = /^\d{4}-\d{2}-\d{2}$/
const formatInt = (n: number) => Math.round(n).toLocaleString('es-AR')
const formatPct = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

export default async function VentasPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !puedeVerFinanzas(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver el BI de ventas.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const desde = sp.desde && YMD.test(sp.desde) ? sp.desde : primerDiaDelMesAr()
  const hasta = sp.hasta && YMD.test(sp.hasta) && sp.hasta >= desde ? sp.hasta : hoyAr()
  const localId = sp.localId && /^\d+$/.test(sp.localId) ? Number(sp.localId) : undefined

  const [bi, locales] = await Promise.all([
    resumenBi({ desde, hasta, localId }),
    prisma.local.findMany({
      where: { activo: true, tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, marca: { select: { nombre: true } } },
      orderBy: [{ marca: { nombre: 'asc' } }, { nombre: 'asc' }],
    }),
  ])
  const maxHora = Math.max(1, ...bi.horas.map((h) => h.monto))
  const puedeSync = esCentral(session.user.rol)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Ventas (BI)</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Venta <b>facturada en Tango</b> por local, hora y artículo (misma definición que el Z, neta de notas de
        crédito). Se sincroniza todas las mañanas; no es la carga de los encargados.
      </p>

      {sp.syncMsg && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            sp.syncMsg.startsWith('Error')
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {sp.syncMsg}
        </div>
      )}

      {/* Filtros */}
      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Desde</span>
          <input name="desde" type="date" defaultValue={desde} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Hasta</span>
          <input name="hasta" type="date" defaultValue={hasta} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Local</span>
          <select name="localId" defaultValue={localId ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los locales</option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre} · {l.marca.nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Ver período
        </button>
      </form>

      {bi.sinDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Todavía no hay ventas sincronizadas para este período.</p>
          <p className="max-w-xl text-sm text-slate-500">
            El BI se alimenta de dos endpoints nuevos del bridge de Tango (<code>/ventas-horas</code> y{' '}
            <code>/ventas-articulos</code>) que <b>sistemas todavía tiene que publicar</b> (el pedido está en{' '}
            <code>docs/tango-bridge-ventas-handoff.md</code>). Apenas estén, la sincronización diaria llena esto solo.
          </p>
          {bi.ultimaSync && (
            <p className="text-xs text-slate-400">Última sincronización: {bi.ultimaSync.fecha}</p>
          )}
        </div>
      ) : (
        <>
          {bi.diasSinDatos.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <b>Cobertura incompleta:</b> faltan {bi.diasSinDatos.length} día(s) sin sincronizar en el rango (
                {bi.diasSinDatos.slice(0, 6).join(', ')}
                {bi.diasSinDatos.length > 6 ? '…' : ''}). Los totales pueden quedar cortos.
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Facturación" value={formatMoney(bi.monto)} />
            <Kpi label="Tickets" value={formatInt(bi.tickets)} />
            <Kpi label="Ticket promedio" value={formatMoney(bi.ticketPromedio)} />
            <KpiVariacion label="vs período anterior" variacion={bi.variacion} />
          </div>

          {/* Ranking de locales */}
          <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Trophy size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Facturación por local</h2>
              <span className="ml-auto text-xs text-slate-400">período {desde} a {hasta}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="py-2 font-medium">Local</th>
                    <th className="py-2 text-right font-medium">Facturación</th>
                    <th className="hidden py-2 pl-4 font-medium sm:table-cell">Share</th>
                    <th className="py-2 text-right font-medium">Tickets</th>
                    <th className="py-2 text-right font-medium">Ticket prom.</th>
                    <th className="px-4 py-2 text-right font-medium">vs anterior</th>
                  </tr>
                </thead>
                <tbody>
                  {bi.locales.map((l, i) => (
                    <FilaLocal key={l.localId} l={l} pos={i + 1} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Curva horaria */}
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock3 size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Venta por hora</h2>
              <span className="ml-auto text-xs text-slate-400">
                {localId ? locales.find((l) => l.id === localId)?.nombre : 'todos los locales'}
              </span>
            </div>
            <div className="flex h-40 items-end gap-1">
              {bi.horas.map((h) => (
                <div key={h.hora} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className="rounded-t bg-blue-500/80 transition-colors group-hover:bg-blue-600"
                    style={{ height: `${Math.max(2, (h.monto / maxHora) * 100)}%` }}
                  />
                  <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[11px] text-white group-hover:block">
                    {h.hora}hs · {formatMoney(h.monto)} · {formatInt(h.tickets)} tickets
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1 text-center text-[10px] text-slate-400">
              {bi.horas.map((h) => (
                <div key={h.hora} className="flex-1">{h.hora}</div>
              ))}
            </div>
          </section>

          {/* Top artículos */}
          <div className="mb-6 grid gap-3 lg:grid-cols-2">
            <TablaArticulos titulo="Top artículos por facturación" articulos={bi.topPorMonto} resaltar="monto" />
            <TablaArticulos titulo="Top artículos por cantidad" articulos={bi.topPorCantidad} resaltar="cantidad" />
          </div>
        </>
      )}

      {/* Sync manual (solo central/admin) */}
      {puedeSync && (
        <form action={sincronizarVentas} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end">
          <div className="flex items-center gap-2 text-sm text-slate-600 sm:mr-auto">
            <RefreshCw size={15} className="text-slate-400" />
            <span>
              Sincronizar manualmente desde Tango
              {bi.ultimaSync ? ` · última: ${bi.ultimaSync.fecha}` : ' · nunca se sincronizó'}
            </span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Desde</span>
            <input name="syncDesde" type="date" defaultValue={ayerAr()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 tabular-nums outline-none focus:border-blue-500" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Hasta</span>
            <input name="syncHasta" type="date" defaultValue={ayerAr()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 tabular-nums outline-none focus:border-blue-500" />
          </label>
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">
            Sincronizar
          </button>
        </form>
      )}
    </main>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function KpiVariacion({ label, variacion }: { label: string; variacion: number | null }) {
  const Icon = variacion == null ? Minus : variacion >= 0 ? TrendingUp : TrendingDown
  const cls = variacion == null ? 'text-slate-400' : variacion >= 0 ? 'text-emerald-700' : 'text-red-600'
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums ${cls}`}>
        <Icon size={18} />
        {variacion == null ? 'sin base' : formatPct(variacion)}
      </div>
    </div>
  )
}

function FilaLocal({ l, pos }: { l: LocalBi; pos: number }) {
  const varCls = l.variacion == null ? 'text-slate-400' : l.variacion >= 0 ? 'text-emerald-700' : 'text-red-600'
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 text-slate-400">{pos}</td>
      <td className="py-2">
        <span className="font-medium text-slate-800">{l.nombre}</span>
        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{l.marca}</span>
      </td>
      <td className="py-2 text-right font-semibold text-slate-800">{formatMoney(l.monto)}</td>
      <td className="hidden py-2 pl-4 sm:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round(l.share * 100)}%` }} />
          </div>
          <span className="text-xs text-slate-500">{(l.share * 100).toFixed(1)}%</span>
        </div>
      </td>
      <td className="py-2 text-right text-slate-600">{formatInt(l.tickets)}</td>
      <td className="py-2 text-right text-slate-600">{formatMoney(l.ticketPromedio)}</td>
      <td className={`px-4 py-2 text-right font-medium ${varCls}`}>
        {l.variacion == null ? '—' : formatPct(l.variacion)}
      </td>
    </tr>
  )
}

function TablaArticulos({ titulo, articulos, resaltar }: { titulo: string; articulos: ArticuloBi[]; resaltar: 'monto' | 'cantidad' }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
      </div>
      {articulos.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">Sin artículos en el período.</p>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-medium">Artículo</th>
              <th className="py-2 text-right font-medium">Cantidad</th>
              <th className="px-4 py-2 text-right font-medium">Facturación</th>
            </tr>
          </thead>
          <tbody>
            {articulos.map((a) => (
              <tr key={a.codigo} className="border-t border-slate-100">
                <td className="px-4 py-1.5">
                  <span className="text-slate-800">{a.descripcion}</span>
                  {a.rubro && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{a.rubro}</span>}
                </td>
                <td className={`py-1.5 text-right ${resaltar === 'cantidad' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {a.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
                </td>
                <td className={`px-4 py-1.5 text-right ${resaltar === 'monto' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                  {formatMoney(a.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
