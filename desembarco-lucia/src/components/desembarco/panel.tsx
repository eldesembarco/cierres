// components/desembarco/panel.tsx
import type { ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Si es true, agrega hover sombra (para cards interactivas tipo links) */
  interactive?: boolean;
}

export function Panel({ children, className = '', interactive = false }: PanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-[2px] border transition-shadow duration-200 ${
        interactive ? 'hover:shadow-[0_4px_14px_rgba(45,24,16,0.10)]' : ''
      } ${className}`}
      style={{
        background: 'var(--color-bone)',
        borderColor: 'var(--color-paper-dark)',
      }}
    >
      {children}
    </section>
  );
}

export function PanelHead({
  title,
  ornament,
  actions,
}: {
  title: string;
  ornament?: string;
  actions?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6 sm:py-5"
      style={{
        borderColor: 'var(--color-paper-dark)',
        background:
          'linear-gradient(180deg, var(--color-bone) 0%, var(--color-paper) 100%)',
      }}
    >
      <h2
        className="flex items-center gap-[10px] font-[family-name:var(--font-display)] text-base font-bold tracking-[0.04em] sm:text-lg"
        style={{ color: 'var(--color-wood)' }}
      >
        {ornament && (
          <span
            style={{ color: 'var(--color-gold)', fontSize: 14 }}
            aria-hidden
          >
            {ornament}
          </span>
        )}
        {title}
      </h2>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ children, active, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="cursor-pointer border px-[10px] py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] transition-colors duration-150"
      style={{
        borderColor: 'var(--color-wood)',
        background: active ? 'var(--color-wood)' : 'transparent',
        color: active ? 'var(--color-bone)' : 'var(--color-wood)',
      }}
    >
      {children}
    </button>
  );
}
