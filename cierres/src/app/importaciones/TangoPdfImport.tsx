'use client'

import { useState } from 'react'
import { FileText, Receipt, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface LocalOption {
  id: number
  nombre: string
}

interface Venta {
  canal: string
  monto: number
}

interface ResultOk {
  ok: true
  localId: number
  fecha: string
  turno: string
  montoZ: number
  cantidadTickets: number | null
  ventas: Venta[]
}

interface ResultErr {
  ok: false
  error: string
  muestra?: string
  detalle?: string
}

type Result = ResultOk | ResultErr

const CANAL_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjetas: 'Tarjetas',
  rappi: 'Rappi',
  pedidosya: 'PedidosYa',
  pedidosya_efectivo: 'PedidosYa (efectivo)',
  mercado_pedidos: 'Mercado Delivery',
  mercadopago: 'Mercado Pago / QR',
  uber: 'Uber',
  delivery_propio: 'Delivery propio',
  varios: 'Varios',
}

const TURNO_LABEL: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde' }

const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

export function TangoPdfImport({ locales, defaultLocalId }: { locales: LocalOption[]; defaultLocalId: number }) {
  const [localId, setLocalId] = useState(String(defaultLocalId))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const fd = new FormData(formEl)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/tango/import-pdf', { method: 'POST', body: fd })
      const data = (await res.json()) as Result
      setResult(data)
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Error de red' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <Receipt size={18} className="text-slate-500" />
        <h2 className="font-medium text-slate-900">Cierre de Tango (PDF)</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Subí el PDF de “cierre de turno” de Tango. Se lee fecha, turno y ventas por forma de cobro, y
        queda disponible para precargar el cierre desde la planilla. Útil para probar la ingesta sin
        esperar el correo.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Local</span>
          <select
            name="localId"
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-72"
          >
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Archivo PDF</span>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
            <FileText size={18} className="shrink-0 text-slate-400" />
            <input
              name="archivo"
              type="file"
              accept="application/pdf"
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
          {loading ? 'Procesando…' : 'Importar PDF de Tango'}
        </button>
      </form>

      {result && result.ok && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-medium text-emerald-800">
            <CheckCircle2 size={18} />
            Importado correctamente
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Fecha</dt>
              <dd className="font-medium tabular-nums">{result.fecha}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Turno</dt>
              <dd className="font-medium">{TURNO_LABEL[result.turno] ?? result.turno}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Total (Z)</dt>
              <dd className="font-medium tabular-nums">{fmtMoney(result.montoZ)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tickets</dt>
              <dd className="font-medium tabular-nums">{result.cantidadTickets ?? '—'}</dd>
            </div>
          </dl>

          {result.ventas.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                Ventas por canal
              </p>
              <ul className="divide-y divide-emerald-100 rounded-md border border-emerald-100 bg-white">
                {result.ventas.map((v) => (
                  <li key={v.canal} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="text-slate-700">{CANAL_LABEL[v.canal] ?? v.canal}</span>
                    <span className="font-medium tabular-nums text-slate-900">{fmtMoney(v.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-sm text-emerald-700">
            Guardado. Andá al cierre del <span className="font-medium tabular-nums">{result.fecha}</span> y
            tocá «Importar desde Tango» para precargarlo.
          </p>
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertCircle size={18} />
            {result.error}
          </div>
          {result.muestra && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-xs text-slate-600">
              {result.muestra}
            </pre>
          )}
          {result.detalle && <p className="mt-1 text-xs text-rose-600">{result.detalle}</p>}
        </div>
      )}
    </section>
  )
}
