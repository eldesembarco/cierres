import Link from 'next/link'
import { TrendingUp, Package } from 'lucide-react'

// Pestañas del BI. `actual` = pathname de la página que la renderiza.
const TABS = [
  { href: '/', label: 'Ventas', icon: TrendingUp },
  { href: '/insumos', label: 'Insumos', icon: Package },
] as const

export function BiTabs({ actual }: { actual: string }) {
  return (
    <nav className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {TABS.map((t) => {
        const activa = actual === t.href
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activa ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activa ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon size={15} className={activa ? 'text-blue-600' : 'text-slate-400'} />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
