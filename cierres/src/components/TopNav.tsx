'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Rol } from '@prisma/client'
import { ScrollText, Wallet, Upload, Scale, GitCompareArrows, BarChart3, FileSpreadsheet, Coins, LayoutDashboard, Landmark } from 'lucide-react'

// Ítems de navegación con visibilidad por rol. El contable (solo lectura) ve todo
// lo financiero pero NO Cierres ni Importar.
const ITEMS = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, roles: ['central', 'admin', 'contable'] },
  { href: '/cierres', label: 'Cierres', icon: ScrollText, roles: ['encargado', 'central', 'admin'] },
  { href: '/cuenta-corriente', label: 'Cuenta corriente', icon: Wallet, roles: ['encargado', 'central', 'admin', 'contable'] },
  { href: '/fondo-fijo', label: 'Fondo fijo', icon: Coins, roles: ['encargado', 'central', 'admin', 'contable'] },
  { href: '/reportes', label: 'Reportes MP', icon: FileSpreadsheet, roles: ['central', 'admin', 'contable'] },
  { href: '/importaciones', label: 'Importar', icon: Upload, roles: ['central', 'admin'] },
  { href: '/control', label: 'Tablero', icon: Scale, roles: ['central', 'admin', 'contable'] },
  { href: '/conciliacion', label: 'Conciliar MP', icon: GitCompareArrows, roles: ['central', 'admin', 'contable'] },
  { href: '/conciliacion-cobros', label: 'Cobros Tango', icon: Landmark, roles: ['central', 'admin', 'contable'] },
  { href: '/informes', label: 'Informes', icon: BarChart3, roles: ['central', 'admin', 'contable'] },
] as const

/**
 * Barra de navegación (cliente): resalta la pantalla activa con `usePathname`, así
 * el usuario siempre sabe dónde está. Scrollea horizontal en pantallas chicas.
 */
export function TopNav({ rol }: { rol: Rol }) {
  const pathname = usePathname()
  const items = ITEMS.filter((it) => (it.roles as readonly string[]).includes(rol))

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
