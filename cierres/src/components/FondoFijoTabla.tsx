'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, AlertCircle, Pencil } from 'lucide-react'
import { reponerFondoFijo, setFondoFijoObjetivo } from '@/app/fondo-fijo/actions'
import { formatMoney } from '@/lib/money'

export type SaldoRow = {
  localId: number
  localNombre: string
  base: number
  saldoActual: number
  aReponer: number
  saldoAFavor: number
}

export function FondoFijoTabla({ filas, puedeReponer }: { filas: SaldoRow[]; puedeReponer: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modal, setModal] = useState<SaldoRow | null>(null)
  const [monto, setMonto] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  // Modal de edición del objetivo (base) del fondo fijo.
  const [editModal, setEditModal] = useState<SaldoRow | null>(null)
  const [editMonto, setEditMonto] = useState('')
  const [editErr, setEditErr] = useState('')

  function abrir(row: SaldoRow) {
    setModal(row)
    setMonto(row.aReponer > 0 ? String(row.aReponer) : '')
    setDesc('')
    setErr('')
  }
  function abrirEdit(row: SaldoRow) {
    setEditModal(row)
    setEditMonto(String(row.base))
    setEditErr('')
  }
  function confirmarEdit() {
    if (!editModal) return
    const m = Number(editMonto)
    if (!(m >= 0) || !Number.isFinite(m)) {
      setEditErr('Ingresá un monto válido (0 o más).')
      return
    }
    startTransition(async () => {
      const res = await setFondoFijoObjetivo(editModal.localId, m)
      if (res.ok) {
        setEditModal(null)
        router.refresh()
      } else {
        setEditErr(res.error)
      }
    })
  }
  function confirmar() {
    if (!modal) return
    const m = Number(monto)
    if (!(m > 0)) {
      setErr('Ingresá un monto válido.')
      return
    }
    startTransition(async () => {
      const res = await reponerFondoFijo(modal.localId, m, desc.trim() || undefined)
      if (res.ok) {
        setModal(null)
        router.refresh()
      } else {
        setErr(res.error)
      }
    })
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-medium">Local</th>
              <th className="px-3 py-2 text-right font-medium">Fondo (base)</th>
              <th className="px-3 py-2 text-right font-medium">Saldo actual</th>
              <th className="px-3 py-2 text-right font-medium">A reponer</th>
              {puedeReponer && <th className="px-4 py-2 text-right font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.localId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{f.localNombre}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {formatMoney(f.base)}
                    {puedeReponer && (
                      <button
                        type="button"
                        onClick={() => abrirEdit(f)}
                        title="Editar objetivo del fondo fijo"
                        className="text-slate-300 hover:text-blue-600"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </span>
                </td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${f.saldoActual < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatMoney(f.saldoActual)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f.aReponer > 0 ? (
                    <span className="font-semibold text-amber-600">{formatMoney(f.aReponer)}</span>
                  ) : f.saldoAFavor > 0 ? (
                    <span className="text-emerald-600">a favor {formatMoney(f.saldoAFavor)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                {puedeReponer && (
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => abrir(f)}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-600 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <Plus size={13} /> Reponer
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => !pending && setModal(null)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Reponer fondo fijo</h3>
              <button type="button" onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              {modal.localNombre} · saldo actual {formatMoney(modal.saldoActual)}
              {modal.aReponer > 0 && <> · a reponer <span className="font-medium text-amber-600">{formatMoney(modal.aReponer)}</span></>}
            </p>
            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Monto que se repone</span>
              <input
                type="number"
                inputMode="numeric"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </label>
            <label className="mb-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Detalle (opcional)</span>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Ej.: entregado en efectivo el 03/07"
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </label>
            {err && (
              <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} /> {err}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal(null)} disabled={pending} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmar} disabled={pending} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? 'Reponiendo…' : 'Reponer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => !pending && setEditModal(null)}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Objetivo del fondo fijo</h3>
              <button type="button" onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              {editModal.localNombre} — cuánto fondo fijo (caja chica) tiene que tener este local. El "a reponer" se calcula contra este monto.
            </p>
            <label className="mb-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">Fondo fijo objetivo</span>
              <input
                type="number"
                inputMode="numeric"
                value={editMonto}
                onChange={(e) => setEditMonto(e.target.value)}
                placeholder="0"
                className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </label>
            {editErr && (
              <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} /> {editErr}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditModal(null)} disabled={pending} className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmarEdit} disabled={pending} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
