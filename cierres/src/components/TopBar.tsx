import Link from 'next/link'
import type { Session } from 'next-auth'
import { ScrollText, Upload, Scale, BarChart3, LogOut } from 'lucide-react'
import { esCentral } from '@/lib/auth/rbac'
import { logout } from '@/app/actions/auth'
import { LocalActivoSelect } from '@/components/LocalActivoSelect'

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
  const central = esCentral(rol)
  const mostrarSelector =
    central && locales != null && locales.length > 0 && localActivoId != null

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        {/* Brand */}
        <Link href="/cierres" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ScrollText size={18} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">{titulo}</span>
            <span className="block truncate text-[11px] text-slate-500">Grupo Desembarco</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink href="/cierres" icon={<ScrollText size={15} />}>
            Cierres
          </NavLink>
          {central && (
            <>
              <NavLink href="/importaciones" icon={<Upload size={15} />}>
                Importar
              </NavLink>
              <NavLink href="/control" icon={<Scale size={15} />}>
                Tablero
              </NavLink>
              <NavLink href="/informes" icon={<BarChart3 size={15} />}>
                Informes
              </NavLink>
            </>
          )}
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-2">
          {mostrarSelector && (
            <LocalActivoSelect locales={locales!} localActivoId={localActivoId!} />
          )}
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
              {initials(email)}
            </span>
            <span className="hidden max-w-[140px] truncate text-xs text-slate-600 sm:block">{email}</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={16} />
              <span className="sr-only">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav row */}
      {central && (
        <div className="flex items-center gap-1 border-t border-slate-100 px-3 py-1.5 sm:hidden">
          <NavLink href="/cierres" icon={<ScrollText size={15} />} compact>
            Cierres
          </NavLink>
          <NavLink href="/importaciones" icon={<Upload size={15} />} compact>
            Importar
          </NavLink>
          <NavLink href="/control" icon={<Scale size={15} />} compact>
            Tablero
          </NavLink>
          <NavLink href="/informes" icon={<BarChart3 size={15} />} compact>
            Informes
          </NavLink>
        </div>
      )}
    </header>
  )
}

function NavLink({
  href,
  icon,
  children,
  compact,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${
        compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
      }`}
    >
      <span className="text-slate-500">{icon}</span>
      {children}
    </Link>
  )
}
