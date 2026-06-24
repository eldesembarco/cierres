'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Store, ChevronDown } from 'lucide-react'
import { setLocalActivo } from '@/lib/auth/localActivo'

type LocalOpt = { id: number; nombre: string }

/**
 * Selector de "local activo" para central/admin, siempre visible en la TopBar.
 * Al cambiar persiste la cookie (server action) y refresca para que todas las
 * pantallas re-lean el local activo.
 */
export function LocalActivoSelect({
  locales,
  localActivoId,
}: {
  locales: LocalOpt[]
  localActivoId: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value)
    if (!Number.isFinite(id) || id === localActivoId) return
    startTransition(async () => {
      await setLocalActivo(id)
      router.refresh()
    })
  }

  return (
    <div
      className={`relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2 pr-1 ${
        pending ? 'opacity-60' : ''
      }`}
      title="Local activo"
    >
      <Store size={14} className="shrink-0 text-slate-500" />
      <span className="hidden text-[11px] font-medium text-slate-500 sm:inline">Local:</span>
      <div className="relative">
        <select
          value={localActivoId}
          onChange={onChange}
          disabled={pending}
          aria-label="Local activo"
          className="max-w-[10rem] cursor-pointer appearance-none truncate rounded-md bg-transparent py-0.5 pl-1 pr-5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-[14rem]"
        >
          {locales.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  )
}
