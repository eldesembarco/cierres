// components/dashboard/panel.tsx
import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`overflow-hidden rounded-[2px] border ${className}`}
      style={{
        background: "var(--color-bone)",
        borderColor: "var(--color-paper-dark)",
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
      className="flex items-center justify-between border-b px-6 py-5"
      style={{
        borderColor: "var(--color-paper-dark)",
        background:
          "linear-gradient(180deg, var(--color-bone) 0%, var(--color-paper) 100%)",
      }}
    >
      <h2
        className="flex items-center gap-[10px] font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.04em]"
        style={{ color: "var(--color-wood)" }}
      >
        {ornament && <span style={{ color: "var(--color-gold)", fontSize: 14 }}>{ornament}</span>}
        {title}
      </h2>
      {actions && <div className="flex gap-2">{actions}</div>}
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
      className="cursor-pointer border px-[10px] py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] transition-all duration-150"
      style={{
        borderColor: "var(--color-wood)",
        background: active ? "var(--color-wood)" : "transparent",
        color: active ? "var(--color-bone)" : "var(--color-wood)",
      }}
    >
      {children}
    </button>
  );
}
