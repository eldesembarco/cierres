import Link from 'next/link'
import type { Session } from 'next-auth'
import { ScrollText, LogOut } from 'lucide-react'
import { puedeElegirLocal } from '@/lib/auth/rbac'
import { logout } from '@/app/actions/auth'
import { LocalActivoSelect } from '@/components/LocalActivoSelect'
import { TopNav } from '@/components/TopNav'

type LocalOpt = { id: number; nombre: string }

function initials(value: string) {
  const base = value.split('@')[0] ?? value
  const parts = base.replace(/[._-]+/g, ' ').trim().split(/\s+/)
  const chars = parts.slice(0, 2).map((p) => p[0] ?? '')
  return (chars.join('') || base.slice(0, 2)).toUpperCase()
}

export function TopBar({
  session,
  titulo,
  locales,
  localActivoId,
}: {
  session: Session
  titulo: string
  locales?: LocalOpt[]
  localActivoId?: number
}) {
  const { rol } = session.user
  const email = session.user.email ?? session.user.rol
  const mostrarSelector =
    puedeElegirLocal(rol) && locales != null && locales.length > 0 && localActivoId != null

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      {/* Fila 1: marca + acciones */}
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/cierres" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ScrollText size={19} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">{titulo}</span>
            <span className="block truncate text-[11px] text-slate-500">Grupo Desembarco</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {mostrarSelector && (
            <LocalActivoSelect locales={locales!} localActivoId={localActivoId!} />
          )}
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5 sm:flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
              {initials(email)}
            </span>
            <span className="max-w-[150px] truncate text-xs text-slate-600">{email}</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={16} />
              <span className="sr-only">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </div>

      {/* Fila 2: navegación con estado activo (su propio espacio, sin apretar) */}
      <div className="mx-auto max-w-6xl border-t border-slate-100">
        <TopNav rol={rol} />
      </div>
    </header>
  )
}
