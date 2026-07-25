'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X, User } from 'lucide-react'
import { brand } from '@/lib/config/brand'
import { CLERK_ACTIVE_CLIENT } from '@/lib/env'
import { cn } from '@/lib/utils'
import { NavAuth } from './NavAuth'

const links = [
  { to: '/archivo', label: 'El Archivo' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/comunidad', label: 'Comunidad' },
  { to: '/contacto', label: 'Contacto' },
]

export function Nav() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-500',
        scrolled ? 'bg-ink-900/85 backdrop-blur-md border-b border-cream-400/10' : 'bg-transparent',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between md:h-20">
        <Link href="/" className="group flex items-center gap-3">
          <span className="font-serif text-2xl leading-none tracking-tight text-cream-50 md:text-3xl">
            {brand.name}
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.35em] text-gold/70 md:block">
            {brand.tagline}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => {
            const active = pathname === l.to || pathname.startsWith(l.to + '/')
            return (
              <Link
                key={l.to}
                href={l.to}
                className={cn(
                  'relative text-xs font-medium uppercase tracking-[0.22em] transition',
                  active ? 'text-cream-50' : 'text-cream-200/70 hover:text-cream-50',
                )}
              >
                {l.label}
                {active && <span className="absolute -bottom-1 left-0 h-px w-full bg-gold" />}
              </Link>
            )
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {CLERK_ACTIVE_CLIENT ? (
            <NavAuth />
          ) : (
            <span className="rounded-sm border border-cream-400/15 px-3 py-1 text-[10px] uppercase tracking-widest text-cream-400/60">
              <User size={12} className="inline mr-1" /> Ingreso · próximamente
            </span>
          )}
        </div>

        <button
          className="md:hidden text-cream-100"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menú"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-cream-400/10 bg-ink-900/95 backdrop-blur">
          <div className="container-page flex flex-col gap-4 py-6">
            {links.map((l) => {
              const active = pathname === l.to
              return (
                <Link
                  key={l.to}
                  href={l.to}
                  onClick={() => setOpen(false)}
                  className={cn('text-sm uppercase tracking-[0.22em]', active ? 'text-gold' : 'text-cream-200/80')}
                >
                  {l.label}
                </Link>
              )
            })}
            {CLERK_ACTIVE_CLIENT && (
              <div className="pt-2" onClick={() => setOpen(false)}>
                <NavAuth />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
