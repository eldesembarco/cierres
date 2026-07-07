import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { ayerAr } from '@/lib/fecha'
import { chocarLocalDia, type AutopsiaTango, type Hallazgo } from '@/lib/tango/chocarLocalDia'
import { Landmark, Lock, CheckCircle2, AlertTriangle, Info, Inbox, ArrowLeft, Sun, Moon } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ localId?: string; fecha?: string }>

export default async function ControlTangoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !puedeVerFinanzas(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver el control Tango.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : ayerAr()
  const localId = sp.localId && /^\d+$/.test(sp.localId) ? Number(sp.localId) : null

  const locales = await prisma.local.findMany({
    where: { activo: true, tangoSucursalId: { not: null } },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true },
  })
  const a = localId ? await chocarLocalDia(localId, fecha) : null

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <Landmark size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Control Tango — autopsia por local</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Choca lo que <b>declaró el encargado</b> contra lo que <b>facturó y cobró Tango</b>, canal por canal, con
        diagnóstico automático de los errores típicos.
        {' '}<Link href="/dashboard" className="inline-flex items-center gap-1 text-blue-600 hover:underline"><ArrowLeft size={12} /> volver al Panel</Link>
      </p>

      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Local</span>
          <select name="localId" defaultValue={localId ? String(localId) : ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-56">
            <option value="" disabled>Elegí un local…</option>
            {locales.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Fecha</span>
          <input name="fecha" type="date" defaultValue={fecha} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Analizar
        </button>
      </form>

      {!a ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Landmark size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">Elegí un local y una fecha, y tocá “Analizar”.</p>
          <p className="text-xs text-slate-400">También llegás acá desde el chip “vs Tango” o las alertas del Panel.</p>
        </div>
      ) : (
        <Autopsia a={a} />
      )}
    </main>
  )
}

function Autopsia({ a }: { a: AutopsiaTango }) {
  const gapTone = a.estado === 'cuadra' ? 'text-emerald-700' : a.estado === 'leve' ? 'text-amber-600' : a.estado === 'grave' ? 'text-rose-600' : 'text-slate-400'
  const maxHora = Math.max(1, ...a.tango.porHora.map((h) => h.importe))

  return (
    <>
      {/* Resumen */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumen label="Declarado" value={formatMoney(a.declarado.total)} sub={`Z tipeado ${formatMoney(a.declarado.zTipeado)}`} />
        <Resumen label="Facturado Tango" value={a.tango.facturacion != null ? formatMoney(a.tango.facturacion) : '—'}
          sub={a.tango.tickets != null ? `${a.tango.tickets} tickets` : 'sin sincronizar'} />
        <Resumen label="Diferencia" value={a.gap != null ? formatMoney(a.gap) : '—'} tone={gapTone}
          sub={a.gap != null ? (a.gap < 0 ? 'declaró de menos' : a.gap > 0 ? 'declaró de más' : 'exacto') : ''} />
        <Resumen label="Estado" value={a.estado === 'cuadra' ? 'Cuadra' : a.estado === 'leve' ? 'Revisar' : a.estado === 'grave' ? 'Grave' : 'Sin datos'} tone={gapTone} sub={a.localNombre} />
      </div>

      {/* Diagnóstico */}
      {a.hallazgos.length > 0 && (
        <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Diagnóstico automático</div>
          <div className="flex flex-col divide-y divide-slate-100">
            {a.hallazgos.map((h, i) => <HallazgoRow key={i} h={h} />)}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Choque canal por canal */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Choque canal por canal</div>
          {a.tango.cobros == null ? (
            <p className="px-4 py-6 text-sm text-slate-400">Sin detalle de cobros (bridge sin respuesta).</p>
          ) : a.choque.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">Sin movimientos.</p>
          ) : (
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Canal</th>
                  <th className="px-2 py-2 text-right font-medium">Declarado</th>
                  <th className="px-2 py-2 text-right font-medium">Tango cobró</th>
                  <th className="px-4 py-2 text-right font-medium">Dif</th>
                </tr>
              </thead>
              <tbody>
                {a.choque.map((c) => {
                  const ok = Math.abs(c.dif) <= 1000
                  return (
                    <tr key={c.canal} className="border-t border-slate-100">
                      <td className="px-4 py-1.5 text-slate-700">
                        {c.label}
                        {!c.verificable && <span className="ml-1 text-[10px] text-slate-400" title="Este canal no se valida contra cobros (efectivo va a caja fuerte / delivery no registra cobro de caja)">ref.</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{formatMoney(c.declarado)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600">{c.verificable ? formatMoney(c.tangoCobros) : <span className="text-slate-300">—</span>}</td>
                      <td className={`px-4 py-1.5 text-right font-medium ${!c.verificable ? 'text-slate-300' : ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {c.verificable ? (ok ? '✓' : formatMoney(c.dif)) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Declarado por turno + curva horaria */}
        <div className="flex flex-col gap-4">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Declarado por turno</div>
            {a.declarado.porTurno.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400"><Inbox size={16} /> No hay cierres cargados este día.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {a.declarado.porTurno.map((t) => (
                  <div key={t.turno} className="px-4 py-2.5">
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1">{t.turno === 'manana' ? <Sun size={12} /> : <Moon size={12} />} {t.turno === 'manana' ? 'Mañana' : 'Noche'}</span>
                      <span className="tabular-nums">total {formatMoney(t.total)} · Z {formatMoney(t.z)}</span>
                    </div>
                    {t.canales.map((c) => (
                      <div key={c.canal} className="flex justify-between text-sm">
                        <span className="text-slate-600">{c.label}</span>
                        <span className="tabular-nums text-slate-800">{formatMoney(c.monto)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">Facturación Tango por hora</div>
            {a.tango.porHora.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">Sin datos sincronizados para este día.</p>
            ) : (
              <div className="flex flex-col gap-1 px-4 py-3">
                {a.tango.porHora.map((h) => (
                  <div key={h.hora} className="flex items-center gap-2 text-xs">
                    <span className={`w-8 shrink-0 text-right tabular-nums ${h.hora <= 5 ? 'font-semibold text-amber-600' : 'text-slate-400'}`}>{h.hora}h</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className={`h-full rounded ${h.hora <= 5 ? 'bg-amber-400' : 'bg-blue-500'}`} style={{ width: `${Math.max(2, (h.importe / maxHora) * 100)}%` }} />
                    </div>
                    <span className="w-20 shrink-0 text-right tabular-nums text-slate-600">{formatMoney(h.importe)}</span>
                  </div>
                ))}
                {a.tango.porHora.some((h) => h.hora <= 5) && (
                  <p className="pt-1 text-[11px] text-amber-600">Las barras ámbar son venta de madrugada (después de medianoche): lo que más se olvida al cerrar.</p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Resumen({ label, value, sub, tone = 'text-slate-900' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

function HallazgoRow({ h }: { h: Hallazgo }) {
  const cfg = h.tono === 'rojo'
    ? { icon: <AlertTriangle size={16} className="text-rose-500" />, bg: 'bg-rose-50/50' }
    : h.tono === 'ambar'
      ? { icon: <AlertTriangle size={16} className="text-amber-500" />, bg: 'bg-amber-50/40' }
      : { icon: h.titulo.startsWith('Cuadra') ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Info size={16} className="text-slate-400" />, bg: '' }
  return (
    <div className={`flex items-start gap-2.5 px-4 py-2.5 ${cfg.bg}`}>
      <span className="mt-0.5 shrink-0">{cfg.icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-800">{h.titulo}</p>
        <p className="text-xs text-slate-500">{h.detalle}</p>
      </div>
    </div>
  )
}
