// components/dashboard/topbar.tsx
import { LogoutButton } from './logout-button';

interface TopbarProps {
  operator: string;
  lastSync: string;
  totalLocations: number;
}

export function Topbar({ operator, lastSync, totalLocations }: TopbarProps) {
  return (
    <header
      className="relative z-10 border-b-4 border-double text-[var(--color-bone)]"
      style={{
        background: "var(--color-wood)",
        borderColor: "var(--color-gold)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-8 py-[18px]">
        <div className="flex items-center gap-[14px]">
          <div
            className="grid h-11 w-11 place-items-center rounded-full border-2 font-[family-name:var(--font-display)] text-xl font-black"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, var(--color-gold-light), var(--color-gold) 50%, var(--color-ember-dark))",
              borderColor: "var(--color-gold)",
              color: "var(--color-ink)",
              boxShadow: "0 2px 0 rgba(0,0,0,0.4), inset 0 0 8px rgba(0,0,0,0.3)",
            }}
          >
            D
          </div>
          <div className="leading-[1.1]">
            <div
              className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.08em]"
              style={{ color: "var(--color-gold-light)" }}
            >
              EL DESEMBARCO
            </div>
            <div
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em] opacity-70"
              style={{ color: "var(--color-paper-dark)" }}
            >
              Panel de reseñas · v1.0
            </div>
          </div>
        </div>

        <div
          className="hidden items-center gap-6 font-[family-name:var(--font-mono)] text-xs sm:flex"
          style={{ color: "var(--color-paper-dark)" }}
        >
          <div className="flex items-center gap-[6px]">
            <span
              className="pulse-dot inline-block h-2 w-2 rounded-full"
              style={{
                background: "var(--color-moss)",
                boxShadow: "0 0 8px var(--color-moss)",
              }}
            />
            SINCRONIZADO {lastSync.toUpperCase()}
          </div>
          <div>{totalLocations} LOCALES</div>
          <div>{operator}</div>
          <LogoutButton variant="topbar" />
        </div>
      </div>
    </header>
  );
}
