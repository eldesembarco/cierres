'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ScrollText, Wallet, Upload, Scale, GitCompareArrows, BarChart3 } from 'lucide-react'

// Ítems de navegación. `central: true` = sólo administración (central/admin).
const ITEMS = [
  { href: '/cierres', label: 'Cierres', icon: ScrollText, central: false },
  { href: '/cuenta-corriente', label: 'Cuenta corriente', icon: Wallet, central: false },
  { href: '/importaciones', label: 'Importar', icon: Upload, central: true },
  { href: '/control', label: 'Tablero', icon: Scale, central: true },
  { href: '/conciliacion', label: 'Conciliar MP', icon: GitCompareArrows, central: true },
  { href: '/informes', label: 'Informes', icon: BarChart3, central: true },
] as const

/**
 * Barra de navegación (cliente): resalta la pantalla activa con `usePathname`, así
 * el usuario siempre sabe dónde está. Scrollea horizontal en pantallas chicas.
 */
export function TopNav({ central }: { central: boolean }) {
  const pathname = usePathname()
  const items = ITEMS.filter((it) => (it.central ? central : true))

  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-3 py-1.5 sm:px-4">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`)
        const Icon = it.icon
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
