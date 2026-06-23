'use client'

import { useMemo, useState } from 'react'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { Canal, CierreInput, Cupon, TipoTarjeta, Turno } from '@/lib/cierre/types'
import { formatMoney } from '@/lib/money'
import type { TangoParseResult } from '@/lib/ingest/parseTango'
import { guardarCierre } from '@/app/cierres/actions'
import { MoneyInput } from '@/components/MoneyInput'
import { CuponesDetalle } from '@/components/CuponesDetalle'
import {
  Wallet,
  Receipt,
  CreditCard,
  Coins,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'

const CANALES: Canal[] = [
  'efectivo', 'tarjetas', 'rappi', 'mercado_pedidos', 'pedidosya',
  'mercadopago', 'uber', 'delivery_propio', 'varios',
]

const CANAL_LABEL: Record<Canal, string> = {
  efectivo: 'Efectivo',
  tarjetas: 'Tarjetas',
  rappi: 'Rappi',
  mercado_pedidos: 'Mercado Pedidos',
  pedidosya: 'PedidosYa',
  mercadopago: 'Mercado Pago',
  uber: 'Uber',
  delivery_propio: 'Delivery propio',
  varios: 'Varios',
}

const TIPOS: TipoTarjeta[] = ['mastercard', 'maestro', 'visa_credito', 'visa_debito', 'amex']
const TIPO_LABEL: Record<TipoTarjeta, string> = {
  mastercard: 'Mastercard',
  maestro: 'Maestro',
  visa_credito: 'Visa crédito',
  visa_debito: 'Visa débito',
  amex: 'Amex',
}
const TURNOS: Turno[] = ['T1', 'T2']

type TarjetaCell = { monto: number; lote: string }
const emptyTarjetas = (): Record<Turno, Record<TipoTarjeta, TarjetaCell>> => ({
  T1: Object.fromEntries(TIPOS.map((t) => [t, { monto: 0, lote: '' }])) as Record<TipoTarjeta, TarjetaCell>,
  T2: Object.fromEntries(TIPOS.map((t) => [t, { monto: 0, lote: '' }])) as Record<TipoTarjeta, TarjetaCell>,
})

export function CierreForm({
  fecha,
  fondoFijoDefault,
  initial,
}: {
  fecha: string
  fondoFijoDefault: number
  initial?: Partial<CierreInput>
}) {
  const [fondoFijo, setFondoFijo] = useState(initial?.fondoFijo ?? fondoFijoDefault)
  const [gastosTotal, setGastos] = useState(initial?.gastosTotal ?? 0)
  const [notaCredito, setNC] = useState(initial?.notaCredito ?? 0)
  const [cantidadTickets, setTickets] = useState<number | ''>(initial?.cantidadTickets ?? '')

  const [z1, setZ1] = useState(0)
  const [z2, setZ2] = useState(0)
  const [dep1, setDep1] = useState(0)
  const [dep2, setDep2] = useState(0)

  const [ventas, setVentas] = useState<Record<Canal, number>>(
    Object.fromEntries(CANALES.map((c) => [c, 0])) as Record<Canal, number>,
  )
  const [detalles, setDetalles] = useState<Record<Canal, Cupon[]>>(
    Object.fromEntries(CANALES.map((c) => [c, [] as Cupon[]])) as Record<Canal, Cupon[]>,
  )
  const [tarjetas, setTarjetas] = useState(emptyTarjetas)

  const [nota, setNota] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  const [importLoading, setImportLoading] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importError, setImportError] = useState('')

  async function importarTango() {
    setImportLoading(true)
    setImportMsg('')
    setImportError('')
    try {
      const params = new URLSearchParams({ fecha, localId: '' })
      const res = await fetch(`/api/tango?${params.toString()}`)
      if (!res.ok) throw new Error('bad status')
      const r: TangoParseResult = await res.json()
      for (const { canal, monto } of r.ventas) {
        setVentas((p) => ({ ...p, [canal]: monto }))
      }
      for (const { turno, montoZ } of r.turnos) {
        if (turno === 'T1') setZ1(montoZ)
        else if (turno === 'T2') setZ2(montoZ)
      }
      if (r.cantidadTickets != null) setTickets(r.cantidadTickets)
      setImportMsg('Información actualizada desde Tango ✓ — revisá y guardá.')
    } catch {
      setImportError('No se pudo actualizar la información. Probá de nuevo.')
    } finally {
      setImportLoading(false)
    }
  }

  const input: CierreInput = useMemo(() => {
    const tarjetasArr: CierreInput['tarjetas'] = []
    for (const turno of TURNOS) {
      for (const tipo of TIPOS) {
        const cell = tarjetas[turno][tipo]
        const lote = cell.lote.trim()
        if (cell.monto > 0 || lote) {
          tarjetasArr.push({ turno, tipo, monto: cell.monto, lote: lote || null })
        }
      }
    }
    return {
      fondoFijo,
      gastosTotal,
      notaCredito,
      cantidadTickets: cantidadTickets === '' ? null : Number(cantidadTickets),
      turnos: [
        { turno: 'T1', montoZ: z1, efectivoDepositado: dep1 },
        { turno: 'T2', montoZ: z2, efectivoDepositado: dep2 },
      ],
      ventas: CANALES.map((c) => ({ canal: c, monto: ventas[c] })),
      tarjetas: tarjetasArr,
      detalles: CANALES.flatMap((c) =>
        detalles[c]
          .filter((d) => d.importe > 0 || d.referencia.trim() !== '')
          .map((d) => ({ canal: c, referencia: d.referencia, importe: d.importe })),
      ),
    }
  }, [fondoFijo, gastosTotal, notaCredito, cantidadTickets, z1, z2, dep1, dep2, ventas, detalles, tarjetas])

  const t = calcularTotales(input)
  const diffAbs = Math.abs(t.diferenciaCaja)
  const requiereNota = diffAbs > 1000

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

  // Fila de moneda: label (texto) + MoneyInput. El texto del label queda limpio
  // para que los selectores del E2E lo matcheen por el <span>.
  const MoneyRow = ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: number
    onChange: (n: number) => void
  }) => (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <MoneyInput value={value} onChange={onChange} className="w-40 shrink-0" />
    </label>
  )

  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* Importar desde Tango (pull automático) */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={importarTango}
          disabled={importLoading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importLoading ? (
            <Loader2 size={16} className="animate-spin text-blue-600" />
          ) : (
            <RefreshCw size={16} className="text-slate-500" />
          )}
          {importLoading ? 'Actualizando información del local…' : 'Importar desde Tango'}
        </button>
        <span className="text-xs text-slate-400">datos de ejemplo (preliminar)</span>
        {!importLoading && importMsg && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 size={14} />
            {importMsg}
          </span>
        )}
        {!importLoading && importError && (
          <span className="flex items-center gap-1.5 text-sm text-slate-400">
            <AlertCircle size={14} />
            {importError}
          </span>
        )}
      </div>

      {/* Resumen — tiles en vivo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] text-slate-500">Venta total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(t.ventaTotal)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[13px] text-slate-500">Total depositado</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{formatMoney(t.totalDepositado)}</p>
        </div>
        <div className={`col-span-2 rounded-lg p-4 sm:col-span-1 ${diffStyle.tile}`}>
          <p className="text-[13px] opacity-80">Diferencia de caja</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${diffStyle.dot}`} />
            {formatMoney(t.diferenciaCaja)}
          </p>
        </div>
      </div>

      {/* Stats secundarias */}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Crédito</p>
          <p className="mt-0.5 font-medium tabular-nums text-slate-800">{formatMoney(t.totalCredito)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Débito</p>
          <p className="mt-0.5 font-medium tabular-nums text-slate-800">{formatMoney(t.totalDebito)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs text-slate-500">Saldo efectivo</p>
          <p className="mt-0.5 font-medium tabular-nums text-slate-800">{formatMoney(t.saldoEfectivo)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <TrendingUp size={12} /> Ticket prom.
          </p>
          <p className="mt-0.5 font-medium tabular-nums text-slate-800">
            {t.ticketPromedio != null ? formatMoney(t.ticketPromedio) : '—'}
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
          <MoneyRow label="Fondo fijo" value={fondoFijo} onChange={setFondoFijo} />
          <MoneyRow label="Cierre Z · Turno 1" value={z1} onChange={setZ1} />
          <MoneyRow label="Efectivo depositado · Turno 1" value={dep1} onChange={setDep1} />
          <MoneyRow label="Cierre Z · Turno 2" value={z2} onChange={setZ2} />
          <MoneyRow label="Efectivo depositado · Turno 2" value={dep2} onChange={setDep2} />
          <MoneyRow label="Gastos" value={gastosTotal} onChange={setGastos} />
          <MoneyRow label="Nota de crédito" value={notaCredito} onChange={setNC} />
          <label className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm text-slate-600">Cantidad de tickets</span>
            <input
              type="number"
              inputMode="numeric"
              value={cantidadTickets}
              onChange={(e) => setTickets(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-40 shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
      </section>

      {/* Ventas por canal */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-2 flex items-center gap-2">
          <Coins size={18} className="text-slate-500" />
          <h2 className="font-medium text-slate-900">Ventas por canal</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {CANALES.map((c) => (
            <div key={c} className="py-1">
              <MoneyRow
                label={CANAL_LABEL[c]}
                value={ventas[c]}
                onChange={(n) => setVentas((p) => ({ ...p, [c]: n }))}
              />
              <CuponesDetalle
                declarado={ventas[c]}
                value={detalles[c]}
                onChange={(next) => setDetalles((p) => ({ ...p, [c]: next }))}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Tarjetas (desglose) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard size={18} className="text-slate-500" />
          <h2 className="font-medium text-slate-900">Tarjetas (desglose)</h2>
        </div>
        <div className="flex flex-col gap-5">
          {TURNOS.map((turno) => (
            <div key={turno}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                {turno === 'T1' ? 'Turno 1' : 'Turno 2'}
              </p>
              <div className="flex flex-col gap-2">
                {TIPOS.map((tipo) => (
                  <div key={tipo} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-sm text-slate-600">{TIPO_LABEL[tipo]}</span>
                    <MoneyInput
                      value={tarjetas[turno][tipo].monto}
                      onChange={(n) =>
                        setTarjetas((p) => ({
                          ...p,
                          [turno]: { ...p[turno], [tipo]: { ...p[turno][tipo], monto: n } },
                        }))
                      }
                      className="flex-1"
                    />
                    <input
                      type="text"
                      value={tarjetas[turno][tipo].lote}
                      onChange={(e) =>
                        setTarjetas((p) => ({
                          ...p,
                          [turno]: { ...p[turno], [tipo]: { ...p[turno][tipo], lote: e.target.value } },
                        }))
                      }
                      placeholder="Lote"
                      className="w-20 shrink-0 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-4 border-t border-slate-100 pt-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Receipt size={14} /> Crédito{' '}
            <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.totalCredito)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            Débito{' '}
            <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.totalDebito)}</span>
          </span>
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
            <p
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}
            >
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
