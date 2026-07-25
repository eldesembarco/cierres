import { NavLink, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

const links = [
  { to: '/archivo', label: 'El Archivo' },
  { to: '/episodios', label: 'Episodios' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/comunidad', label: 'Comunidad' },
  { to: '/contacto', label: 'Contacto' },
]

export function Nav() {
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
        <Link to="/" className="group flex items-center gap-3">
          <span className="font-serif text-2xl leading-none tracking-tight text-cream-50 md:text-3xl">
            {brand.name}
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.35em] text-gold/70 md:block">
            {brand.tagline}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'relative text-xs font-medium uppercase tracking-[0.22em] transition',
                  isActive ? 'text-cream-50' : 'text-cream-200/70 hover:text-cream-50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 h-px w-full bg-gold" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link to="/comunidad" className="btn-ghost">
            {brand.cta.subscribe}
          </Link>
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
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'text-sm uppercase tracking-[0.22em]',
                    isActive ? 'text-gold' : 'text-cream-200/80',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/comunidad" onClick={() => setOpen(false)} className="btn-ghost self-start">
              {brand.cta.subscribe}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
