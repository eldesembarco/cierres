// components/dashboard/branch-ranking-panel.tsx
import type { BranchRanking } from "@/types/reviews";
import { Panel, PanelHead } from "./panel";

interface BranchRankingPanelProps {
  branches: BranchRanking[];
}

export function BranchRankingPanel({ branches }: BranchRankingPanelProps) {
  return (
    <Panel>
      <PanelHead title="Mejores locales (semana)" ornament="⚓" />
      <div>
        {branches.map((b, idx) => {
          const isTop = b.position <= 3;
          return (
            <div
              key={b.name}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3"
              style={{
                borderBottom:
                  idx === branches.length - 1
                    ? "none"
                    : "1px dashed var(--color-paper-dark)",
              }}
            >
              <div
                className="w-6 font-[family-name:var(--font-display)] text-lg font-black"
                style={{
                  color: isTop ? "var(--color-gold)" : "var(--color-wood-light)",
                }}
              >
                {b.position}
              </div>
              <div>
                <div className="text-[13px] font-medium" style={{ color: "var(--color-ink)" }}>
                  {b.name}
                </div>
                <div
                  className="relative mt-1 h-[6px] overflow-hidden"
                  style={{ background: "var(--color-paper)" }}
                >
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${b.percent}%`,
                      background:
                        "linear-gradient(90deg, var(--color-ember), var(--color-gold))",
                    }}
                  />
                </div>
              </div>
              <div
                className="font-[family-name:var(--font-mono)] text-sm font-bold"
                style={{ color: "var(--color-ink)" }}
              >
                {b.score.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
