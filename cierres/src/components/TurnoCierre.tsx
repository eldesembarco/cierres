'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { calcularTotales } from '@/lib/cierre/calculations'
import type {
  Canal,
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
import {
  Wallet,
  Receipt,
  Coins,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Paperclip,
  Plus,
  X,
  ChevronDown,
} from 'lucide-react'

const CANALES: Canal[] = [
  'efectivo', 'tarjetas', 'rappi', 'mercado_pedidos', 'pedidosya',
  'mercadopago', 'uber', 'delivery_propio', 'varios',
]

const TIPOS: TipoTarjeta[] = ['mastercard', 'maestro', 'visa_credito', 'visa_debito', 'amex']

// Medios de ingreso individuales: tarjetas (cada una es su propia transacción) +
// apps/otros canales. Cada línea de ingreso usa uno de estos medios.
const MEDIOS_TARJETA: TipoTarjeta[] = ['visa_credito', 'visa_debito', 'mastercard', 'maestro', 'amex']
// Canales tipo app/otro disponibles como medio de ingreso (todo lo que no es efectivo ni tarjetas).
type MedioApp = 'pedidosya' | 'rappi' | 'mercadopago' | 'mercado_pedidos' | 'uber' | 'delivery_propio' | 'varios'
const MEDIOS_APP: MedioApp[] = [
  'pedidosya', 'rappi', 'mercadopago', 'mercado_pedidos', 'uber', 'delivery_propio', 'varios',
]
type Medio = TipoTarjeta | MedioApp

const MEDIO_LABEL: Record<Medio, string> = {
  visa_credito: 'Visa crédito',
  visa_debito: 'Visa débito',
  mastercard: 'Mastercard',
  maestro: 'Maestro',
  amex: 'Amex',
  pedidosya: 'PedidosYa',
  rappi: 'Rappi',
  mercadopago: 'Mercado Pago',
  mercado_pedidos: 'Mercado Pedidos',
  uber: 'Uber',
  delivery_propio: 'Delivery propio',
  varios: 'Varios',
}

const CARD_SET = new Set<Medio>(MEDIOS_TARJETA)
const isCardMedio = (m: Medio): m is TipoTarjeta => CARD_SET.has(m)
// El canal al que aporta cada medio: tarjetas → 'tarjetas'; apps → su propio canal.
const canalDeMedio = (m: Medio): Canal => (isCardMedio(m) ? 'tarjetas' : m)

// Línea de ingreso individual (una por transacción de tarjeta/app).
type IngresoRow = { medio: Medio; monto: number; referencia: string }
const nuevaIngresoRow = (medio: Medio): IngresoRow => ({ medio, monto: 0, referencia: '' })

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

// Fila de gasto en el estado local (incluye estado de subida del comprobante).
type GastoRow = {
  tipo: TipoGasto
  formaPago: FormaPago
  monto: number
  descripcion: string
  comprobanteId: number | null
  subiendo: boolean
}

const nuevaGastoRow = (tipo: TipoGasto): GastoRow => ({
  tipo,
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

function efectivoFromInicial(ventas?: { canal: Canal; monto: number }[]): number {
  return (ventas ?? []).find((v) => v.canal === 'efectivo')?.monto ?? 0
}

/**
 * Reconstruye las líneas de ingreso individuales desde un cierre guardado.
 * - Tarjetas: una línea por entrada de `tarjetas` (agregada por tipo; el lote unido vuelve como referencia).
 * - Apps: una línea por `detalle` del canal; si el canal tiene venta declarada sin detalles,
 *   se crea una línea por el total para no perder el monto.
 */
function ingresosFromInicial(inicial?: Partial<TurnoInput>): IngresoRow[] {
  const rows: IngresoRow[] = []
  // Tarjetas (cada tipo cargado → una línea).
  for (const t of inicial?.tarjetas ?? []) {
    if (t.monto > 0 || (t.lote ?? '').trim() !== '') {
      rows.push({ medio: t.tipo, monto: t.monto, referencia: t.lote ?? '' })
    }
  }
  // Apps: agrupamos detalles por canal de app.
  const detallesPorApp = new Map<Canal, { referencia: string; importe: number }[]>()
  for (const d of inicial?.detalles ?? []) {
    if (d.canal === 'tarjetas' || d.canal === 'efectivo') continue
    if (!detallesPorApp.has(d.canal)) detallesPorApp.set(d.canal, [])
    detallesPorApp.get(d.canal)!.push({ referencia: d.referencia, importe: d.importe })
  }
  for (const m of MEDIOS_APP) {
    const dets = detallesPorApp.get(m)
    if (dets && dets.length > 0) {
      for (const d of dets) rows.push({ medio: m, monto: d.importe, referencia: d.referencia })
    } else {
      // Sin detalles: usar la venta declarada del canal como una línea única.
      const venta = (inicial?.ventas ?? []).find((v) => v.canal === m)?.monto ?? 0
      if (venta > 0) rows.push({ medio: m, monto: venta, referencia: '' })
    }
  }
  return rows
}

// Grupo de opciones para el menú desplegable (con etiqueta opcional de sección).
type MenuGrupo<T extends string> = { label?: string; items: readonly T[] }

/**
 * Botón con menú desplegable de opciones (popover). Mobile-first: usa un wrapper
 * relativo + menú absoluto (NO position:fixed). Cierra al elegir, al click afuera y con Escape.
 */
function MenuAgregar<T extends string>({
  label,
  grupos,
  etiquetas,
  onSelect,
  variant,
}: {
  label: string
  grupos: readonly MenuGrupo<T>[]
  etiquetas: Record<T, string>
  onSelect: (value: T) => void
  variant: 'primary' | 'secondary'
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const btnClass =
    variant === 'primary'
      ? 'flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700'
      : 'flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50'

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={btnClass}
      >
        <Plus size={17} /> {label}
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {grupos.map((g, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1 border-t border-slate-100 pt-1' : undefined}>
              {g.label && (
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {g.label}
                </p>
              )}
              {g.items.map((it) => (
                <button
                  key={it}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(it)
                    setOpen(false)
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  {etiquetas[it]}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Grupos para el menú de ingresos: Tarjetas + Apps / otros.
const MEDIO_GRUPOS: readonly MenuGrupo<Medio>[] = [
  { label: 'Tarjetas', items: MEDIOS_TARJETA },
  { label: 'Apps / otros', items: MEDIOS_APP },
]
// Un solo grupo plano para los tipos de gasto.
const GASTO_GRUPOS: readonly MenuGrupo<TipoGasto>[] = [{ items: TIPOS_GASTO }]

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

  const [efectivoVenta, setEfectivoVenta] = useState<number>(() => efectivoFromInicial(inicial?.ventas))
  const [ingresos, setIngresos] = useState<IngresoRow[]>(() => ingresosFromInicial(inicial))
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
      // Efectivo → campo único. Resto de canales (apps): una línea por canal con monto.
      // Tango no informa tipos de tarjeta, así que las tarjetas quedan vacías.
      const ef = precarga.ventas.find((v) => v.canal === 'efectivo')?.monto
      if (ef != null) setEfectivoVenta(ef)
      const nuevasLineas: IngresoRow[] = precarga.ventas
        .filter((v) => MEDIOS_APP.includes(v.canal as MedioApp) && v.monto > 0)
        .map((v) => ({ medio: v.canal as Medio, monto: v.monto, referencia: '' }))
      if (nuevasLineas.length > 0) {
        // Reemplazamos las líneas de apps de la precarga previa, preservando tarjetas cargadas a mano.
        setIngresos((prev) => [...prev.filter((r) => isCardMedio(r.medio)), ...nuevasLineas])
      }
    }
    if (precarga.montoZ != null) setMontoZ(precarga.montoZ)
    if (precarga.cantidadTickets != null) setTickets(precarga.cantidadTickets)
  }, [precarga])

  const input: TurnoInput = useMemo(() => {
    // 1) ventas por canal: efectivo (campo único) + suma de líneas por canal de cada medio.
    const ventasPorCanal = Object.fromEntries(CANALES.map((c) => [c, 0])) as Record<Canal, number>
    ventasPorCanal.efectivo = efectivoVenta
    // 2) tarjetas agregadas por tipo (para no chocar con el unique (cierreId, tipo)):
    //    sumamos monto por tipo y unimos los lotes (referencias) separados por coma.
    const tarjetaPorTipo = new Map<TipoTarjeta, { monto: number; lotes: string[] }>()
    // 3) detalles: una entrada por línea de ingreso (traza por transacción + conciliación).
    const detallesArr: TurnoInput['detalles'] = []

    for (const row of ingresos) {
      const canal = canalDeMedio(row.medio)
      ventasPorCanal[canal] += row.monto
      const ref = row.referencia.trim()
      // detalle por transacción (cualquier medio que no sea efectivo entra acá)
      if (row.monto > 0 || ref !== '') {
        detallesArr.push({ canal, referencia: row.referencia, importe: row.monto })
      }
      if (isCardMedio(row.medio)) {
        const acc = tarjetaPorTipo.get(row.medio) ?? { monto: 0, lotes: [] }
        acc.monto += row.monto
        if (ref !== '') acc.lotes.push(ref)
        tarjetaPorTipo.set(row.medio, acc)
      }
    }

    const tarjetasArr: TurnoInput['tarjetas'] = []
    for (const tipo of TIPOS) {
      const cell = tarjetaPorTipo.get(tipo)
      if (!cell) continue
      if (cell.monto > 0 || cell.lotes.length > 0) {
        tarjetasArr.push({ tipo, monto: cell.monto, lote: cell.lotes.join(', ') || null })
      }
    }

    return {
      fondoFijo,
      montoZ,
      efectivoDepositado,
      notaCredito,
      cantidadTickets: cantidadTickets === '' ? null : Number(cantidadTickets),
      ventas: CANALES.map((c) => ({ canal: c, monto: ventasPorCanal[c] })),
      tarjetas: tarjetasArr,
      detalles: detallesArr,
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
  }, [fondoFijo, montoZ, efectivoDepositado, notaCredito, cantidadTickets, efectivoVenta, ingresos, gastos])

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

  // Líneas de ingreso individuales: agregamos arriba para que la última quede visible.
  // El medio se fija al elegir la opción del menú desplegable (chip en la línea).
  const agregarIngreso = (medio: Medio) => setIngresos((p) => [nuevaIngresoRow(medio), ...p])
  // Gastos: agregamos al final con el tipo ya fijado desde el menú.
  const agregarGasto = (tipo: TipoGasto) => setGastos((p) => [...p, nuevaGastoRow(tipo)])
  const setIngresoRow = (i: number, patch: Partial<IngresoRow>) =>
    setIngresos((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const quitarIngreso = (i: number) => setIngresos((p) => p.filter((_, j) => j !== i))

  // Subtotal de ingresos (efectivo + todas las líneas). Útil para verificar contra el Z.
  const ingresoSubtotal = efectivoVenta + ingresos.reduce((acc, r) => acc + r.monto, 0)

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

      {/* Barra de carga rápida — siempre arriba del bloque.
          Cada botón abre un menú desplegable con las opciones; al elegir, se agrega
          la línea con el medio/tipo ya fijado. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <MenuAgregar
            label="Agregar ingreso"
            variant="primary"
            grupos={MEDIO_GRUPOS}
            etiquetas={MEDIO_LABEL}
            onSelect={agregarIngreso}
          />
        </div>
        <div className="flex-1">
          <MenuAgregar
            label="Agregar gasto"
            variant="secondary"
            grupos={GASTO_GRUPOS}
            etiquetas={TIPO_GASTO_LABEL}
            onSelect={agregarGasto}
          />
        </div>
      </div>

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

      {/* Ingresos — efectivo (campo único) + una línea por cada cobro con tarjeta/app */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-slate-500" />
            <h3 className="font-medium text-slate-900">Ingresos</h3>
          </div>
          <div className="w-44 shrink-0">
            <MenuAgregar
              label="Agregar ingreso"
              variant="primary"
              grupos={MEDIO_GRUPOS}
              etiquetas={MEDIO_LABEL}
              onSelect={agregarIngreso}
            />
          </div>
        </div>

        {/* Efectivo: no se itemiza, es un único monto */}
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Efectivo</span>
            <MoneyInput value={efectivoVenta} onChange={setEfectivoVenta} className="w-full shrink-0 sm:w-44" />
          </label>
        </div>

        {/* Líneas individuales (tarjetas/apps), una por transacción */}
        {ingresos.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin ingresos con tarjeta o app. Usá <span className="font-medium">Agregar ingreso</span> para cargar cada cobro.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {ingresos.map((row, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center"
              >
                {/* Medio fijo (se eligió al agregar la línea desde el menú) */}
                <span
                  className={`inline-flex w-full shrink-0 items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium sm:w-40 ${
                    isCardMedio(row.medio)
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {MEDIO_LABEL[row.medio]}
                </span>
                <MoneyInput
                  value={row.monto}
                  onChange={(n) => setIngresoRow(i, { monto: n })}
                  className="w-full sm:w-32"
                />
                <input
                  type="text"
                  value={row.referencia}
                  onChange={(e) => setIngresoRow(i, { referencia: e.target.value })}
                  placeholder="Cupón / lote / ref."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => quitarIngreso(i)}
                  aria-label="Quitar ingreso"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-400 hover:text-red-600 sm:ml-auto"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mini-resumen: subtotal de ingresos + crédito/débito derivados */}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Receipt size={14} /> Crédito{' '}
            <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.totalCredito)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            Débito{' '}
            <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.totalDebito)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            Subtotal ingresos{' '}
            <span className="font-semibold tabular-nums text-slate-900">{formatMoney(ingresoSubtotal)}</span>
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
          <div className="w-44 shrink-0">
            <MenuAgregar
              label="Agregar gasto"
              variant="secondary"
              grupos={GASTO_GRUPOS}
              etiquetas={TIPO_GASTO_LABEL}
              onSelect={agregarGasto}
            />
          </div>
        </div>

        {gastos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin gastos cargados.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {gastos.map((g, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {/* Tipo de gasto fijo (se eligió al agregar la línea desde el menú) */}
                  <span className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 sm:w-40">
                    {TIPO_GASTO_LABEL[g.tipo]}
                  </span>
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
