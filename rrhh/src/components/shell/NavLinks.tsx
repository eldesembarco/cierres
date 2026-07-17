'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Network, FolderCheck, UserPlus, Palmtree, Settings,
} from 'lucide-react'

const items = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/nomina', label: 'Nómina', icon: Users },
  { href: '/organigrama', label: 'Organigrama', icon: Network },
  { href: '/documentos', label: 'Documentos', icon: FolderCheck },
  { href: '/onboarding', label: 'Onboarding', icon: UserPlus },
  { href: '/vacaciones', label: 'Vacaciones', icon: Palmtree },
  { href: '/config', label: 'Configuración', icon: Settings },
]

export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={
              active
                ? 'flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white'
                : 'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-coal-muted hover:bg-white/5 hover:text-coal-ink'
            }
          >
            <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} />
            {label}
            {active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
          </Link>
        )
      })}
    </nav>
  )
}
