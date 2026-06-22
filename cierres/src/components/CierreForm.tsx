'use client'

import { Fragment, useMemo, useState } from 'react'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { Canal, CierreInput } from '@/lib/cierre/types'
import { guardarCierre } from '@/app/cierres/actions'
import {
  Wallet,
  Receipt,
  Coins,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

const CANALES: Canal[] = ['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercadopago', 'uber', 'delivery_propio', 'varios']

// OJO: la etiqueta visible de "efectivo" debe ser exactamente "efectivo"
// porque el test E2E la selecciona con /^efectivo$/.
const CANAL_LABEL: Record<Canal, string> = {
  efectivo: 'efectivo',
  tarjetas: 'Tarjetas',
  rappi: 'Rappi',
  pedidosya: 'PedidosYa',
  mercadopago: 'Mercado Pago',
  uber: 'Uber',
  delivery_propio: 'Delivery propio',
  varios: 'Varios',
}

const money = (n: number) => `$${n.toLocaleString('es-AR')}`

export function CierreForm({ fecha, fondoFijoDefault, initial }: { fecha: string; fondoFijoDefault: number; initial?: Partial<CierreInput> }) {
  const [fondoFijo, setFondoFijo] = useState(initial?.fondoFijo ?? fondoFijoDefault)
  const [gastosTotal, setGastos] = useState(initial?.gastosTotal ?? 0)
  const [notaCredito, setNC] = useState(initial?.notaCredito ?? 0)
  const [cantidadTickets, setTickets] = useState<number | ''>(initial?.cantidadTickets ?? '')
  const [z1, setZ1] = useState(0)
  const [z2, setZ2] = useState(0)
  const [ventas, setVentas] = useState<Record<Canal, number>>(
    Object.fromEntries(CANALES.map((c) => [c, 0])) as Record<Canal, number>,
  )
  const [nota, setNota] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  const input: CierreInput = useMemo(() => ({
    fondoFijo, gastosTotal, notaCredito,
    cantidadTickets: cantidadTickets === '' ? null : Number(cantidadTickets),
    turnos: [{ turno: 'T1', montoZ: z1 }, { turno: 'T2', montoZ: z2 }],
    ventas: CANALES.map((c) => ({ canal: c, monto: ventas[c] })),
  }), [fondoFijo, gastosTotal, notaCredito, cantidadTickets, z1, z2, ventas])

  const t = calcularTotales(input)
  const diffAbs = Math.abs(t.diferenciaCaja)
  const requiereNota = diffAbs > 1000

  // semáforo de la diferencia de caja
  const diffStyle =
    diffAbs === 0
      ? { tile: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' }
      : diffAbs <= 1000
        ? { tile: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' }
        : { tile: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' }

  async function submit(cerrar: boolean) {
    setPending(true)
    const res = await guardarCierre(fecha, JSON.stringify({ ...input, nota }), cerrar)
    setOk(res.ok)
    setMsg(res.ok ? (cerrar ? 'Cerrado correctamente.' : 'Borrador guardado.') : res.error)
    setPending(false)
  }

  const inputCls =
    'w-36 rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500'

  const num = (v: number, set: (n: number) => void, label: string) => (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <input type="number" inputMode="decimal" value={v} onChange={(e) => set(Number(e.target.value))} className={inputCls} />
    </label>
  )

  return (
    <div className="flex flex-col gap-4 pb-28">
      {/* Resumen — tiles que se actualizan en vivo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] text-slate-500">Venta total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{money(t.ventaTotal)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] text-slate-500">Saldo efectivo</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{money(t.saldoEfectivo)}</p>
        </div>
        <div className={`col-span-2 rounded-lg p-4 sm:col-span-1 ${diffStyle.tile}`}>
          <p className="text-[13px] opacity-80">Diferencia de caja</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${diffStyle.dot}`} />
            {money(t.diferenciaCaja)}
          </p>
        </div>
      </div>

      {/* Caja */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <Wallet size={18} className="text-slate-500" />
          <h2 className="font-medium text-slate-900">Caja</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {num(fondoFijo, setFondoFijo, 'Fondo fijo')}
          {num(z1, setZ1, 'Cierre Z · Turno 1')}
          {num(z2, setZ2, 'Cierre Z · Turno 2')}
          {num(gastosTotal, setGastos, 'Gastos')}
          {num(notaCredito, setNC, 'Nota de crédito')}
          <label className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-slate-600">Cantidad de tickets</span>
            <input
              type="number"
              value={cantidadTickets}
              onChange={(e) => setTickets(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputCls}
            />
          </label>
        </div>
        {t.ticketPromedio != null && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingUp size={14} /> Ticket promedio {money(t.ticketPromedio)}
          </p>
        )}
      </section>

      {/* Ventas por canal */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <Coins size={18} className="text-slate-500" />
          <h2 className="font-medium text-slate-900">Ventas por canal</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {CANALES.map((c) => (
            <Fragment key={c}>{num(ventas[c], (n) => setVentas((p) => ({ ...p, [c]: n })), CANAL_LABEL[c])}</Fragment>
          ))}
        </div>
      </section>

      {/* Justificación de diferencia */}
      {requiereNota && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <AlertCircle size={18} />
            <h2 className="font-medium">Justificá la diferencia</h2>
          </div>
          <p className="mb-2 text-sm text-amber-700/90">
            La diferencia de caja supera $1.000. Agregá una nota para poder cerrar.
          </p>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej.: faltante por vuelto, error de tipeo en el Z, etc."
            rows={3}
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400"
          />
        </section>
      )}

      {/* Barra de acciones fija */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-3">
          {msg && (
            <p className={`flex items-center gap-1.5 text-sm font-medium ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {msg}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => submit(false)}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Guardar borrador
            </button>
            <button
              onClick={() => submit(true)}
              disabled={pending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Cerrar caja
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
