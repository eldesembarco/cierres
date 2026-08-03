'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Power, X } from 'lucide-react'
import { MoneyInput } from '@/components/MoneyInput'
import { crearLocal, actualizarLocal, setActivoLocal } from './actions'

export type LocalRow = {
  id: number
  nombre: string
  marcaId: number
  marcaNombre: string
  direccion: string | null
  ciudad: string | null
  fondoFijoDefault: number
  tangoSucursalId: number | null
  activo: boolean
}

export type MarcaOpcion = { id: number; nombre: string }

export function LocalesAdmin({ locales, marcas }: { locales: LocalRow[]; marcas: MarcaOpcion[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState<LocalRow | 'nuevo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [soloActivos, setSoloActivos] = useState(true)

  const visibles = soloActivos ? locales.filter((l) => l.activo) : locales

  function cerrarModal() {
    setEditando(null)
    setError(null)
  }

  function guardar(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const esNuevo = editando === 'nuevo'
      const res = esNuevo
        ? await crearLocal(formData)
        : await actualizarLocal((editando as LocalRow).id, formData)
      if (!res.ok) {
        setError(res.error)
        return
      }
      cerrarModal()
      router.refresh()
    })
  }

  function toggleActivo(local: LocalRow) {
    startTransition(async () => {
      await setActivoLocal(local.id, !local.activo)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={(e) => setSoloActivos(e.target.checked)}
            className="rounded border-slate-300"
          />
          Solo activos
        </label>
        <button
          onClick={() => setEditando('nuevo')}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> Nuevo local
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Marca</th>
              <th className="px-3 py-2 font-medium">Ciudad</th>
              <th className="px-3 py-2 font-medium">Sucursal Tango</th>
              <th className="px-3 py-2 text-right font-medium">Fondo fijo</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  No hay locales para mostrar.
                </td>
              </tr>
            )}
            {visibles.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">{l.nombre}</td>
                <td className="px-3 py-2 text-slate-600">{l.marcaNombre}</td>
                <td className="px-3 py-2 text-slate-600">{l.ciudad ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums text-slate-600">{l.tangoSucursalId ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                  ${l.fondoFijoDefault.toLocaleString('es-AR')}
                </td>
                <td className="px-3 py-2">
                  {l.activo ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditando(l)}
                      title="Editar"
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => toggleActivo(l)}
                      disabled={pending}
                      title={l.activo ? 'Desactivar' : 'Reactivar'}
                      className={`rounded-lg p-1.5 transition-colors hover:bg-slate-100 ${
                        l.activo ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-emerald-600'
                      }`}
                    >
                      <Power size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <LocalModal
          local={editando === 'nuevo' ? null : editando}
          marcas={marcas}
          error={error}
          pending={pending}
          onCancel={cerrarModal}
          onSubmit={guardar}
        />
      )}
    </div>
  )
}

function LocalModal({
  local,
  marcas,
  error,
  pending,
  onCancel,
  onSubmit,
}: {
  local: LocalRow | null
  marcas: MarcaOpcion[]
  error: string | null
  pending: boolean
  onCancel: () => void
  onSubmit: (formData: FormData) => void
}) {
  const [fondoFijo, setFondoFijo] = useState(local?.fondoFijoDefault ?? 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {local ? 'Editar local' : 'Nuevo local'}
          </h2>
          <button onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form action={onSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="fondoFijoDefault" value={fondoFijo} />

          <div>
            <label htmlFor="nombre" className="mb-1 block text-xs font-medium text-slate-600">
              Nombre *
            </label>
            <input
              id="nombre"
              name="nombre"
              required
              defaultValue={local?.nombre ?? ''}
              placeholder="Ej: Desembarco Munro"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="marcaId" className="mb-1 block text-xs font-medium text-slate-600">
              Marca *
            </label>
            <select
              id="marcaId"
              name="marcaId"
              required
              defaultValue={local?.marcaId ?? ''}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Elegí una marca…
              </option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ciudad" className="mb-1 block text-xs font-medium text-slate-600">
                Ciudad
              </label>
              <input
                id="ciudad"
                name="ciudad"
                defaultValue={local?.ciudad ?? ''}
                placeholder="CABA"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="tangoSucursalId" className="mb-1 block text-xs font-medium text-slate-600">
                Sucursal Tango
              </label>
              <input
                id="tangoSucursalId"
                name="tangoSucursalId"
                type="number"
                defaultValue={local?.tangoSucursalId ?? ''}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="direccion" className="mb-1 block text-xs font-medium text-slate-600">
              Dirección
            </label>
            <input
              id="direccion"
              name="direccion"
              defaultValue={local?.direccion ?? ''}
              placeholder="Calle y número"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Fondo fijo por defecto</label>
            <MoneyInput value={fondoFijo} onChange={setFondoFijo} />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
