'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'

/**
 * Permite abrir la planilla de una fecha pasada (p.ej. un cierre que se olvidó
 * cargar). Navega a /cierres/[fecha]. `max` = hoy para no abrir el futuro.
 */
export function IrAFecha({ hoy }: { hoy: string }) {
  const router = useRouter()
  const [fecha, setFecha] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        // Candado: solo fechas con año razonable (evita "0026" por un typo en el picker).
        const anio = Number(fecha.slice(0, 4))
        if (fecha && anio >= 2020 && anio <= 2100) router.push(`/cierres/${fecha}`)
      }}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm"
    >
      <CalendarPlus size={15} className="shrink-0 text-slate-400" />
      <input
        type="date"
        min="2025-01-01"
        max={hoy}
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        aria-label="Abrir cierre de otra fecha"
        className="w-[8.5rem] bg-transparent text-sm tabular-nums text-slate-700 outline-none"
      />
      <button
        type="submit"
        disabled={!fecha}
        className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-40"
      >
        Abrir
      </button>
    </form>
  )
}
