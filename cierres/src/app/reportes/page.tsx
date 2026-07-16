import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { armarResumenDia } from '@/lib/mp/reporteDia'
import { ayerAr } from '@/lib/fecha'
import { formatMoney } from '@/lib/money'
import type { ResumenLocal } from '@/lib/mp/consolidarLiberaciones'
import { FileSpreadsheet, Lock, Download, Inbox, AlertTriangle, Store, Receipt, Coins } from 'lucide-react'

// Las operaciones del día salen del Data Cache (operacionesMpDia); el SFTP solo
// se lee al vencer el TTL. Margen de tiempo para ese caso.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ fecha?: string }>

const nombreLocal = (s: string) => (s === '(sin nombre)' ? 'Sin local (retiros / ajustes)' : s)

export default async function ReportesMpPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !puedeVerFinanzas(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver los reportes de Mercado Pago.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : ayerAr()

  let resumen: ResumenLocal[] = []
  let total: ResumenLocal | null = null
  let totalOperaciones = 0
  let error: string | null = null
  try {
    const r = await armarResumenDia(fecha)
    resumen = r.resumen
    total = r.total
    totalOperaciones = r.totalOperaciones
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const hayDatos = totalOperaciones > 0 && total != null
  const descargarHref = `/api/mp/reporte?fecha=${fecha}`

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Encabezado */}
      <div className="mb-1 flex items-center gap-2">
        <FileSpreadsheet size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Reportes de Mercado Pago</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Consolidado de Liberaciones del día (todos los locales). El mismo Excel que se envía por mail cada mañana.
      </p>

      {/* Filtro de fecha + descarga */}
      <form
        method="GET"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Fecha (día de origen de la venta)</span>
          <input
            name="fecha"
            type="date"
            defaultValue={fecha}
            className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ver
          </button>
          {hayDatos && (
            <a
              href={descargarHref}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <Download size={15} />
              Descargar Excel
            </a>
          )}
        </div>
      </form>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-10 text-center shadow-sm">
          <AlertTriangle size={30} className="text-amber-500" />
          <p className="text-sm font-medium text-amber-800">No pude leer los reportes de Mercado Pago.</p>
          <p className="max-w-md text-xs text-amber-700">{error}</p>
          <p className="text-xs text-amber-600">Reintentá en unos segundos o probá con otra fecha.</p>
        </div>
      ) : !hayDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">No hay operaciones de Mercado Pago para el {fechaCorta(fecha)}.</p>
          <p className="text-xs text-slate-400">
            Los reportes del día aparecen recién a la mañana siguiente (las liberaciones tienen demora).
          </p>
        </div>
      ) : (
        <>
          {/* KPIs del día */}
          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard icon={<Store size={16} />} titulo="Locales" valor={String(resumen.length)} tono="blue" />
            <KpiCard icon={<Receipt size={16} />} titulo="Operaciones" valor={String(total!.operaciones)} tono="slate" />
            <KpiCard icon={<Coins size={16} />} titulo="Monto neto liberado" valor={formatMoney(total!.neto)} tono="green" />
          </section>

          {/* Resumen por local */}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Resumen por local · {fechaCorta(fecha)}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-medium">Local</th>
                    <th className="px-3 py-2 text-right font-medium">Oper.</th>
                    <th className="px-3 py-2 text-right font-medium">Aprob.</th>
                    <th className="px-3 py-2 text-right font-medium">Valor compra</th>
                    <th className="px-3 py-2 text-right font-medium">Comisiones</th>
                    <th className="px-4 py-2 text-right font-medium">Monto neto</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((r) => (
                    <tr key={r.local} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 font-medium text-slate-800">{nombreLocal(r.local)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.operaciones}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.aprobados}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">{formatMoney(r.bruto)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{formatMoney(r.comisiones)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">{formatMoney(r.neto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                    <td className="px-4 py-2.5">TOTAL</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{total!.operaciones}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{total!.aprobados}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(total!.bruto)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{formatMoney(total!.comisiones)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{formatMoney(total!.neto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          <p className="mt-3 text-xs text-slate-400">
            Las comisiones y los retiros figuran en negativo. El Excel trae además la hoja <b>Detalle</b> (operación por operación).
          </p>
        </>
      )}
    </main>
  )
}

function fechaCorta(fecha: string): string {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha
}

const TONOS: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
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
