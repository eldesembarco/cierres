'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { guardarCierre, reabrirCierre } from '@/app/cierres/actions'
import { crearProveedor } from '@/app/cuenta-corriente/actions'

export type Proveedor = { id: number; nombre: string }
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
  Pencil,
  Lock,
  Unlock,
  History,
  Sun,
  Moon,
} from 'lucide-react'

const CANALES: Canal[] = [
  'efectivo', 'tarjetas', 'rappi', 'mercado_pedidos', 'pedidosya', 'pedidosya_efectivo',
  'mercadopago', 'uber', 'delivery_propio', 'varios',
]

const TIPOS: TipoTarjeta[] = ['mastercard', 'maestro', 'visa_credito', 'visa_debito', 'amex']

// Medios de ingreso individuales: tarjetas (cada una es su propia transacción) +
// apps/otros canales. Cada línea de ingreso usa uno de estos medios.
const MEDIOS_TARJETA: TipoTarjeta[] = ['visa_credito', 'visa_debito', 'mastercard', 'maestro', 'amex']
// Canales tipo app/otro disponibles como medio de ingreso (todo lo que no es efectivo ni tarjetas).
type MedioApp = 'pedidosya' | 'pedidosya_efectivo' | 'rappi' | 'mercadopago' | 'mercado_pedidos' | 'uber' | 'delivery_propio' | 'varios'
// Conjunto lógico: todo medio que no es tarjeta ni el efectivo (campo único). Se usa
// para reconstruir/filtrar las líneas guardadas por canal.
const MEDIOS_APP: MedioApp[] = [
  'pedidosya', 'pedidosya_efectivo', 'rappi', 'mercadopago', 'mercado_pedidos', 'uber', 'delivery_propio', 'varios',
]
type Medio = TipoTarjeta | MedioApp

// Agrupación VISUAL del selector (no afecta la lógica):
//  - "Formas de pago": tarjetas + Mercado Pago / QR (cobro en mostrador).
//  - "Apps de delivery": PedidosYa (y PedidosYa en efectivo), Rappi, Mercado Delivery, etc.
const MEDIOS_FORMA_PAGO: Medio[] = [...MEDIOS_TARJETA, 'mercadopago']
const MEDIOS_DELIVERY: MedioApp[] = [
  'pedidosya', 'pedidosya_efectivo', 'rappi', 'mercado_pedidos', 'uber', 'delivery_propio', 'varios',
]

const MEDIO_LABEL: Record<Medio, string> = {
  visa_credito: 'Visa crédito',
  visa_debito: 'Visa débito',
  mastercard: 'Mastercard',
  maestro: 'Maestro',
  amex: 'Amex',
  pedidosya: 'PedidosYa',
  pedidosya_efectivo: 'PedidosYa (efectivo)',
  rappi: 'Rappi',
  mercadopago: 'Mercado Pago / QR',
  mercado_pedidos: 'Mercado Delivery',
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

// Rubros de gasto. El valor guardado es exactamente el texto mostrado (la columna
// `tipo` es TEXT). "Otros" se especifica en el campo "Descripción".
const RUBROS_GASTO: string[] = [
  'Librería',
  'Papelera',
  'Bazar',
  'Uniformes',
  'Botiquín',
  'Destapación',
  'Pendrive',
  'Pilas',
  'Decoración',
  'Fumigación',
  'Limpieza / Química',
  'Limpieza Campana',
  'Limpieza Canillas',
  'Mantenimiento',
  'Viajes uber/didi/cabify',
  'Otros',
]
const RUBRO_DEFAULT = RUBROS_GASTO[0]

// Formas de pago ofrecidas en el alta de gasto. Sólo `efectivo` sale de la caja
// del día; `fondo_fijo` sale del fondo fijo del local (lo baja, no toca la caja);
// `cuenta_corriente` y `otro` los paga administración / quedan en cuenta.
const FORMAS_PAGO: FormaPago[] = ['efectivo', 'fondo_fijo', 'cuenta_corriente', 'otro']
const FORMA_PAGO_LABEL: Record<FormaPago, string> = {
  efectivo: 'Efectivo',
  fondo_fijo: 'Fondo fijo',
  cuenta_corriente: 'Cuenta corriente',
  otro: 'Otro',
  // Valores heredados: ya no se ofrecen en el alta, pero pueden venir de cierres viejos.
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

// Aporte de un gasto a una factura, reportado al padre (planilla) para el
// pendiente por factura. `facturaTotal` puede repetirse entre gastos de la misma
// factura; la planilla toma el máximo (o el último no nulo) como total.
export type GastoFactura = {
  facturaNumero: string
  facturaTotal: number | null
  monto: number
}

// Entrada del historial de auditoría de un cierre (edición / reapertura por
// administración). `creadoEn` viaja serializado (ISO) desde el server.
export type CierreAuditoria = {
  usuarioNombre: string
  accion: string
  observacion: string
  creadoEn: string
}

// Fila de gasto en el estado local (incluye estado de subida del comprobante).
type GastoRow = {
  tipo: TipoGasto
  formaPago: FormaPago
  monto: number
  descripcion: string
  comprobanteId: number | null
  facturaNumero: string
  facturaTotal: number | null
  proveedorId: number | null
  subiendo: boolean
}

function gastosFromInicial(gastos?: Gasto[]): GastoRow[] {
  if (!gastos || gastos.length === 0) return []
  return gastos.map((g) => ({
    tipo: g.tipo,
    formaPago: g.formaPago,
    monto: g.monto,
    descripcion: g.descripcion ?? '',
    comprobanteId: g.comprobanteId ?? null,
    facturaNumero: g.facturaNumero ?? '',
    facturaTotal: g.facturaTotal ?? null,
    proveedorId: g.proveedorId ?? null,
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

/**
 * Modal reutilizable: overlay fijo + tarjeta centrada. Cierra con la X / botón
 * Cancelar (lo provee el contenido vía `onClose`), al hacer click en el overlay y
 * con Escape. Mobile-first: casi ancho completo en teléfono, max-w-md en desktop,
 * con scroll interno sólo si el contenido lo necesita.
 */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  )
}

// Etiqueta de campo dentro de los modales.
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

const selectClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500'

/**
 * Modal de carga/edición de un ingreso (línea de tarjeta/app). Edita un borrador
 * local y, al confirmar, devuelve la fila al padre. `inicial` = editar; sin él = nuevo.
 */
function IngresoModal({
  inicial,
  onClose,
  onConfirm,
}: {
  inicial?: IngresoRow
  onClose: () => void
  onConfirm: (row: IngresoRow) => void
}) {
  const editando = inicial != null
  const [medio, setMedio] = useState<Medio>(inicial?.medio ?? 'visa_credito')
  const [monto, setMonto] = useState<number>(inicial?.monto ?? 0)
  const [referencia, setReferencia] = useState<string>(inicial?.referencia ?? '')

  return (
    <Modal title={editando ? 'Editar ingreso' : 'Agregar ingreso'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Campo label="Medio">
          <select
            value={medio}
            onChange={(e) => setMedio(e.target.value as Medio)}
            className={selectClass}
          >
            <optgroup label="Formas de pago">
              {MEDIOS_FORMA_PAGO.map((m) => (
                <option key={m} value={m}>{MEDIO_LABEL[m]}</option>
              ))}
            </optgroup>
            <optgroup label="Apps de delivery">
              {MEDIOS_DELIVERY.map((m) => (
                <option key={m} value={m}>{MEDIO_LABEL[m]}</option>
              ))}
            </optgroup>
          </select>
        </Campo>
        <Campo label="Monto">
          <MoneyInput value={monto} onChange={setMonto} />
        </Campo>
        <Campo label="Referencia (cupón / lote)">
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Cupón / lote / ref."
            className={selectClass}
          />
        </Campo>
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onConfirm({ medio, monto, referencia })}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {editando ? 'Guardar' : 'Agregar'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Modal de carga/edición de un gasto. La subida del comprobante ocurre dentro del
 * modal: POST a /api/comprobante y guarda el comprobanteId en el borrador local.
 * Al confirmar, devuelve la fila completa al padre.
 */
function GastoModal({
  inicial,
  proveedores,
  onCrearProveedor,
  onClose,
  onConfirm,
}: {
  inicial?: GastoRow
  proveedores: Proveedor[]
  onCrearProveedor: (nombre: string) => Promise<Proveedor | null>
  onClose: () => void
  onConfirm: (row: GastoRow) => void
}) {
  const editando = inicial != null
  const [tipo, setTipo] = useState<TipoGasto>(inicial?.tipo ?? RUBRO_DEFAULT)
  const [formaPago, setFormaPago] = useState<FormaPago>(inicial?.formaPago ?? 'efectivo')
  const [monto, setMonto] = useState<number>(inicial?.monto ?? 0)
  const [descripcion, setDescripcion] = useState<string>(inicial?.descripcion ?? '')
  const [comprobanteId, setComprobanteId] = useState<number | null>(inicial?.comprobanteId ?? null)
  const [facturaNumero, setFacturaNumero] = useState<string>(inicial?.facturaNumero ?? '')
  const [facturaTotal, setFacturaTotal] = useState<number | null>(inicial?.facturaTotal ?? null)
  const [proveedorId, setProveedorId] = useState<number | null>(inicial?.proveedorId ?? null)
  const [nuevoProv, setNuevoProv] = useState('')
  const [creandoProv, setCreandoProv] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  async function agregarProveedor() {
    const nombre = nuevoProv.trim()
    if (!nombre) return
    setCreandoProv(true)
    const nuevo = await onCrearProveedor(nombre)
    setCreandoProv(false)
    if (nuevo) {
      setProveedorId(nuevo.id)
      setNuevoProv('')
    }
  }

  async function subir(file: File) {
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const res = await fetch('/api/comprobante', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('bad status')
      const { id } = (await res.json()) as { id: number }
      setComprobanteId(id)
    } catch {
      // dejamos el comprobante como estaba
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal title={editando ? 'Editar gasto' : 'Agregar gasto'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Campo label="Rubro">
          <select
            value={RUBROS_GASTO.includes(tipo) ? tipo : 'Otros'}
            onChange={(e) => setTipo(e.target.value)}
            className={selectClass}
          >
            {RUBROS_GASTO.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Forma de pago">
          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value as FormaPago)}
            className={selectClass}
          >
            {FORMAS_PAGO.map((fp) => (
              <option key={fp} value={fp}>{FORMA_PAGO_LABEL[fp]}</option>
            ))}
          </select>
        </Campo>
        {formaPago === 'cuenta_corriente' && (
          <Campo label="Proveedor (a quién se le debe)">
            <select
              value={proveedorId ?? ''}
              onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : null)}
              className={selectClass}
            >
              <option value="">(sin asignar)</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={nuevoProv}
                onChange={(e) => setNuevoProv(e.target.value)}
                placeholder="¿No está? Agregá uno nuevo"
                className={selectClass}
              />
              <button
                type="button"
                onClick={agregarProveedor}
                disabled={creandoProv || !nuevoProv.trim()}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {creandoProv ? '…' : 'Agregar'}
              </button>
            </div>
          </Campo>
        )}
        <Campo label="Monto">
          <MoneyInput value={monto} onChange={setMonto} />
        </Campo>
        <Campo label="Descripción">
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción"
            className={selectClass}
          />
        </Campo>
        <Campo label="N° de factura (opcional)">
          <input
            type="text"
            value={facturaNumero}
            onChange={(e) => setFacturaNumero(e.target.value)}
            placeholder="Ej.: F-0001-00001234"
            className={selectClass}
          />
        </Campo>
        <Campo label="Total de la factura (opcional)">
          <MoneyInput
            value={facturaTotal ?? 0}
            onChange={(n) => setFacturaTotal(n)}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Para pago parcial: cargá el total de la factura y este gasto cuenta como un pago contra ella.
          </span>
        </Campo>
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Comprobante</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              {subiendo ? (
                <Loader2 size={15} className="animate-spin text-blue-600" />
              ) : (
                <Paperclip size={15} />
              )}
              {comprobanteId != null ? 'Cambiar' : 'Subir comprobante'}
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) subir(file)
                  e.target.value = ''
                }}
              />
            </label>
            {comprobanteId != null && (
              <a
                href={`/api/comprobante/${comprobanteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-700"
              >
                <CheckCircle2 size={15} /> ver
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onConfirm({
              tipo,
              formaPago,
              monto,
              descripcion,
              comprobanteId,
              facturaNumero: facturaNumero.trim(),
              facturaTotal: facturaTotal && facturaTotal > 0 ? facturaTotal : null,
              proveedorId: formaPago === 'cuenta_corriente' ? proveedorId : null,
              subiendo: false,
            })
          }
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {editando ? 'Guardar' : 'Agregar'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Modal genérico que pide una observación (texto requerido). Lo usa administración
 * para justificar una edición de un cierre existente o una reapertura.
 */
function ObservacionModal({
  title,
  descripcion,
  confirmLabel,
  pending,
  onClose,
  onConfirm,
}: {
  title: string
  descripcion: string
  confirmLabel: string
  pending?: boolean
  onClose: () => void
  onConfirm: (observacion: string) => void
}) {
  const [obs, setObs] = useState('')
  const vacio = obs.trim() === ''
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-600">{descripcion}</p>
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Motivo del cambio…"
          rows={3}
          autoFocus
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={vacio || pending}
          onClick={() => onConfirm(obs.trim())}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function TurnoCierre({
  fecha,
  turno,
  titulo,
  fondoFijoDefault,
  inicial,
  onTotales,
  onGastos,
  precarga,
  verDiferencia = false,
  estado = null,
  esCentral = false,
  auditorias = [],
  proveedores = [],
}: {
  fecha: string
  turno: Turno
  titulo: string
  fondoFijoDefault: number
  inicial?: Partial<TurnoInput> & { nota?: string }
  onTotales?: (turno: Turno, t: TurnoTotales) => void
  onGastos?: (turno: Turno, gastos: GastoFactura[]) => void
  precarga?: Partial<TurnoInput>
  verDiferencia?: boolean
  estado?: string | null
  esCentral?: boolean
  auditorias?: CierreAuditoria[]
  proveedores?: Proveedor[]
}) {
  const [fondoFijo, setFondoFijo] = useState(inicial?.fondoFijo ?? fondoFijoDefault)
  const [montoZ, setMontoZ] = useState(inicial?.montoZ ?? 0)
  const [efectivoDepositado, setEfectivoDepositado] = useState(inicial?.efectivoDepositado ?? 0)
  const [notaCredito, setNC] = useState(inicial?.notaCredito ?? 0)
  const [cantidadTickets, setTickets] = useState<number | ''>(inicial?.cantidadTickets ?? '')

  const [efectivoVenta, setEfectivoVenta] = useState<number>(() => efectivoFromInicial(inicial?.ventas))
  const [ingresos, setIngresos] = useState<IngresoRow[]>(() => ingresosFromInicial(inicial))
  const [gastos, setGastos] = useState<GastoRow[]>(() => gastosFromInicial(inicial?.gastos))
  // Catálogo de proveedores para el selector del gasto en cuenta corriente. Se
  // mantiene en estado para poder sumar los que se crean en el modal sin recargar.
  const [provs, setProvs] = useState<Proveedor[]>(proveedores)
  const onCrearProveedor = useCallback(async (nombre: string): Promise<Proveedor | null> => {
    const res = await crearProveedor(nombre)
    if (!res.ok) return null
    setProvs((p) =>
      p.some((x) => x.id === res.proveedor.id)
        ? p
        : [...p, res.proveedor].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    )
    return res.proveedor
  }, [])

  const [nota, setNota] = useState(inicial?.nota ?? '')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  const [pending, setPending] = useState(false)

  // Estado de los modales de carga/edición. `null` = cerrado.
  // `index` null = nuevo; número = editar esa fila.
  const [ingresoModal, setIngresoModal] = useState<{ index: number | null } | null>(null)
  const [gastoModal, setGastoModal] = useState<{ index: number | null } | null>(null)
  // Modal de resumen/confirmación al cerrar el turno (muestra qué se está guardando).
  const [resumenModal, setResumenModal] = useState(false)

  // Estado/observación: el turno puede estar cerrado. Para el encargado, un turno
  // cerrado queda de sólo lectura. Administración puede editar/reabrir, pero al
  // hacerlo sobre un cierre existente debe dejar una observación.
  const cerrado = estado === 'cerrado'
  const esManana = turno === 'manana'
  const bloqueado = !esCentral && cerrado
  const existe = estado != null // ya hay un cierre guardado (mañana o tarde)
  // Modal de observación pendiente: para guardar (con `cerrar`) o reabrir.
  const [obsModal, setObsModal] = useState<{ tipo: 'guardar'; cerrar: boolean } | { tipo: 'reabrir' } | null>(null)

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
        .filter((g) => g.monto > 0 || g.descripcion.trim() !== '' || g.comprobanteId != null || g.facturaNumero.trim() !== '')
        .map((g) => ({
          tipo: g.tipo,
          formaPago: g.formaPago,
          monto: g.monto,
          descripcion: g.descripcion.trim() || null,
          comprobanteId: g.comprobanteId,
          facturaNumero: g.facturaNumero.trim() || null,
          facturaTotal: g.facturaTotal,
          proveedorId: g.formaPago === 'cuenta_corriente' ? g.proveedorId : null,
        })),
    }
  }, [fondoFijo, montoZ, efectivoDepositado, notaCredito, cantidadTickets, efectivoVenta, ingresos, gastos])

  const t = calcularTotales(input)

  // Reportar los totales al padre (planilla) para el total del día.
  useEffect(() => {
    onTotales?.(turno, t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.ventaTotal, t.ventaEfectivo, t.gastosTotal, t.gastosEfectivo, t.saldoEfectivo, t.diferenciaCaja, t.totalCredito, t.totalDebito])

  // Gastos con N° de factura → para el pendiente por factura (agregado en la planilla
  // a través de ambos turnos). Sólo reportamos los que tienen N° cargado.
  const gastosFactura = useMemo<GastoFactura[]>(
    () =>
      gastos
        .filter((g) => g.facturaNumero.trim() !== '')
        .map((g) => ({
          facturaNumero: g.facturaNumero.trim(),
          facturaTotal: g.facturaTotal,
          monto: g.monto,
        })),
    [gastos],
  )

  // Reportar los gastos con factura al padre. La firma serializada evita re-emitir
  // cuando el contenido no cambió.
  const gastosFacturaKey = JSON.stringify(gastosFactura)
  useEffect(() => {
    onGastos?.(turno, gastosFactura)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gastosFacturaKey])

  const diffAbs = Math.abs(t.diferenciaCaja)
  const requiereNota = diffAbs > 1000

  const diffStyle =
    diffAbs === 0
      ? { tile: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', emoji: '🟢' }
      : diffAbs <= 1000
        ? { tile: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500', emoji: '🟡' }
        : { tile: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500', emoji: '🔴' }

  // Guarda el cierre. `observacion` sólo se usa cuando administración edita un
  // cierre existente (lo exige el server y se registra en la auditoría).
  async function persistir(cerrar: boolean, observacion?: string) {
    setPending(true)
    const res = await guardarCierre(fecha, turno, JSON.stringify({ ...input, nota }), cerrar, observacion)
    setOk(res.ok)
    setMsg(res.ok ? (cerrar ? 'Cerrado correctamente.' : 'Borrador guardado.') : res.error)
    setPending(false)
    return res.ok
  }

  // Disparador de Guardar/Cerrar.
  //  - Administración editando un cierre EXISTENTE → modal de observación.
  //  - CERRAR (encargado o alta nueva) → modal de resumen para confirmar qué se guarda.
  //  - Guardar borrador → directo.
  async function submit(cerrar: boolean) {
    if (esCentral && existe) {
      setObsModal({ tipo: 'guardar', cerrar })
      return
    }
    if (cerrar) {
      setResumenModal(true)
      return
    }
    await persistir(false)
  }

  // Reapertura (administración). Pasa siempre por el modal de observación.
  async function confirmarReabrir(observacion: string) {
    setPending(true)
    const res = await reabrirCierre(fecha, turno, observacion)
    setOk(res.ok)
    setMsg(res.ok ? 'Turno reabierto. Ya podés editarlo.' : res.error)
    setPending(false)
    if (res.ok) setObsModal(null)
  }

  // Ingresos: la carga/edición ocurre en el modal. Al confirmar agregamos la línea
  // arriba (nueva) o reemplazamos la línea editada.
  const confirmarIngreso = (row: IngresoRow) => {
    setIngresos((p) => {
      if (ingresoModal?.index == null) return [row, ...p]
      const idx = ingresoModal.index
      return p.map((r, j) => (j === idx ? row : r))
    })
    setIngresoModal(null)
  }
  const quitarIngreso = (i: number) => setIngresos((p) => p.filter((_, j) => j !== i))

  // Gastos: misma lógica vía modal (agregamos al final cuando es nuevo).
  const confirmarGasto = (row: GastoRow) => {
    setGastos((p) => {
      if (gastoModal?.index == null) return [...p, row]
      const idx = gastoModal.index
      return p.map((g, j) => (j === idx ? row : g))
    })
    setGastoModal(null)
  }
  const quitarGasto = (i: number) => setGastos((p) => p.filter((_, j) => j !== i))

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
      <header
        className={`-mx-3 -mt-3 flex items-center justify-between gap-2 rounded-t-2xl border-b px-4 py-3 sm:-mx-4 sm:-mt-4 ${
          esManana ? 'border-amber-200 bg-amber-50' : 'border-indigo-200 bg-indigo-50'
        }`}
      >
        <h2 className={`flex items-center gap-2 text-lg font-bold ${esManana ? 'text-amber-800' : 'text-indigo-800'}`}>
          {esManana ? <Sun size={20} /> : <Moon size={20} />}
          Turno {titulo.toLowerCase()}
          {cerrado && (
            <span className="flex items-center gap-1 rounded-md bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-500">
              <Lock size={12} /> cerrado
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {verDiferencia && (
            <span className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${diffStyle.tile}`}>
              <span>{diffStyle.emoji}</span>
              Dif {formatMoney(t.diferenciaCaja)}
            </span>
          )}
          {esCentral && cerrado && (
            <button
              type="button"
              onClick={() => setObsModal({ tipo: 'reabrir' })}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              <Unlock size={14} /> Reabrir
            </button>
          )}
        </div>
      </header>

      {/* Banner de bloqueo: el encargado ve el turno cerrado en modo lectura. */}
      {bloqueado && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          <Lock size={16} className="shrink-0 text-slate-400" />
          <span>Turno cerrado. Pedí al administrador que lo reabra para editar.</span>
        </div>
      )}

      {/* Barra de carga rápida — siempre arriba del bloque.
          Cada botón abre un modal con TODOS los campos de esa entrada; al confirmar,
          la línea se agrega a la lista compacta de abajo (sin scrollear el form). */}
      {!bloqueado && (
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setIngresoModal({ index: null })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={17} /> Agregar ingreso
        </button>
        <button
          type="button"
          onClick={() => setGastoModal({ index: null })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Plus size={17} /> Agregar gasto
        </button>
      </div>
      )}

      {/* Resumen. Administración ve el tablero completo (tiles + diferencia + stats).
          El LOCAL ve sólo la "Venta del turno" para chequearla contra el Z — el resto
          es ruido para la carga. */}
      {verDiferencia ? (
        <>
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
        </>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-medium text-slate-600">Venta del turno</span>
          <span className="text-xl font-semibold tabular-nums text-slate-900">{formatMoney(t.ventaTotal)}</span>
        </div>
      )}

      {/* Sección editable. Cuando el turno está bloqueado (encargado + cerrado),
          el fieldset deshabilitado pone TODO en sólo lectura: inputs, selects y los
          botones de editar/quitar filas. Los datos y el resumen siguen visibles. */}
      <fieldset disabled={bloqueado} className="contents">

      {/* Caja */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Wallet size={18} className="text-slate-500" />
          <h3 className="font-medium text-slate-900">Caja</h3>
        </div>
        <div className="divide-y divide-slate-100">
          <MoneyRow label="Cierre Z" value={montoZ} onChange={setMontoZ} />
          <MoneyRow label="Efectivo depositado" value={efectivoDepositado} onChange={setEfectivoDepositado} />
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
          {/* Fondo fijo (con su restante) + Nota de crédito. Para administración van
              inline; para el LOCAL quedan bajo "Otros datos" para no recargar la carga. */}
          {(() => {
            const fondoFijoBloque = (
              <div>
                <MoneyRow label="Fondo fijo" value={fondoFijo} onChange={setFondoFijo} />
                {t.gastosFondoFijo > 0 && (
                  <p className="pb-1.5 text-xs text-slate-500">
                    Pagado con fondo fijo: <span className="tabular-nums">{formatMoney(t.gastosFondoFijo)}</span>
                    {' · '}Restante:{' '}
                    <span className={`font-medium tabular-nums ${t.fondoFijoRestante < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      {formatMoney(t.fondoFijoRestante)}
                    </span>
                    {' · '}a reponer <span className="tabular-nums">{formatMoney(t.gastosFondoFijo)}</span>
                  </p>
                )}
              </div>
            )
            const notaCreditoRow = <MoneyRow label="Nota de crédito" value={notaCredito} onChange={setNC} />
            return verDiferencia ? (
              <>
                {fondoFijoBloque}
                {notaCreditoRow}
              </>
            ) : (
              <details className="py-1.5">
                <summary className="cursor-pointer text-sm text-slate-500 marker:text-slate-400">
                  Otros datos (fondo fijo, nota de crédito)
                </summary>
                <div className="mt-1 divide-y divide-slate-100">
                  {fondoFijoBloque}
                  {notaCreditoRow}
                </div>
              </details>
            )
          })()}
        </div>
      </div>

      {/* Ingresos — efectivo (campo único) + una línea por cada cobro con tarjeta/app */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins size={18} className="text-slate-500" />
            <h3 className="font-medium text-slate-900">Ingresos</h3>
          </div>
          <button
            type="button"
            onClick={() => setIngresoModal({ index: null })}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus size={16} /> Agregar ingreso
          </button>
        </div>

        {/* Efectivo: no se itemiza, es un único monto */}
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Efectivo</span>
            <MoneyInput value={efectivoVenta} onChange={setEfectivoVenta} className="w-full shrink-0 sm:w-44" />
          </label>
        </div>

        {/* Lista compacta de ingresos cargados (tarjetas/apps). Tap en la fila o en
            el lápiz reabre el modal pre-cargado para editar; la × la quita. */}
        {ingresos.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin ingresos con tarjeta o app. Usá <span className="font-medium">Agregar ingreso</span> para cargar cada cobro.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ingresos.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <button
                  type="button"
                  onClick={() => setIngresoModal({ index: i })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-label="Editar ingreso"
                >
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-medium ${
                      isCardMedio(row.medio)
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {MEDIO_LABEL[row.medio]}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-900">
                    {formatMoney(row.monto)}
                  </span>
                  {row.referencia.trim() !== '' && (
                    <span className="truncate text-xs text-slate-400">{row.referencia}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIngresoModal({ index: i })}
                  aria-label="Editar ingreso"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-blue-600"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => quitarIngreso(i)}
                  aria-label="Quitar ingreso"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
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
          <button
            type="button"
            onClick={() => setGastoModal({ index: null })}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Plus size={16} /> Agregar gasto
          </button>
        </div>

        {/* Lista compacta de gastos cargados. Tap en la fila / lápiz → editar; × quita. */}
        {gastos.length === 0 ? (
          <p className="text-sm text-slate-400">Sin gastos cargados.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {gastos.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <button
                  type="button"
                  onClick={() => setGastoModal({ index: i })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-label="Editar gasto"
                >
                  <span className="inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700">
                    {g.tipo}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{FORMA_PAGO_LABEL[g.formaPago]}</span>
                  <span className="shrink-0 font-medium tabular-nums text-slate-900">
                    {formatMoney(g.monto)}
                  </span>
                  {g.descripcion.trim() !== '' && (
                    <span className="truncate text-xs text-slate-400">{g.descripcion}</span>
                  )}
                  {g.facturaNumero.trim() !== '' && (
                    <span className="shrink-0 text-xs text-slate-400">Fact. {g.facturaNumero}</span>
                  )}
                  {g.comprobanteId != null && (
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-600" aria-label="Con comprobante" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setGastoModal({ index: i })}
                  aria-label="Editar gasto"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-blue-600"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => quitarGasto(i)}
                  aria-label="Quitar gasto"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">Subtotal gastos</span>
          <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.gastosTotal)}</span>
        </div>
      </div>

      {/* Justificación de diferencia — solo administración (señal de cuadre) */}
      {verDiferencia && requiereNota && (
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

      </fieldset>

      {/* Historial de cambios — sólo administración. Edición / reapertura del cierre. */}
      {esCentral && auditorias.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <History size={16} className="text-slate-500" />
            <h3 className="text-sm font-medium text-slate-900">Historial</h3>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {auditorias.map((a, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                <span className="text-xs tabular-nums text-slate-400">
                  {new Date(a.creadoEn).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-medium text-slate-700">{a.usuarioNombre}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${a.accion === 'reapertura' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                  {a.accion === 'reapertura' ? 'reapertura' : 'edición'}
                </span>
                <span className="text-slate-500">{a.observacion}</span>
              </li>
            ))}
          </ul>
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
        {!bloqueado && (
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
            Cerrar turno {titulo.toLowerCase()}
          </button>
        </div>
        )}
      </div>

      {/* Resumen al cerrar: sumatoria de ingresos + resumen de gastos + caja, para
          confirmar qué se guarda antes de cerrar el turno. */}
      {resumenModal && (
        <Modal title={`Cerrar turno ${titulo.toLowerCase()}`} onClose={() => setResumenModal(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-900">Ingresos</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm">
                {efectivoVenta > 0 && (
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600">Efectivo</span>
                    <span className="tabular-nums text-slate-800">{formatMoney(efectivoVenta)}</span>
                  </div>
                )}
                {ingresos.map((r, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="text-slate-600">
                      {MEDIO_LABEL[r.medio]}
                      {r.referencia.trim() !== '' && <span className="text-xs text-slate-400"> · {r.referencia}</span>}
                    </span>
                    <span className="tabular-nums text-slate-800">{formatMoney(r.monto)}</span>
                  </div>
                ))}
                {efectivoVenta === 0 && ingresos.length === 0 && (
                  <p className="py-0.5 text-slate-400">Sin ingresos cargados.</p>
                )}
                <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                  <span>Total ingresos</span>
                  <span className="tabular-nums">{formatMoney(t.ventaTotal)}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-900">Gastos</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm">
                {gastos.length === 0 ? (
                  <p className="py-0.5 text-slate-400">Sin gastos cargados.</p>
                ) : (
                  <>
                    {gastos.map((g, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span className="text-slate-600">
                          {g.tipo} <span className="text-xs text-slate-400">· {FORMA_PAGO_LABEL[g.formaPago]}</span>
                        </span>
                        <span className="tabular-nums text-slate-800">{formatMoney(g.monto)}</span>
                      </div>
                    ))}
                    <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                      <span>Total gastos</span>
                      <span className="tabular-nums">{formatMoney(t.gastosTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-900">Caja</p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Cierre Z</span>
                  <span className="tabular-nums text-slate-800">{formatMoney(montoZ)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Efectivo depositado</span>
                  <span className="tabular-nums text-slate-800">{formatMoney(efectivoDepositado)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Cantidad de tickets</span>
                  <span className="tabular-nums text-slate-800">{cantidadTickets === '' ? '—' : cantidadTickets}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setResumenModal(false)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                // Sólo cerrar el modal si el guardado salió bien; si falla (red, gate
                // de nota), lo dejamos abierto para no ocultar el error tras el overlay.
                const ok = await persistir(true)
                if (ok) setResumenModal(false)
              }}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Confirmar cierre
            </button>
          </div>
        </Modal>
      )}

      {/* Modales de carga/edición. La key fuerza un remount al cambiar de fila para
          que el borrador interno arranque del valor correcto. */}
      {ingresoModal && (
        <IngresoModal
          key={`ingreso-${ingresoModal.index ?? 'new'}`}
          inicial={ingresoModal.index != null ? ingresos[ingresoModal.index] : undefined}
          onClose={() => setIngresoModal(null)}
          onConfirm={confirmarIngreso}
        />
      )}
      {gastoModal && (
        <GastoModal
          key={`gasto-${gastoModal.index ?? 'new'}`}
          inicial={gastoModal.index != null ? gastos[gastoModal.index] : undefined}
          proveedores={provs}
          onCrearProveedor={onCrearProveedor}
          onClose={() => setGastoModal(null)}
          onConfirm={confirmarGasto}
        />
      )}

      {/* Modal de observación: administración debe justificar editar o reabrir un
          cierre existente. La observación queda registrada en la auditoría. */}
      {obsModal?.tipo === 'guardar' && (
        <ObservacionModal
          title="Observación del cambio"
          descripcion="Estás editando un cierre ya cargado. Indicá el motivo del cambio."
          confirmLabel={obsModal.cerrar ? 'Guardar y cerrar' : 'Guardar'}
          pending={pending}
          onClose={() => setObsModal(null)}
          onConfirm={async (observacion) => {
            const ok = await persistir(obsModal.cerrar, observacion)
            if (ok) setObsModal(null)
          }}
        />
      )}
      {obsModal?.tipo === 'reabrir' && (
        <ObservacionModal
          title="Reabrir turno"
          descripcion="Vas a reabrir el cierre para poder editarlo. Indicá el motivo."
          confirmLabel="Reabrir"
          pending={pending}
          onClose={() => setObsModal(null)}
          onConfirm={confirmarReabrir}
        />
      )}
    </section>
  )
}
