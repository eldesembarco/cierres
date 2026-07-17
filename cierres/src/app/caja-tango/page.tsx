import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { ayerAr, hoyAr } from '@/lib/fecha'
import { getResumenCajaCached } from '@/lib/cachedData'
import { TangoBridgeError } from '@/lib/tango/cobrosBridge'
import type { ResumenCaja, CajaLocal } from '@/lib/tango/resumenCaja'
import { ReceiptText, Lock, XCircle, Inbox, Store, Coins, Info } from 'lucide-react'

// El primer hit de cada fecha va al bridge de Tango por el túnel (lento);
// después queda en el Data Cache. Margen de tiempo para ese primer hit.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ fecha?: string }>

// Con centavos, como la pantalla del Adicionista: así cada card SUMA exacto (el
// formatMoney general redondea al peso y las filas no cerrarían contra el total).
const money2 = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// "HH:mm" en hora argentina (UTC−3) desde un ISO UTC.
function horaAr(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

// Fecha válida de verdad (2026-02-31 no parsea) y no futura.
function fechaValida(s: string | undefined): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  if (Number.isNaN(Date.parse(`${s}T00:00:00Z`)) || s > hoyAr()) return null
  return s
}

export default async function CajaTangoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !puedeVerFinanzas(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver la caja de Tango.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const fecha = fechaValida(sp.fecha) ?? ayerAr()

  let r: ResumenCaja | null = null
  let bridgeError: string | null = null
  try {
    r = await getResumenCajaCached(fecha)
  } catch (e) {
    // Solo el bridge caído se muestra acá; un error de la base u otro NO es
    // "server de Tango apagado" → que lo maneje la página de error general.
    if (!(e instanceof TangoBridgeError)) throw e
    bridgeError = e.message
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <ReceiptText size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Caja Tango — resumen por local</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        El mismo <b>“Resumen de caja”</b> que muestra el Adicionista de Tango en cada local (las cuentas tal cual
        Tango las reporta), pero todos los locales juntos. Reemplaza las fotos de la pantalla.
      </p>

      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Fecha (día comercial)</span>
          <input name="fecha" type="date" defaultValue={fecha} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Ver día
        </button>
      </form>

      {bridgeError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div>
            <b>No pude traer la caja de Tango.</b> {bridgeError}
            <div className="mt-0.5 text-xs text-red-700/80">
              El server de Tango puede estar apagado o el túnel caído. Reintentá en un rato.
            </div>
          </div>
        </div>
      ) : r && r.locales.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">Tango no registró cobros de caja para este día en ningún local.</p>
          <p className="text-xs text-slate-400">Los datos aparecen a medida que el replicador de Tango sincroniza.</p>
        </div>
      ) : r ? (
        <>
          {/* KPIs del día */}
          <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi icon={<Coins size={16} />} label="Total cobrado (Tango)" value={money2.format(r.totalGeneral)} />
            <Kpi icon={<Store size={16} />} label="Locales con caja" value={String(r.locales.length)} />
            <Kpi icon={<Inbox size={16} />} label="Sin cobros este día" value={String(r.sinCobros.length)} />
          </div>
          {r.obtenidoEn && (
            <p className="mb-4 text-right text-[11px] text-slate-400">
              Consultado a Tango a las {horaAr(r.obtenidoEn)} hs
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {r.locales.map((l) => (
              <CajaCard key={l.localId} l={l} />
            ))}
          </div>

          {r.sinCobros.length > 0 && (
            <p className="mt-5 text-xs text-slate-400">
              Sin cobros este día: {r.sinCobros.map((l) => l.nombre).join(' · ')}
            </p>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Espejo del Resumen de caja del Adicionista (sin CAJA FUERTE ni saldos iniciales): el efectivo de
              mostrador va a caja fuerte y no figura acá. Para chocar contra lo declarado usá <b>Cobros Tango</b>.
            </span>
          </div>
        </>
      ) : null}
    </main>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

// Card estilo "Resumen de caja" de Tango: cuentas + total destacado.
function CajaCard({ l }: { l: CajaLocal }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-sm font-semibold text-slate-900">{l.nombre}</h2>
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{l.marca}</span>
        </div>
      </div>
      <table className="w-full text-sm tabular-nums">
        <tbody>
          {l.cuentas.map((c) => (
            <tr key={c.cuenta} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-1.5 text-xs text-slate-600">{c.cuenta}</td>
              <td className="px-4 py-1.5 text-right text-slate-800">{money2.format(c.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-auto flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</span>
        <span className="text-base font-bold tabular-nums text-amber-700">{money2.format(l.total)}</span>
      </div>
    </section>
  )
}
