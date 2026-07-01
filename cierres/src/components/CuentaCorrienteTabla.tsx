'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, RotateCcw, Paperclip } from 'lucide-react'
import { marcarPagado } from '@/app/cuenta-corriente/actions'
import { formatMoney } from '@/lib/money'

export type MovimientoRow = {
  id: number
  fecha: string
  localNombre: string
  proveedorNombre: string | null
  concepto: string
  descripcion: string | null
  monto: number
  pagado: boolean
  pagadoEn: string | null
}

function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }).format(new Date(iso))
}

export function CuentaCorrienteTabla({
  filas,
  puedeMarcar,
}: {
  filas: MovimientoRow[]
  puedeMarcar: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle(id: number, pagar: boolean) {
    startTransition(async () => {
      await marcarPagado(id, pagar)
      router.refresh()
    })
  }

  if (filas.length === 0) {
    return <p className="px-3 py-8 text-center text-sm text-slate-400">No hay movimientos para el filtro elegido.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Local</th>
            <th className="px-3 py-2 font-medium">Proveedor</th>
            <th className="px-3 py-2 font-medium">Concepto</th>
            <th className="px-3 py-2 text-right font-medium">Monto</th>
            <th className="px-3 py-2 text-right font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{fechaCorta(f.fecha)}</td>
              <td className="px-3 py-2 text-slate-700">{f.localNombre}</td>
              <td className="px-3 py-2 text-slate-700">
                {f.proveedorNombre ?? <span className="text-slate-400">(sin asignar)</span>}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {f.concepto}
                {f.descripcion ? <span className="text-slate-400"> · {f.descripcion}</span> : null}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{formatMoney(f.monto)}</td>
              <td className="px-3 py-2 text-right">
                {f.pagado ? (
                  <div className="flex items-center justify-end gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={13} /> Pagado
                    </span>
                    {puedeMarcar && (
                      <button
                        type="button"
                        onClick={() => toggle(f.id, false)}
                        disabled={pending}
                        title="Volver a pendiente"
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                ) : puedeMarcar ? (
                  <button
                    type="button"
                    onClick={() => toggle(f.id, true)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Marcar pagado
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Paperclip size={13} /> Pendiente
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
