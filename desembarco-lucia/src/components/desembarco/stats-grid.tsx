// components/dashboard/stats-grid.tsx
import type { StatCard, Tone } from "@/types/reviews";

const toneAccent: Record<Tone, string> = {
  ember: "var(--color-ember)",
  moss: "var(--color-moss)",
  gold: "var(--color-gold)",
  wood: "var(--color-wood)",
};

export function StatsGrid({ stats }: { stats: StatCard[] }) {
  return (
    <section className="relative z-[1] mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-8 pt-8 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <article
          key={stat.label}
          className="fade-up relative overflow-hidden rounded-[2px] border p-6"
          style={{
            background: "var(--color-bone)",
            borderColor: "var(--color-paper-dark)",
            animationDelay: `${0.05 + i * 0.05}s`,
          }}
        >
          <span
            className="absolute left-0 top-0 h-full w-1"
            style={{ background: toneAccent[stat.tone] }}
          />

          <div
            className="mb-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--color-wood-light)" }}
          >
            {stat.label}
          </div>

          <div
            className="mb-[6px] font-[family-name:var(--font-display)] text-[38px] font-bold leading-none"
            style={{ color: "var(--color-ink)" }}
          >
            {stat.value}
            {stat.unit && (
              <span
                className="ml-1 font-[family-name:var(--font-sans)] text-base font-normal"
                style={{ color: "var(--color-wood-light)" }}
              >
                {stat.unit}
              </span>
            )}
          </div>

          {stat.delta && (
            <div
              className="font-[family-name:var(--font-mono)] text-[11px]"
              style={{
                color:
                  stat.deltaDirection === "down"
                    ? "var(--color-ember-dark)"
                    : "var(--color-moss-dark)",
              }}
            >
              ▲ {stat.delta}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
