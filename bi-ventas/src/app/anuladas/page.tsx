import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { hoyAr, primerDiaDelMesAr } from '@/lib/fecha'
import { resumenAnuladas } from '@/lib/biAnuladas'
import { BiTabs } from '@/components/BiTabs'
import { Ban, Inbox, AlertTriangle, Store, Bike } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ desde?: string; hasta?: string; localId?: string }>

const YMD = /^\d{4}-\d{2}-\d{2}$/
const formatInt = (n: number) => Math.round(n).toLocaleString('es-AR')

export default async function AnuladasPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const desde = sp.desde && YMD.test(sp.desde) ? sp.desde : primerDiaDelMesAr()
  const hasta = sp.hasta && YMD.test(sp.hasta) && sp.hasta >= desde ? sp.hasta : hoyAr()
  const localId = sp.localId && /^\d+$/.test(sp.localId) ? Number(sp.localId) : undefined

  const [r, locales] = await Promise.all([
    resumenAnuladas({ desde, hasta, localId }),
    prisma.local.findMany({
      where: { activo: true, tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, marca: { select: { nombre: true } } },
      orderBy: [{ marca: { nombre: 'asc' } }, { nombre: 'asc' }],
    }),
  ])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <BiTabs actual="/anuladas" />
      <div className="mb-1 flex items-center gap-2">
        <Ban size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Comandas anuladas</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Comandas <b>anuladas en Tango</b> por local. Las anuladas <b>con importe</b> son las que hay que auditar
        (una venta que estuvo cargada y se borró); las de $0 son mesas/pedidos cancelados antes de cobrar.
        {r.ultimaSync && <> Última sincronización con datos: <b>{r.ultimaSync}</b>.</>}
      </p>

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
              <option key={l.id} value={l.id}>{l.nombre} · {l.marca.nombre}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Aplicar
        </button>
      </form>

      {r.sinDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">Todavía no hay anulaciones sincronizadas.</p>
          <p className="text-xs text-slate-400">El sync diario las trae solo; también podés sincronizar desde la pestaña Ventas.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Importe anulado" value={formatMoney(r.totalImporte)} tone={r.totalImporte > 0 ? 'rose' : 'emerald'} />
            <Kpi label="% sobre facturación" value={r.pctVenta != null ? `${r.pctVenta.toLocaleString('es-AR')}%` : '—'}
              tone={r.pctVenta != null && r.pctVenta >= 1 ? 'rose' : 'slate'} sub={`facturación ${formatMoney(r.facturacion)}`} />
            <Kpi label="Anuladas con importe" value={formatInt(r.totalConImporte)} tone="amber" sub="las que hay que mirar" />
            <Kpi label="Anuladas totales" value={formatInt(r.totalCantidad)} tone="slate" sub="incluye las de $0" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Ranking por local */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Por local — ordenado por importe anulado</div>
              {r.porLocal.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">Sin anulaciones en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2 font-medium">Local</th>
                        <th className="px-2 py-2 text-right font-medium">Anuladas</th>
                        <th className="px-2 py-2 text-right font-medium" title="Anuladas con importe > 0">c/importe</th>
                        <th className="px-2 py-2 text-right font-medium">Importe</th>
                        <th className="px-4 py-2 text-right font-medium" title="Importe anulado sobre facturación del período">% venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.porLocal.map((l) => {
                        const alto = l.pctVenta != null && l.pctVenta >= 1
                        return (
                          <tr key={l.localId} className="border-t border-slate-100">
                            <td className="px-4 py-1.5 text-slate-700">{l.nombre}</td>
                            <td className="px-2 py-1.5 text-right text-slate-500">{l.cantidad}</td>
                            <td className="px-2 py-1.5 text-right text-slate-700">{l.conImporte}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-slate-800">{l.importe > 0 ? formatMoney(l.importe) : <span className="text-slate-300">—</span>}</td>
                            <td className={`px-4 py-1.5 text-right font-medium ${alto ? 'text-rose-600' : 'text-slate-500'}`}>
                              {l.pctVenta != null ? `${l.pctVenta.toLocaleString('es-AR')}%` : '—'}
                              {alto && <AlertTriangle size={12} className="ml-1 inline text-rose-500" />}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Detalle: anuladas con importe */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
                Detalle — anuladas con importe {r.detalleRecortado && <span className="font-normal text-slate-400">(últimas {r.detalle.length})</span>}
              </div>
              {r.detalle.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">Ninguna anulada con importe en el período. 👏</p>
              ) : (
                <div className="max-h-[520px] overflow-y-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2 font-medium">Fecha</th>
                        <th className="px-2 py-2 font-medium">Hora</th>
                        <th className="px-2 py-2 font-medium">Local</th>
                        <th className="px-2 py-2 font-medium">Tipo</th>
                        <th className="px-4 py-2 text-right font-medium">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.detalle.map((d, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-4 py-1.5 text-slate-600">{d.fecha.slice(8)}/{d.fecha.slice(5, 7)}</td>
                          <td className="px-2 py-1.5 text-slate-600">{d.hora}</td>
                          <td className="px-2 py-1.5 text-slate-700">{d.nombre}</td>
                          <td className="px-2 py-1.5 text-slate-500">
                            {d.tipoPedido === 'D'
                              ? <span className="inline-flex items-center gap-1"><Bike size={12} /> Delivery</span>
                              : <span className="inline-flex items-center gap-1"><Store size={12} /> Salón</span>}
                          </td>
                          <td className="px-4 py-1.5 text-right font-medium text-rose-600">{formatMoney(d.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'slate' | 'emerald' | 'rose' | 'amber' }) {
  const toneCls = { slate: 'text-slate-900', emerald: 'text-emerald-700', rose: 'text-rose-600', amber: 'text-amber-600' }[tone]
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
