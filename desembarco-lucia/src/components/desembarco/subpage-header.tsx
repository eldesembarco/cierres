'use client';
// components/desembarco/subpage-header.tsx
// Mini-header para sub-rutas (/inbox, /reviews, /admin/*) cuando NO usan
// el Topbar completo del home. Mantiene el theme "Bitácora" y permite navegar.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Panel' },
  { href: '/dashboard/inbox', label: 'Inbox CM' },
  { href: '/dashboard/inbox-meta', label: 'Meta' },
  { href: '/dashboard/reviews', label: 'Reseñas' },
  { href: '/dashboard/metricas', label: 'Métricas' },
  { href: '/dashboard/admin', label: 'Admin' },
];

export function SubpageHeader() {
  const pathname = usePathname();
  return (
    <header
      className="relative z-10 border-b-4 border-double text-[var(--color-bone)]"
      style={{
        background: 'var(--color-wood)',
        borderColor: 'var(--color-gold)',
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-8 py-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-full border-2 font-[family-name:var(--font-display)] text-base font-black"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, var(--color-gold-light), var(--color-gold) 50%, var(--color-ember-dark))',
              borderColor: 'var(--color-gold)',
              color: 'var(--color-ink)',
              boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 0 8px rgba(0,0,0,0.3)',
            }}
          >
            D
          </div>
          <div className="leading-[1.1]">
            <div
              className="font-[family-name:var(--font-display)] text-base font-bold tracking-[0.08em]"
              style={{ color: 'var(--color-gold-light)' }}
            >
              EL DESEMBARCO
            </div>
            <div
              className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] opacity-70"
              style={{ color: 'var(--color-paper-dark)' }}
            >
              Panel · v1.0
            </div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="border px-3 py-1.5 transition-all"
                style={{
                  borderColor: isActive ? 'var(--color-gold)' : 'transparent',
                  background: isActive ? 'var(--color-wood-light)' : 'transparent',
                  color: isActive ? 'var(--color-gold-light)' : 'var(--color-paper-dark)',
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <LogoutButton variant="subheader" />
        </nav>
      </div>
    </header>
  );
}
