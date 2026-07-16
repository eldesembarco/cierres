import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas, esCentral } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { hoyAr, primerDiaDelMesAr } from '@/lib/fecha'
import { MOTIVOS_ANULACION, MOTIVO_LABEL, type AnuladaDetalle } from '@/lib/tango/anuladas'
import { getResumenAnuladasCached } from '@/lib/cachedData'
import { justificarAnulacion } from './actions'
import { Ban, Lock, Inbox, AlertTriangle, Store, Bike, CheckCircle2, MessageSquareText, RefreshCw, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ desde?: string; hasta?: string; localId?: string }>

const YMD = /^\d{4}-\d{2}-\d{2}$/
const formatInt = (n: number) => Math.round(n).toLocaleString('es-AR')

// "dd/mm HH:mm" en hora argentina (UTC−3) a partir de un ISO UTC.
function fechaHoraAr(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} hs`
}

function restarDias(ymd: string, n: number): string {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10)
}

export default async function AnulacionesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  const rol = session?.user.rol
  const esEncargado = rol === 'encargado'
  if (!session || (!puedeVerFinanzas(rol!) && !esEncargado)) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver el informe de anulaciones.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const desde = sp.desde && YMD.test(sp.desde) ? sp.desde : primerDiaDelMesAr()
  const hasta = sp.hasta && YMD.test(sp.hasta) && sp.hasta >= desde ? sp.hasta : hoyAr()
  // El encargado SIEMPRE ve su propio local (ignora el query param).
  const localId = esEncargado
    ? session.user.localId ?? undefined
    : sp.localId && /^\d+$/.test(sp.localId) ? Number(sp.localId) : undefined
  const puedeJustificar = esEncargado || esCentral(rol!)

  const [r, locales] = await Promise.all([
    getResumenAnuladasCached({ desde, hasta, localId }),
    prisma.local.findMany({
      where: { activo: true, tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, marca: { select: { nombre: true } } },
      orderBy: [{ marca: { nombre: 'asc' } }, { nombre: 'asc' }],
    }),
  ])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Ban size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">
          {esEncargado ? 'Anulaciones de tu local' : 'Anulaciones — comandas anuladas en Tango'}
        </h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        {esEncargado ? (
          <>Estas son las comandas <b>anuladas en Tango</b> de tu local. Las que tienen importe hay que{' '}
          <b>justificarlas</b>: elegí el motivo y agregá un detalle si hace falta. Administración las revisa.</>
        ) : (
          <>Comandas <b>anuladas en Tango</b> por local. Las anuladas <b>con importe</b> requieren justificación
          del local; acá se ve quién justificó qué y quién debe.</>
        )}
        {r.ultimaSync && <> Datos hasta el <b>{r.ultimaSync}</b>.</>}
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
        {!esEncargado && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Local</span>
            <select name="localId" defaultValue={localId ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
              <option value="">Todos los locales</option>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre} · {l.marca.nombre}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Aplicar
        </button>
      </form>

      {/* Aviso de días "frescos": Tango puede seguir reponiendo datos de los últimos días. */}
      {hasta >= restarDias(hoyAr(), 2) && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-800">
          <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
          <span>
            El rango incluye días recientes: <b>los últimos 2-3 días pueden seguir completándose</b> a medida que
            Tango termina de replicar desde los locales (el sistema los re-trae solo cada mañana). Los días
            anteriores ya son definitivos.
          </span>
        </div>
      )}

      {r.sinDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">Todavía no hay anulaciones sincronizadas.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Última sincronización" icon={<RefreshCw size={13} />}
              value={r.sincronizadoEn ? fechaHoraAr(r.sincronizadoEn) : '—'}
              tone="slate"
              sub={r.ultimaSync ? `con datos hasta el ${r.ultimaSync.slice(8)}/${r.ultimaSync.slice(5, 7)}` : ''} />
            <Kpi label="Sin justificar" value={formatInt(r.totalSinJustificar)}
              tone={r.totalSinJustificar > 0 ? 'rose' : 'emerald'}
              sub={r.totalSinJustificar > 0 ? 'pendientes de motivo' : 'todo justificado 👏'} />
            <Kpi label="Importe anulado" value={formatMoney(r.totalImporte)} tone={r.totalImporte > 0 ? 'amber' : 'emerald'}
              sub={r.pctVenta != null ? `${r.pctVenta.toLocaleString('es-AR')}% de la facturación` : ''} />
            <Kpi label="Con importe" value={formatInt(r.totalConImporte)} tone={r.totalConImporte > 0 ? 'rose' : 'emerald'}
              sub="ventas borradas: se justifican" />
            <Kpi label="En $0" value={formatInt(r.totalCantidad - r.totalConImporte)} tone="slate"
              sub="canceladas antes de cobrar: normal" />
          </div>

          <div className={`grid grid-cols-1 gap-4 ${esEncargado ? '' : 'lg:grid-cols-5'}`}>
            {/* Ranking por local (solo administración) */}
            {!esEncargado && (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
                <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Por local</div>
                {r.porLocal.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400">Sin anulaciones en el período.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm tabular-nums">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-2 font-medium">Local</th>
                          <th className="px-2 py-2 text-right font-medium" title="Ventas borradas después de cargadas: requieren justificación">c/importe</th>
                          <th className="px-2 py-2 text-right font-medium" title="Canceladas antes de cobrar: no requieren justificación">en $0</th>
                          <th className="px-2 py-2 text-right font-medium">Importe</th>
                          <th className="px-2 py-2 text-right font-medium">% venta</th>
                          <th className="px-2 py-2 text-right font-medium" title="Anuladas con importe sin justificar">deben</th>
                          <th className="px-4 py-2 text-right font-medium" title="Hasta qué fecha llegó la información de este local">datos hasta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.porLocal.map((l) => {
                          const alto = l.pctVenta != null && l.pctVenta >= 1
                          return (
                            <tr key={l.localId} className="border-t border-slate-100">
                              <td className="px-4 py-1.5 text-slate-700">{l.nombre}</td>
                              <td className="px-2 py-1.5 text-right">
                                {l.conImporte > 0
                                  ? <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700">{l.conImporte}</span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-2 py-1.5 text-right text-slate-400">{l.cantidad - l.conImporte > 0 ? l.cantidad - l.conImporte : '—'}</td>
                              <td className="px-2 py-1.5 text-right font-medium text-slate-800">{l.importe > 0 ? formatMoney(l.importe) : <span className="text-slate-300">—</span>}</td>
                              <td className={`px-2 py-1.5 text-right font-medium ${alto ? 'text-rose-600' : 'text-slate-500'}`}>
                                {l.pctVenta != null ? `${l.pctVenta.toLocaleString('es-AR')}%` : '—'}
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                {l.sinJustificar > 0
                                  ? <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-600">{l.sinJustificar}</span>
                                  : l.conImporte > 0
                                    ? <CheckCircle2 size={14} className="ml-auto inline text-emerald-500" />
                                    : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-1.5 text-right text-xs tabular-nums text-slate-500">
                                {l.datosHasta ? `${l.datosHasta.slice(8)}/${l.datosHasta.slice(5, 7)}` : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                      <b className="text-rose-600">c/importe</b> = venta que estuvo cargada y se borró (se audita y justifica) ·{' '}
                      <b>en $0</b> = mesa/pedido cancelado antes de cobrar (operación normal) ·{' '}
                      <b>datos hasta</b> = última fecha con información del local.
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Detalle con justificación */}
            <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${esEncargado ? '' : 'lg:col-span-3'}`}>
              <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
                Anuladas con importe {r.detalleRecortado && <span className="font-normal text-slate-400">(últimas {r.detalle.length})</span>}
              </div>
              {r.detalle.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">Ninguna anulada con importe en el período. 👏</p>
              ) : (
                <div className="flex max-h-[640px] flex-col divide-y divide-slate-100 overflow-y-auto">
                  {r.detalle.map((d, i) => (
                    <FilaAnulada key={i} d={d} mostrarLocal={!esEncargado} puedeJustificar={puedeJustificar} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  )
}

function FilaAnulada({ d, mostrarLocal, puedeJustificar }: { d: AnuladaDetalle; mostrarLocal: boolean; puedeJustificar: boolean }) {
  return (
    <div className={`px-4 py-2.5 ${!d.justificacion ? 'bg-rose-50/40' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="tabular-nums text-slate-500">{d.fecha.slice(8)}/{d.fecha.slice(5, 7)} {d.hora}</span>
        {mostrarLocal && <span className="font-medium text-slate-700">{d.nombre}</span>}
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          {d.tipoPedido === 'D' ? <><Bike size={12} /> Delivery</> : <><Store size={12} /> Salón</>}
        </span>
        <span className="ml-auto font-semibold tabular-nums text-rose-600">{formatMoney(d.importe)}</span>
      </div>

      {d.justificacion ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
          <MessageSquareText size={13} className="mt-0.5 shrink-0 text-emerald-500" />
          <span>
            <b>{MOTIVO_LABEL[d.justificacion.motivo] ?? d.justificacion.motivo}</b>
            {d.justificacion.detalle && <> — {d.justificacion.detalle}</>}
            <span className="text-slate-400"> · {d.justificacion.porNombre}</span>
          </span>
        </p>
      ) : puedeJustificar ? (
        <form action={justificarAnulacion} className="mt-1.5 flex flex-wrap items-center gap-2">
          <input type="hidden" name="fechaHora" value={d.fechaHoraIso} />
          <input type="hidden" name="importe" value={d.importe} />
          <input type="hidden" name="localId" value={d.localId} />
          <select name="motivo" required defaultValue="" className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500">
            <option value="" disabled>Motivo…</option>
            {MOTIVOS_ANULACION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input name="detalle" placeholder="Detalle (opcional, obligatorio en Otro)" className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500" />
          <button type="submit" className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
            Justificar
          </button>
        </form>
      ) : (
        <p className="mt-1 flex items-center gap-1 text-xs text-rose-500"><AlertTriangle size={12} /> Sin justificar por el local</p>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, tone, icon }: {
  label: string; value: string; sub?: string; tone: 'slate' | 'emerald' | 'rose' | 'amber'; icon?: React.ReactNode
}) {
  const toneCls = { slate: 'text-slate-900', emerald: 'text-emerald-700', rose: 'text-rose-600', amber: 'text-amber-600' }[tone]
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1 text-xs font-medium text-slate-500">{icon}{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
