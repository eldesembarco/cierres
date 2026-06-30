// components/dashboard/reviews-panel.tsx
"use client";

import { useState } from "react";
import type { Review, ReviewStatus } from "@/types/reviews";
import { Panel, PanelHead, Chip } from "./panel";

interface ReviewsPanelProps {
  reviews: Review[];
}

type Filter = "all" | "auto" | "escalated";

const statusBadge: Record<ReviewStatus, { label: string; bg: string; color: string }> = {
  auto: { label: "Auto", bg: "var(--color-moss)", color: "var(--color-bone)" },
  escalated: { label: "CM", bg: "var(--color-ember)", color: "var(--color-bone)" },
  pending: { label: "Pend.", bg: "var(--color-gold)", color: "var(--color-ink)" },
};

const avatarBg: Record<ReviewStatus, string> = {
  auto: "var(--color-moss)",
  escalated: "var(--color-ember)",
  pending: "var(--color-wood)",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="text-sm tracking-[1px]"
      style={{ color: "var(--color-gold)" }}
    >
      {"★".repeat(rating)}
      <span style={{ color: "var(--color-paper-dark)" }}>
        {"★".repeat(5 - rating)}
      </span>
    </span>
  );
}

export function ReviewsPanel({ reviews }: ReviewsPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = reviews.filter((r) => {
    if (filter === "all") return true;
    if (filter === "auto") return r.status === "auto";
    if (filter === "escalated") return r.status === "escalated";
    return true;
  });

  return (
    <Panel>
      <PanelHead
        title="Mensajes de la tripulación"
        ornament="❦"
        actions={
          <>
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todas</Chip>
            <Chip active={filter === "auto"} onClick={() => setFilter("auto")}>Auto</Chip>
            <Chip active={filter === "escalated"} onClick={() => setFilter("escalated")}>CM</Chip>
          </>
        }
      />

      <div>
        {filtered.map((review, idx) => {
          const isLast = idx === filtered.length - 1;
          const badge = statusBadge[review.status];
          const isEscalated = review.status === "escalated";

          return (
            <article
              key={review.id}
              className="grid grid-cols-[auto_1fr_auto] items-start gap-4 px-6 py-[22px]"
              style={{
                borderBottom: isLast ? "none" : "1px dashed var(--color-paper-dark)",
              }}
            >
              <div
                className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-base font-bold"
                style={{ background: avatarBg[review.status], color: "var(--color-bone)" }}
              >
                {review.authorInitial}
              </div>

              <div className="min-w-0">
                <div className="mb-[6px] flex flex-wrap items-center gap-[10px] text-[13px]">
                  <span className="font-bold" style={{ color: "var(--color-ink)" }}>
                    {review.authorName}
                  </span>
                  <Stars rating={review.rating} />
                  <span
                    className="rounded-[2px] px-[6px] py-px font-[family-name:var(--font-mono)] text-[11px]"
                    style={{
                      color: "var(--color-wood-light)",
                      background: "var(--color-paper)",
                    }}
                  >
                    {review.branch}
                  </span>
                  <span
                    className="ml-auto font-[family-name:var(--font-mono)] text-[11px]"
                    style={{ color: "var(--color-wood-light)" }}
                  >
                    {review.relativeTime}
                  </span>
                </div>

                <p
                  className="mb-3 text-sm leading-[1.55]"
                  style={{ color: "var(--color-ink)" }}
                >
                  {review.text}
                </p>

                {review.reply && (
                  <div
                    className="border-l-[3px] px-[14px] py-[10px] text-[13px] italic"
                    style={{
                      background: "var(--color-paper)",
                      borderColor: "var(--color-moss)",
                      color: "var(--color-wood)",
                    }}
                  >
                    <div
                      className="mb-1 font-[family-name:var(--font-mono)] text-[10px] not-italic uppercase tracking-[0.15em]"
                      style={{ color: "var(--color-moss-dark)" }}
                    >
                      ⚓ Respuesta automática
                    </div>
                    {review.reply}
                  </div>
                )}

                {isEscalated && review.escalation && (
                  <div
                    className="border-l-[3px] px-[14px] py-[10px] text-[13px]"
                    style={{
                      background: "rgba(200, 51, 30, 0.08)",
                      borderColor: "var(--color-ember)",
                      color: "var(--color-wood)",
                    }}
                  >
                    <div
                      className="mb-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
                      style={{ color: "var(--color-ember-dark)" }}
                    >
                      ⚠ Reportado al Capitán (CM)
                    </div>
                    <div className="italic">Pendiente de respuesta del Community Manager.</div>
                    <div
                      className="mt-[6px] font-[family-name:var(--font-mono)] text-[11px]"
                      style={{ color: "var(--color-ember-dark)" }}
                    >
                      → Asignado a: {review.escalation.assignedTo} · SLA:{" "}
                      {review.escalation.slaHoursLeft} horas restantes
                      {review.escalation.priority === "alta" && " · PRIORIDAD ALTA"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-[6px]">
                <span
                  className="rounded-[2px] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
