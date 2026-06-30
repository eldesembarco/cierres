// components/desembarco/page-hero.tsx
// Hero compartido para sub-páginas: eyebrow uppercase + título display + subtítulo.

import type { ReactNode } from 'react';

interface PageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  /** Acciones a la derecha (botones, links, etc.) */
  actions?: ReactNode;
  /** Breadcrumb opcional encima del eyebrow (ej. "Admin / Locales") */
  breadcrumb?: { label: string; href?: string }[];
}

export function PageHero({ eyebrow, title, description, actions, breadcrumb }: PageHeroProps) {
  return (
    <section className="fade-up mb-8">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav
          className="mb-3 flex flex-wrap items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-wood-light)' }}
          aria-label="Breadcrumb"
        >
          {breadcrumb.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && <span style={{ color: 'var(--color-paper-dark)' }}>›</span>}
              {b.href ? (
                <a
                  href={b.href}
                  className="hover:underline"
                  style={{ color: 'var(--color-wood-light)' }}
                >
                  {b.label}
                </a>
              ) : (
                <span>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div
            className="mb-2 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em]"
            style={{ color: 'var(--color-ember-dark)' }}
          >
            <span>{eyebrow}</span>
            <span
              className="h-px flex-1"
              style={{
                background: 'linear-gradient(90deg, var(--color-ember-dark), transparent)',
              }}
            />
          </div>
          <h1
            className="font-[family-name:var(--font-display)] text-4xl font-black leading-none tracking-[-0.01em] sm:text-5xl"
            style={{ color: 'var(--color-wood)' }}
          >
            {title}
          </h1>
          {description && (
            <p
              className="mt-3 max-w-[640px] text-sm leading-[1.6]"
              style={{ color: 'var(--color-wood-light)' }}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

/**
 * Empty state genérico con ornamento dorado central.
 */
export function EmptyState({
  ornament = '❦',
  title,
  description,
  action,
}: {
  ornament?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="px-6 py-16 text-center"
      style={{ color: 'var(--color-wood-light)' }}
    >
      <div
        className="mb-4 font-[family-name:var(--font-display)] text-5xl"
        style={{ color: 'var(--color-gold)' }}
      >
        {ornament}
      </div>
      <p
        className="font-[family-name:var(--font-display)] text-lg font-bold"
        style={{ color: 'var(--color-wood)' }}
      >
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Stat card con accent vertical en el lado izquierdo.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'gold',
  delay = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'gold' | 'moss' | 'ember' | 'wood';
  delay?: number;
}) {
  const accent: Record<typeof tone, string> = {
    gold: 'var(--color-gold)',
    moss: 'var(--color-moss)',
    ember: 'var(--color-ember)',
    wood: 'var(--color-wood)',
  };
  return (
    <article
      className="fade-up relative overflow-hidden rounded-[2px] border p-6 transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
      style={{
        background: 'var(--color-bone)',
        borderColor: 'var(--color-paper-dark)',
        animationDelay: `${delay}s`,
      }}
    >
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: accent[tone] }}
      />
      <div
        className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em]"
        style={{ color: 'var(--color-wood-light)' }}
      >
        {label}
      </div>
      <div
        className="font-[family-name:var(--font-display)] text-[34px] font-bold leading-none"
        style={{ color: 'var(--color-ink)' }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="mt-2 font-[family-name:var(--font-mono)] text-[10px]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          {hint}
        </div>
      )}
    </article>
  );
}
