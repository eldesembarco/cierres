'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { calcularTotales } from '@/lib/cierre/calculations'
import type {
  Canal,
  Cupon,
  FormaPago,
  Gasto,
  TipoGasto,
  TipoTarjeta,
  Turno,
  TurnoInput,
  TurnoTotales,
} from '@/lib/cierre/types'
import { formatMoney } from '@/lib/money'
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
  Loader2,
  Paperclip,
  Plus,
  X,
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

const TIPOS_GASTO: TipoGasto[] = [
  'mercaderia', 'descartable', 'limpieza', 'bazar', 'uniformes',
  'servicios', 'sueldos', 'mantenimiento', 'marca', 'libreria', 'varios',
]
const TIPO_GASTO_LABEL: Record<TipoGasto, string> = {
  mercaderia: 'Mercadería',
  descartable: 'Descartables',
  limpieza: 'Limpieza',
  bazar: 'Bazar',
  uniformes: 'Uniformes',
  servicios: 'Servicios',
  sueldos: 'Sueldos',
  mantenimiento: 'Mantenimiento',
  marca: 'Marca',
  libreria: 'Librería',
  varios: 'Varios',
}

const FORMAS_PAGO: FormaPago[] = ['efectivo', 'tarjeta', 'transferencia', 'otro']
const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
}

type TarjetaCell = { monto: number; lote: string }
const emptyTarjetas = (): Record<TipoTarjeta, TarjetaCell> =>
  Object.fromEntries(TIPOS.map((t) => [t, { monto: 0, lote: '' }])) as Record<TipoTarjeta, TarjetaCell>

// Fila de gasto en el estado local (incluye estado de subida del comprobante).
type GastoRow = {
  tipo: TipoGasto
  formaPago: FormaPago
  monto: number
  descripcion: string
  comprobanteId: number | null
  subiendo: boolean
}

const nuevaGastoRow = (): GastoRow => ({
  tipo: 'mercaderia',
  formaPago: 'efectivo',
  monto: 0,
  descripcion: '',
  comprobanteId: null,
  subiendo: false,
})

function gastosFromInicial(gastos?: Gasto[]): GastoRow[] {
  if (!gastos || gastos.length === 0) return []
  return gastos.map((g) => ({
    tipo: g.tipo,
    formaPago: g.formaPago,
    monto: g.monto,
    descripcion: g.descripcion ?? '',
    comprobanteId: g.comprobanteId ?? null,
    subiendo: false,
  }))
}

function ventasFromInicial(ventas?: { canal: Canal; monto: number }[]): Record<Canal, number> {
  const base = Object.fromEntries(CANALES.map((c) => [c, 0])) as Record<Canal, number>
  for (const v of ventas ?? []) base[v.canal] = v.monto
  return base
}

function detallesFromInicial(
  detalles?: { canal: Canal; referencia: string; importe: number }[],
): Record<Canal, Cupon[]> {
  const base = Object.fromEntries(CANALES.map((c) => [c, [] as Cupon[]])) as Record<Canal, Cupon[]>
  for (const d of detalles ?? []) {
    base[d.canal] = [...base[d.canal], { referencia: d.referencia, importe: d.importe }]
  }
  return base
}

function tarjetasFromInicial(
  tarjetas?: { tipo: TipoTarjeta; monto: number; lote?: string | null }[],
): Record<TipoTarjeta, TarjetaCell> {
  const base = emptyTarjetas()
  for (const t of tarjetas ?? []) base[t.tipo] = { monto: t.monto, lote: t.lote ?? '' }
  return base
}

export function TurnoCierre({
  fecha,
  turno,
  titulo,
  fondoFijoDefault,
  inicial,
  onTotales,
  precarga,
}: {
  fecha: string
  turno: Turno
  titulo: string
  fondoFijoDefault: number
  inicial?: Partial<TurnoInput> & { nota?: string }
  onTotales?: (turno: Turno, t: TurnoTotales) => void
  precarga?: Partial<TurnoInput>
}) {
  const [fondoFijo, setFondoFijo] = useState(inicial?.fondoFijo ?? fondoFijoDefault)
  const [montoZ, setMontoZ] = useState(inicial?.montoZ ?? 0)
  const [efectivoDepositado, setEfectivoDepositado] = useState(inicial?.efectivoDepositado ?? 0)
  const [notaCredito, setNC] = useState(inicial?.notaCredito ?? 0)
  const [cantidadTickets, setTickets] = useState<number | ''>(inicial?.cantidadTickets ?? '')

  const [ventas, setVentas] = useState<Record<Canal, number>>(() => ventasFromInicial(inicial?.ventas))
  const [detalles, setDetalles] = useState<Record<Canal, Cupon[]>>(() =>
    detallesFromInicial(inicial?.detalles),
  )
  const [tarjetas, setTarjetas] = useState<Record<TipoTarjeta, TarjetaCell>>(() =>
    tarjetasFromInicial(inicial?.tarjetas),
  )
  const [gastos, setGastos] = useState<GastoRow[]>(() => gastosFromInicial(inicial?.gastos))

  const [nota, setNota] = useState(inicial?.nota ?? '')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  // Aplicar precarga (Tango) cuando cambia: mergeamos ventas, montoZ y tickets.
  // Usamos un ref para no re-aplicar la misma referencia dos veces.
  const precargaRef = useRef<Partial<TurnoInput> | undefined>(undefined)
  useEffect(() => {
    if (!precarga || precarga === precargaRef.current) return
    precargaRef.current = precarga
    if (precarga.ventas) {
      setVentas((p) => {
        const next = { ...p }
        for (const v of precarga.ventas!) next[v.canal] = v.monto
        return next
      })
    }
    if (precarga.montoZ != null) setMontoZ(precarga.montoZ)
    if (precarga.cantidadTickets != null) setTickets(precarga.cantidadTickets)
  }, [precarga])

  const input: TurnoInput = useMemo(() => {
    const tarjetasArr: TurnoInput['tarjetas'] = []
    for (const tipo of TIPOS) {
      const cell = tarjetas[tipo]
      const lote = cell.lote.trim()
      if (cell.monto > 0 || lote) {
        tarjetasArr.push({ tipo, monto: cell.monto, lote: lote || null })
      }
    }
    return {
      fondoFijo,
      montoZ,
      efectivoDepositado,
      notaCredito,
      cantidadTickets: cantidadTickets === '' ? null : Number(cantidadTickets),
      ventas: CANALES.map((c) => ({ canal: c, monto: ventas[c] })),
      tarjetas: tarjetasArr,
      detalles: CANALES.flatMap((c) =>
        detalles[c]
          .filter((d) => d.importe > 0 || d.referencia.trim() !== '')
          .map((d) => ({ canal: c, referencia: d.referencia, importe: d.importe })),
      ),
      gastos: gastos
        .filter((g) => g.monto > 0 || g.descripcion.trim() !== '' || g.comprobanteId != null)
        .map((g) => ({
          tipo: g.tipo,
          formaPago: g.formaPago,
          monto: g.monto,
          descripcion: g.descripcion.trim() || null,
          comprobanteId: g.comprobanteId,
        })),
    }
  }, [fondoFijo, montoZ, efectivoDepositado, notaCredito, cantidadTickets, ventas, detalles, tarjetas, gastos])

  const t = calcularTotales(input)

  // Reportar los totales al padre (planilla) para el total del día.
  useEffect(() => {
    onTotales?.(turno, t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.ventaTotal, t.ventaEfectivo, t.gastosTotal, t.gastosEfectivo, t.saldoEfectivo, t.diferenciaCaja, t.totalCredito, t.totalDebito])

  const diffAbs = Math.abs(t.diferenciaCaja)
  const requiereNota = diffAbs > 1000

  const diffStyle =
    diffAbs === 0
      ? { tile: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', emoji: '🟢' }
      : diffAbs <= 1000
        ? { tile: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500', emoji: '🟡' }
        : { tile: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500', emoji: '🔴' }

  async function subirComprobante(i: number, file: File) {
    setGastos((p) => p.map((g, j) => (j === i ? { ...g, subiendo: true } : g)))
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/comprobante', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('bad status')
      const { id } = (await res.json()) as { id: number }
      setGastos((p) => p.map((g, j) => (j === i ? { ...g, comprobanteId: id, subiendo: false } : g)))
    } catch {
      setGastos((p) => p.map((g, j) => (j === i ? { ...g, subiendo: false } : g)))
    }
  }

  async function submit(cerrar: boolean) {
    setPending(true)
    const res = await guardarCierre(fecha, turno, JSON.stringify({ ...input, nota }), cerrar)
    setOk(res.ok)
    setMsg(res.ok ? (cerrar ? 'Cerrado correctamente.' : 'Borrador guardado.') : res.error)
    setPending(false)
  }

  const MoneyRow = ({
    label,
    value,
    onChange,
  }: {
    label: string
    value: number
    onChange: (n: number) => void
  }) => (
    <label className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <MoneyInput value={value} onChange={onChange} className="w-full shrink-0 sm:w-40" />
    </label>
  )

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/60 p-3 shadow-sm sm:p-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
        <span className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${diffStyle.tile}`}>
          <span>{diffStyle.emoji}</span>
          Dif {formatMoney(t.diferenciaCaja)}
        </span>
      </header>

      {/* Resumen — tiles en vivo */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[12px] text-slate-500">Venta total</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatMoney(t.ventaTotal)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[12px] text-slate-500">Total depositado</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatMoney(efectivoDepositado)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-[12px] text-slate-500">Gastos</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{formatMoney(t.gastosTotal)}</p>
        </div>
        <div className={`col-span-2 rounded-lg p-3 sm:col-span-3 ${diffStyle.tile}`}>
          <p className="text-[12px] opacity-80">Diferencia de caja</p>
          <p className="mt-0.5 flex items-center gap-2 text-xl font-semibold tabular-nums">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${diffStyle.dot}`} />
            {formatMoney(t.diferenciaCaja)}
          </p>
        </div>
      </div>

      {/* Stats secundarias */}
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
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
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Wallet size={18} className="text-slate-500" />
          <h3 className="font-medium text-slate-900">Caja</h3>
        </div>
        <div className="divide-y divide-slate-100">
          <MoneyRow label="Fondo fijo" value={fondoFijo} onChange={setFondoFijo} />
          <MoneyRow label="Cierre Z" value={montoZ} onChange={setMontoZ} />
          <MoneyRow label="Efectivo depositado" value={efectivoDepositado} onChange={setEfectivoDepositado} />
          <MoneyRow label="Nota de crédito" value={notaCredito} onChange={setNC} />
          <label className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="text-sm text-slate-600">Cantidad de tickets</span>
            <input
              type="number"
              inputMode="numeric"
              value={cantidadTickets}
              onChange={(e) => setTickets(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-right tabular-nums text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-40"
            />
          </label>
        </div>
      </div>

      {/* Ventas por canal */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Coins size={18} className="text-slate-500" />
          <h3 className="font-medium text-slate-900">Ventas por canal</h3>
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
      </div>

      {/* Tarjetas (desglose) */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard size={18} className="text-slate-500" />
          <h3 className="font-medium text-slate-900">Tarjetas (desglose)</h3>
        </div>
        <div className="flex flex-col gap-2">
          {TIPOS.map((tipo) => (
            <div key={tipo} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-sm text-slate-600 sm:w-28">{TIPO_LABEL[tipo]}</span>
              <MoneyInput
                value={tarjetas[tipo].monto}
                onChange={(n) =>
                  setTarjetas((p) => ({ ...p, [tipo]: { ...p[tipo], monto: n } }))
                }
                className="flex-1"
              />
              <input
                type="text"
                value={tarjetas[tipo].lote}
                onChange={(e) =>
                  setTarjetas((p) => ({ ...p, [tipo]: { ...p[tipo], lote: e.target.value } }))
                }
                placeholder="Lote"
                className="w-16 shrink-0 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-20"
              />
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
      </div>

      {/* Gastos */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-slate-500" />
            <h3 className="font-medium text-slate-900">Gastos</h3>
          </div>
          <button
            type="button"
            onClick={() => setGastos((p) => [...p, nuevaGastoRow()])}
            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={15} /> Agregar gasto
          </button>
        </div>

        {gastos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin gastos cargados.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {gastos.map((g, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <select
                    value={g.tipo}
                    onChange={(e) =>
                      setGastos((p) => p.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoGasto } : x)))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-40"
                  >
                    {TIPOS_GASTO.map((tg) => (
                      <option key={tg} value={tg}>{TIPO_GASTO_LABEL[tg]}</option>
                    ))}
                  </select>
                  <select
                    value={g.formaPago}
                    onChange={(e) =>
                      setGastos((p) => p.map((x, j) => (j === i ? { ...x, formaPago: e.target.value as FormaPago } : x)))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-40"
                  >
                    {FORMAS_PAGO.map((fp) => (
                      <option key={fp} value={fp}>{FORMA_PAGO_LABEL[fp]}</option>
                    ))}
                  </select>
                  <MoneyInput
                    value={g.monto}
                    onChange={(n) => setGastos((p) => p.map((x, j) => (j === i ? { ...x, monto: n } : x)))}
                    className="w-full sm:w-32"
                  />
                  <button
                    type="button"
                    onClick={() => setGastos((p) => p.filter((_, j) => j !== i))}
                    aria-label="Quitar gasto"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-400 hover:text-red-600 sm:ml-auto"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={g.descripcion}
                    onChange={(e) =>
                      setGastos((p) => p.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))
                    }
                    placeholder="Descripción"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                    {g.subiendo ? (
                      <Loader2 size={15} className="animate-spin text-blue-600" />
                    ) : (
                      <Paperclip size={15} />
                    )}
                    {g.comprobanteId != null ? 'Cambiar' : 'Comprobante'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) subirComprobante(i, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {g.comprobanteId != null && (
                    <a
                      href={`/api/comprobante/${g.comprobanteId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-700"
                    >
                      <CheckCircle2 size={15} /> ver
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">Subtotal gastos</span>
          <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.gastosTotal)}</span>
        </div>
      </div>

      {/* Justificación de diferencia */}
      {requiereNota && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <AlertCircle size={18} />
            <h3 className="font-medium">Justificá la diferencia</h3>
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
        </div>
      )}

      {/* Mensaje + acciones del turno */}
      <div className="flex flex-col gap-2">
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
            className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => submit(true)}
            disabled={pending}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </section>
  )
}
