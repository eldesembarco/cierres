'use client'

import { useCallback, useRef, useState } from 'react'
import { TurnoCierre } from '@/components/TurnoCierre'
import { sumarDia } from '@/lib/cierre/calculations'
import type { DiaTotales, Turno, TurnoInput, TurnoTotales } from '@/lib/cierre/types'
import type { TangoParseResult } from '@/lib/ingest/parseTango'
import { formatMoney } from '@/lib/money'
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react'

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
  fondoFijoDefault,
  inicialManana,
  inicialTarde,
  puedeImportar = false,
  verDiferencia = false,
}: {
  fecha: string
  fondoFijoDefault: number
  inicialManana?: Partial<TurnoInput> & { nota?: string }
  inicialTarde?: Partial<TurnoInput> & { nota?: string }
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

  async function importarTango() {
    setImportLoading(true)
    setImportMsg('')
    setImportError('')
    const reqId = ++reqIdRef.current
    try {
      const params = new URLSearchParams({ fecha, localId: '' })
      const res = await fetch(`/api/tango?${params.toString()}`)
      if (!res.ok) throw new Error('bad status')
      const r: TangoParseResult = await res.json()
      // reqId no se usa más que como marca de depuración; cada slice es una
      // referencia nueva, así que el efecto de precarga en cada turno se dispara.
      void reqId
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

      {/* Bloques por turno */}
      <TurnoCierre
        fecha={fecha}
        turno="manana"
        titulo="Mañana"
        fondoFijoDefault={fondoFijoDefault}
        inicial={inicialManana}
        onTotales={onTotales}
        precarga={precargaManana}
        verDiferencia={verDiferencia}
      />
      <TurnoCierre
        fecha={fecha}
        turno="tarde"
        titulo="Tarde"
        fondoFijoDefault={fondoFijoDefault}
        inicial={inicialTarde}
        onTotales={onTotales}
        precarga={precargaTarde}
        verDiferencia={verDiferencia}
      />
    </div>
  )
}
