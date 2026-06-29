'use client'

import { useState } from 'react'
import { FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, TrendingUp, Link2 } from 'lucide-react'
import { mapearLocalPlataforma } from './actions'

interface LocalOption {
  id: number
  nombre: string
}

interface ResumenLocal {
  localId: number | null
  localNombre: string | null
  externalId: string
  storeId: string
  storeName: string
  fecha: string
  brutoCobrado: number
  netoLiquidado: number
  comision: number
  pedidos: number
  devoluciones: number
  mapeado: boolean
}

interface ResultOk {
  ok: true
  filasTotal: number
  filasMapeadas: number
  filasSinMapear: number
  resumen: ResumenLocal[]
  totales: { brutoCobrado: number; netoLiquidado: number; comision: number; pedidos: number; devoluciones: number }
}
interface ResultErr {
  ok: false
  error: string
  detalle?: string
}
type Result = ResultOk | ResultErr

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

export function MercadoPagoImport({ locales }: { locales: LocalOption[] }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [mapTarget, setMapTarget] = useState<Record<string, number>>({})
  const [mapStatus, setMapStatus] = useState<Record<string, 'idle' | 'saving' | 'done' | 'error'>>({})

  async function onMapear(externalId: string, storeName: string) {
    const localId = mapTarget[externalId] ?? locales[0]?.id
    if (!localId) return
    setMapStatus((s) => ({ ...s, [externalId]: 'saving' }))
    const res = await mapearLocalPlataforma({ plataformaCodigo: 'MD', restaurantId: externalId, nombre: storeName || externalId, localId })
    setMapStatus((s) => ({ ...s, [externalId]: res.ok ? 'done' : 'error' }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/mp/import', { method: 'POST', body: fd })
      setResult((await res.json()) as Result)
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Error de red' })
    } finally {
      setLoading(false)
    }
  }

  const mapeados = result?.ok ? result.resumen.filter((r) => r.mapeado) : []
  const sinMapear = result?.ok ? result.resumen.filter((r) => !r.mapeado) : []

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-slate-500" />
        <h2 className="font-medium text-slate-900">Mercado Pago — Mercado Delivery (Excel)</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Subí el reporte <span className="font-medium">“collection”</span> que bajás de Mercado Pago. Se agrupa por
        local y día, descontando devoluciones, y queda para conciliar contra lo declarado en el cierre. El local se
        identifica solo por el <span className="font-medium">N° de local (store_id)</span> de MP.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Archivo (.csv o .xlsx)</span>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
            <FileSpreadsheet size={18} className="shrink-0 text-slate-400" />
            <input
              name="archivo"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-medium file:text-white hover:file:bg-blue-700"
            />
          </div>
        </label>

        <button
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Procesando…' : 'Importar Excel de Mercado Pago'}
        </button>
      </form>

      {result && result.ok && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2 font-medium text-emerald-800">
            <CheckCircle2 size={18} />
            Importado: {result.filasMapeadas} local{result.filasMapeadas === 1 ? '' : 'es'} mapeado
            {result.filasMapeadas === 1 ? '' : 's'}
            {result.filasSinMapear > 0 && ` · ${result.filasSinMapear} sin mapear`}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-emerald-100 bg-white p-3">
              <p className="flex items-center gap-1 text-[12px] text-slate-500"><TrendingUp size={12} /> Bruto cobrado</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmt(result.totales.brutoCobrado)}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3">
              <p className="text-[12px] text-slate-500">Neto liquidado</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{fmt(result.totales.netoLiquidado)}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3">
              <p className="text-[12px] text-slate-500">Comisión MP</p>
              <p className="mt-0.5 font-semibold tabular-nums text-amber-700">{fmt(result.totales.comision)}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3">
              <p className="text-[12px] text-slate-500">Devoluciones</p>
              <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{result.totales.devoluciones}</p>
            </div>
          </div>

          {mapeados.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-medium">Local</th>
                    <th className="py-2 px-3 font-medium">Fecha</th>
                    <th className="py-2 px-3 text-right font-medium">Bruto</th>
                    <th className="py-2 px-3 text-right font-medium">Neto</th>
                    <th className="py-2 px-3 text-right font-medium">Comisión</th>
                    <th className="py-2 pl-3 text-right font-medium">Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {mapeados.map((r) => (
                    <tr key={`${r.externalId}-${r.fecha}`} className="border-b border-emerald-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-900">{r.localNombre}</td>
                      <td className="py-2 px-3 tabular-nums text-slate-600">{r.fecha}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{fmt(r.brutoCobrado)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-slate-700">{fmt(r.netoLiquidado)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-700">{fmt(r.comision)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums text-slate-600">
                        {r.pedidos}
                        {r.devoluciones > 0 && <span className="text-rose-600"> · {r.devoluciones} dev.</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sinMapear.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="mb-2 font-medium">Locales sin mapear — asignalos a un local y reimportá:</p>
              <ul className="flex flex-col gap-2">
                {sinMapear.map((r) => {
                  const st = mapStatus[r.externalId] ?? 'idle'
                  return (
                    <li key={r.externalId} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-2">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-slate-800">{r.storeName || r.externalId || '(sin nombre)'}</span>
                        {r.storeId && <span className="text-xs text-slate-500"> · store_id {r.storeId}</span>}
                        <span className="text-xs text-slate-500"> · </span>
                        <span className="tabular-nums text-slate-700">{fmt(r.brutoCobrado)}</span>
                      </span>
                      {st === 'done' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 size={14} /> Mapeado — reimportá el Excel
                        </span>
                      ) : (
                        <>
                          <select
                            value={mapTarget[r.externalId] ?? ''}
                            onChange={(e) => setMapTarget((m) => ({ ...m, [r.externalId]: Number(e.target.value) }))}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
                          >
                            <option value="" disabled>Elegí local…</option>
                            {locales.map((l) => (
                              <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => onMapear(r.externalId, r.storeName)}
                            disabled={st === 'saving' || (mapTarget[r.externalId] ?? locales[0]?.id) == null}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {st === 'saving' ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                            Mapear
                          </button>
                          {st === 'error' && <span className="text-xs text-rose-600">error</span>}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <p className="mt-3 text-sm text-emerald-700">
            Guardado. Andá a <span className="font-medium">Control</span> del local y día para ver la conciliación de
            Mercado Delivery (declarado vs cobrado).
          </p>
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle size={18} />
            {result.error}
          </div>
          {result.detalle && <p className="mt-1 text-xs text-rose-600">{result.detalle}</p>}
        </div>
      )}
    </section>
  )
}
