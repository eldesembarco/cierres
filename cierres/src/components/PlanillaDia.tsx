'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TurnoCierre } from '@/components/TurnoCierre'
import type { GastoFactura, CierreAuditoria } from '@/components/TurnoCierre'
import { sumarDia } from '@/lib/cierre/calculations'
import type { DiaTotales, Turno, TurnoInput, TurnoTotales } from '@/lib/cierre/types'
import type { TangoParseResult, TangoTurno } from '@/lib/ingest/parseTango'
import { formatMoney } from '@/lib/money'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Receipt, ShieldAlert } from 'lucide-react'

const TURNO_LABEL: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' }

const TURNO_VACIO: TurnoTotales = {
  ventaTotal: 0,
  ventaNeta: 0,
  ventaEfectivo: 0,
  gastosTotal: 0,
  gastosEfectivo: 0,
  saldoEfectivo: 0,
  diferenciaCaja: 0,
  totalCredito: 0,
  totalDebito: 0,
  ticketPromedio: null,
}

export function PlanillaDia({
  fecha,
  localId,
  fondoFijoDefault,
  inicialManana,
  inicialTarde,
  estadoManana = null,
  estadoTarde = null,
  auditoriasManana = [],
  auditoriasTarde = [],
  esCentral = false,
  puedeImportar = false,
  verDiferencia = false,
}: {
  fecha: string
  localId: number
  fondoFijoDefault: number
  inicialManana?: Partial<TurnoInput> & { nota?: string }
  inicialTarde?: Partial<TurnoInput> & { nota?: string }
  estadoManana?: string | null
  estadoTarde?: string | null
  auditoriasManana?: CierreAuditoria[]
  auditoriasTarde?: CierreAuditoria[]
  esCentral?: boolean
  puedeImportar?: boolean
  verDiferencia?: boolean
}) {
  const [totales, setTotales] = useState<Record<Turno, TurnoTotales>>({
    manana: TURNO_VACIO,
    tarde: TURNO_VACIO,
  })

  const onTotales = useCallback((turno: Turno, t: TurnoTotales) => {
    setTotales((p) => (p[turno] === t ? p : { ...p, [turno]: t }))
  }, [])

  // Gastos con N° de factura por turno → para el pendiente por factura del día.
  const [gastosFactura, setGastosFactura] = useState<Record<Turno, GastoFactura[]>>({
    manana: [],
    tarde: [],
  })

  const onGastos = useCallback((turno: Turno, gastos: GastoFactura[]) => {
    setGastosFactura((p) => ({ ...p, [turno]: gastos }))
  }, [])

  // Agregado por N° de factura a través de AMBOS turnos. Para cada factura:
  // total = max de los `facturaTotal` informados (o null si ninguno lo cargó),
  // pagado = suma de los montos de los gastos de esa factura.
  const facturas = useMemo(() => {
    const acc = new Map<string, { numero: string; total: number | null; pagado: number }>()
    for (const turno of ['manana', 'tarde'] as const) {
      for (const g of gastosFactura[turno]) {
        const numero = g.facturaNumero.trim()
        if (numero === '') continue
        const cur = acc.get(numero) ?? { numero, total: null, pagado: 0 }
        cur.pagado += g.monto
        if (g.facturaTotal != null) {
          cur.total = cur.total == null ? g.facturaTotal : Math.max(cur.total, g.facturaTotal)
        }
        acc.set(numero, cur)
      }
    }
    return Array.from(acc.values())
  }, [gastosFactura])

  const dia: DiaTotales = sumarDia([totales.manana, totales.tarde])
  const diffAbs = Math.abs(dia.diferenciaDia)
  const diaStyle =
    diffAbs === 0
      ? { tile: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', emoji: '🟢' }
      : diffAbs <= 1000
        ? { tile: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500', emoji: '🟡' }
        : { tile: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500', emoji: '🔴' }

  // Precarga desde Tango: cada turno recibe su slice como nueva referencia.
  const [precargaManana, setPrecargaManana] = useState<Partial<TurnoInput> | undefined>()
  const [precargaTarde, setPrecargaTarde] = useState<Partial<TurnoInput> | undefined>()
  const [importLoading, setImportLoading] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [importError, setImportError] = useState('')
  const reqIdRef = useRef(0)

  // Control Tango (solo admin/central): turnos reales de Tango del día, para
  // mostrar ventas/anulaciones/devoluciones como señal de auditoría. El encargado
  // NO ve esto (gated por `puedeImportar`, que es central/admin). Se carga al
  // montar para que el panel aparezca sin tener que tocar "Importar desde Tango".
  const [tangoTurnos, setTangoTurnos] = useState<TangoTurno[]>([])

  useEffect(() => {
    if (!puedeImportar) return
    let cancelado = false
    const params = new URLSearchParams({ fecha, localId: String(localId) })
    fetch(`/api/tango?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('bad status'))))
      .then((r: TangoParseResult) => {
        if (!cancelado) setTangoTurnos(r.turnos)
      })
      .catch(() => {
        if (!cancelado) setTangoTurnos([])
      })
    return () => {
      cancelado = true
    }
  }, [puedeImportar, fecha, localId])

  async function importarTango() {
    setImportLoading(true)
    setImportMsg('')
    setImportError('')
    const reqId = ++reqIdRef.current
    try {
      const params = new URLSearchParams({ fecha, localId: String(localId) })
      const res = await fetch(`/api/tango?${params.toString()}`)
      if (!res.ok) throw new Error('bad status')
      const r: TangoParseResult = await res.json()
      // reqId no se usa más que como marca de depuración; cada slice es una
      // referencia nueva, así que el efecto de precarga en cada turno se dispara.
      void reqId
      setTangoTurnos(r.turnos)
      if (r.turnos.length === 0) {
        setImportMsg('Sin datos de Tango para este día todavía.')
        return
      }
      for (const turno of r.turnos) {
        const slice: Partial<TurnoInput> = {
          ventas: turno.ventas,
          montoZ: turno.montoZ,
          cantidadTickets: turno.cantidadTickets,
        }
        if (turno.turno === 'manana') setPrecargaManana(slice)
        else if (turno.turno === 'tarde') setPrecargaTarde(slice)
      }
      setImportMsg('Información actualizada desde Tango ✓ — revisá y guardá cada turno.')
    } catch {
      setImportError('No se pudo actualizar la información. Probá de nuevo.')
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Importar desde Tango — solo administración (central/admin) */}
      {puedeImportar && (
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
        <span className="text-xs text-slate-400">datos recibidos por correo desde Tango</span>
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
      )}

      {/* Control Tango — SOLO admin/central (gated por puedeImportar). El encargado
          es ciego y NO debe ver anulaciones/devoluciones. Se oculta si no hay datos
          de Tango para el día. Marca en ámbar/rojo cuando hay anulaciones o
          devoluciones > 0 como señal de auditoría. */}
      {puedeImportar && tangoTurnos.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert size={16} className="text-blue-600" />
            <p className="text-sm font-semibold text-slate-900">Control Tango</p>
            <span className="text-xs text-slate-400">solo administración · datos reales de Tango</span>
          </div>
          <div className="flex flex-col gap-2">
            {tangoTurnos.map((t) => {
              const afectan = t.anulacionesAfectanCaja ?? 0
              const anulTotal = t.anulacionesTotal ?? 0
              const devol = t.devolucionesTotal ?? 0
              const hayAnul = anulTotal > 0 || afectan > 0
              const hayDevol = devol > 0
              return (
                <div
                  key={t.turno}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{TURNO_LABEL[t.turno]}</span>
                    <span className="text-xs text-slate-500">
                      Ventas Tango{' '}
                      <span className="font-medium tabular-nums text-slate-800">{formatMoney(t.montoZ)}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div
                      className={`rounded-md border px-3 py-2 text-sm ${
                        hayAnul
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <p className="text-[12px] opacity-80">Anulaciones</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 tabular-nums">
                        <span>
                          afectan caja{' '}
                          <span className="font-semibold">{formatMoney(afectan)}</span>
                        </span>
                        <span className="opacity-80">
                          total <span className="font-semibold">{formatMoney(anulTotal)}</span>
                        </span>
                      </p>
                    </div>
                    <div
                      className={`rounded-md border px-3 py-2 text-sm ${
                        hayDevol
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <p className="text-[12px] opacity-80">Devoluciones</p>
                      <p className="mt-0.5 tabular-nums">
                        <span className="font-semibold">{formatMoney(devol)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Total del día */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-900">Total del día</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[12px] text-slate-500">Venta del día</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{formatMoney(dia.ventaTotalDia)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[12px] text-slate-500">Venta efectivo</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{formatMoney(dia.ventaEfectivoDia)}</p>
          </div>
          {verDiferencia && (
            <div className={`col-span-2 rounded-lg p-3 sm:col-span-1 ${diaStyle.tile}`}>
              <p className="text-[12px] opacity-80">Diferencia del día</p>
              <p className="mt-0.5 flex items-center gap-2 text-xl font-semibold tabular-nums">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${diaStyle.dot}`} />
                {formatMoney(dia.diferenciaDia)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Facturas — pendiente por N° de factura, agregado entre mañana y tarde.
          Visible para todos los roles: es seguimiento de facturas, no señal de cuadre. */}
      {facturas.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Receipt size={16} className="text-slate-500" />
            <p className="text-sm font-semibold text-slate-900">Facturas</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {facturas.map((f) => {
              const pendiente = f.total == null ? null : Math.round((f.total - f.pagado) * 100) / 100
              const saldada = pendiente != null && pendiente <= 0
              return (
                <div
                  key={f.numero}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-800">Factura {f.numero}</span>
                  {f.total == null ? (
                    <span className="text-slate-500">
                      pagado <span className="font-medium tabular-nums text-slate-800">{formatMoney(f.pagado)}</span>
                      <span className="ml-2 text-xs text-slate-400">(sin total cargado)</span>
                    </span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                      <span>
                        pagado <span className="font-medium tabular-nums text-slate-800">{formatMoney(f.pagado)}</span> de{' '}
                        <span className="font-medium tabular-nums text-slate-800">{formatMoney(f.total)}</span>
                      </span>
                      {saldada ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 size={14} /> saldada
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700">
                          pendiente <span className="tabular-nums">{formatMoney(pendiente!)}</span>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bloques por turno */}
      <TurnoCierre
        fecha={fecha}
        turno="manana"
        titulo="Mañana"
        fondoFijoDefault={fondoFijoDefault}
        inicial={inicialManana}
        onTotales={onTotales}
        onGastos={onGastos}
        precarga={precargaManana}
        verDiferencia={verDiferencia}
        estado={estadoManana}
        esCentral={esCentral}
        auditorias={auditoriasManana}
      />
      <TurnoCierre
        fecha={fecha}
        turno="tarde"
        titulo="Tarde"
        fondoFijoDefault={fondoFijoDefault}
        inicial={inicialTarde}
        onTotales={onTotales}
        onGastos={onGastos}
        precarga={precargaTarde}
        verDiferencia={verDiferencia}
        estado={estadoTarde}
        esCentral={esCentral}
        auditorias={auditoriasTarde}
      />
    </div>
  )
}
