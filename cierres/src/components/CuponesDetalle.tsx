'use client'

import { useState } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { conciliarLinea } from '@/lib/cierre/conciliacion'
import { formatMoney } from '@/lib/money'
import type { Cupon } from '@/lib/cierre/types'

export function CuponesDetalle({
  declarado,
  value,
  onChange,
}: {
  declarado: number
  value: Cupon[]
  onChange: (next: Cupon[]) => void
}) {
  const [open, setOpen] = useState(value.length > 0)

  const setRow = (i: number, patch: Partial<Cupon>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const addRow = () => onChange([...value, { referencia: '', importe: 0 }])
  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i))

  const con = conciliarLinea(value.map((c) => c.importe), declarado)
  const sem = con.estado === 'ok' ? '🟢' : '🔴'

  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-blue-600 hover:underline">
        {open ? 'Ocultar detalle' : 'Detalle / cupones'}{value.length > 0 ? ` (${value.length})` : ''}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {value.map((c, i) => (
            <div key={i} className="mb-1 flex items-center gap-2">
              <input
                value={c.referencia}
                onChange={(e) => setRow(i, { referencia: e.target.value })}
                placeholder="N° cupón / ref."
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MoneyInput value={c.importe} onChange={(n: number) => setRow(i, { importe: n })} className="w-28" />
              <button type="button" onClick={() => removeRow(i)} aria-label="Quitar" className="px-1 text-slate-400 hover:text-red-600">&times;</button>
            </div>
          ))}
          <button type="button" onClick={addRow} className="mt-1 text-xs text-blue-600 hover:underline">+ agregar cupón</button>
          {value.length > 0 && (
            <div className="mt-2 border-t border-slate-200 pt-2 text-xs tabular-nums text-slate-600">
              Cupones: {formatMoney(con.sumaCupones)} &middot; Declarado: {formatMoney(con.declarado)} &middot; Dif: {formatMoney(con.diferencia)} {sem}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
