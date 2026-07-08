'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TrendingUp, Package } from 'lucide-react'

const ITEMS = [
  { href: '/', label: 'Ventas', icon: TrendingUp },
  { href: '/insumos', label: 'Insumos', icon: Package },
] as const

export function Nav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map((it) => {
        const active = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href)
        const Icon = it.icon
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon size={15} className={active ? 'text-indigo-600' : 'text-slate-400'} />
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
