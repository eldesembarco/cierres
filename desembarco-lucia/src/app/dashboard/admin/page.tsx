import Link from 'next/link';
import { Panel } from '@/components/desembarco/panel';
import { PageHero } from '@/components/desembarco/page-hero';

const ITEMS = [
  {
    href: '/dashboard/admin/locales',
    label: 'Locales',
    desc: 'Vista del maestro de fichas (read-only). Verificá place_id y location_name.',
    ornament: '◆',
  },
  {
    href: '/dashboard/admin/tonos',
    label: 'Tonos por marca',
    desc: 'Voice y ejemplos que la IA usa al generar borradores. Editable por marca.',
    ornament: '✦',
  },
  {
    href: '/dashboard/admin/logs',
    label: 'Logs IA',
    desc: 'Auditoría de borradores generados, qué proveedor y qué editó el CM.',
    ornament: '◇',
  },
  {
    href: '/dashboard/admin/meta',
    label: 'Cuentas Meta',
    desc: 'Conectar Páginas FB + Instagram Business. Refresh de tokens. Estado.',
    ornament: '✦',
  },
  {
    href: '/api/health',
    label: 'Health check',
    desc: 'Estado de DB, Sheet, providers IA y env vars (JSON).',
    ornament: '●',
    external: true,
  },
];

export default function AdminPage() {
  return (
    <>
      <PageHero
        eyebrow="Admin · Configuración"
        title="Configuración"
        description="Configuración interna del panel. Tonos por marca, auditoría de IA y diagnóstico de conexiones."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map((it, i) => {
          const content = (
            <Panel interactive className="h-full fade-up" >
              <div
                className="flex h-full flex-col px-6 py-5"
                style={{ animationDelay: `${0.05 + i * 0.04}s` }}
              >
                <div
                  className="mb-3 font-[family-name:var(--font-display)] text-3xl"
                  style={{ color: 'var(--color-gold)' }}
                  aria-hidden
                >
                  {it.ornament}
                </div>
                <h2
                  className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.04em]"
                  style={{ color: 'var(--color-wood)' }}
                >
                  {it.label}
                </h2>
                <p
                  className="mt-2 flex-1 text-sm"
                  style={{ color: 'var(--color-wood-light)' }}
                >
                  {it.desc}
                </p>
                <div
                  className="mt-4 flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]"
                  style={{ color: 'var(--color-ember-dark)' }}
                >
                  Abrir <span aria-hidden>→</span>
                </div>
              </div>
            </Panel>
          );
          return it.external ? (
            <a
              key={it.href}
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {content}
            </a>
          ) : (
            <Link key={it.href} href={it.href} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </>
  );
}
