// components/dashboard/cm-queue-panel.tsx
import type { CmQueueItem } from "@/types/reviews";
import { Panel, PanelHead, Chip } from "./panel";

interface CmQueuePanelProps {
  items: CmQueueItem[];
}

export function CmQueuePanel({ items }: CmQueuePanelProps) {
  return (
    <Panel>
      <PanelHead title="Cola del CM" ornament="⚠" actions={<Chip>Ver todas</Chip>} />
      <div>
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-5 py-[14px]"
            style={{
              borderBottom:
                idx === items.length - 1
                  ? "none"
                  : "1px dashed var(--color-paper-dark)",
            }}
          >
            <div
              className="w-7 text-center font-[family-name:var(--font-display)] text-[22px] font-black"
              style={{ color: "var(--color-ember)" }}
            >
              {String(item.position).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold" style={{ color: "var(--color-ink)" }}>
                {item.authorName}
              </div>
              <div
                className="font-[family-name:var(--font-mono)] text-[11px]"
                style={{ color: "var(--color-wood-light)" }}
              >
                {item.branch} · {"★".repeat(item.rating)}
              </div>
              <div
                className="mt-1 truncate text-xs italic"
                style={{ color: "var(--color-wood-light)" }}
              >
                &ldquo;{item.preview}&rdquo;
              </div>
            </div>
            <div
              className="text-right font-[family-name:var(--font-mono)] text-[10px]"
              style={{ color: "var(--color-ember-dark)" }}
            >
              {item.slaHoursLeft}h SLA
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
