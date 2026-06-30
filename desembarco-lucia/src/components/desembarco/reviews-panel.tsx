// components/desembarco/reviews-panel.tsx
"use client";

import { useMemo, useState } from "react";
import type { Review, ReviewStatus } from "@/types/reviews";
import { Panel, PanelHead, Chip } from "./panel";

interface ReviewsPanelProps {
  reviews: Review[];
}

type StatusFilter = "all" | "auto" | "escalated";
type RatingFilter = "all" | "positive" | "negative" | "5" | "4" | "3" | "2" | "1";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const branches = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.branch))).sort(),
    [reviews]
  );

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (branchFilter !== "all" && r.branch !== branchFilter) return false;
      if (ratingFilter !== "all") {
        if (ratingFilter === "positive") return r.rating >= 4;
        if (ratingFilter === "negative") return r.rating <= 2;
        if (String(r.rating) !== ratingFilter) return false;
      }
      return true;
    });
  }, [reviews, statusFilter, branchFilter, ratingFilter]);

  return (
    <Panel>
      <PanelHead
        title="Reseñas recientes"
        ornament="◆"
        actions={
          <span
            className="font-[family-name:var(--font-mono)] text-[11px]"
            style={{ color: "var(--color-wood-light)" }}
          >
            {filtered.length} de {reviews.length}
          </span>
        }
      />

      {/* Toolbar de filtros */}
      <div
        className="flex flex-wrap items-center gap-2 border-b px-5 py-3 sm:px-6"
        style={{
          borderColor: "var(--color-paper-dark)",
          background: "var(--color-paper)",
        }}
      >
        <Chip active={ratingFilter === "all"} onClick={() => setRatingFilter("all")}>
          Todas
        </Chip>
        <Chip
          active={ratingFilter === "positive"}
          onClick={() => setRatingFilter("positive")}
        >
          ★ Positivas (4-5)
        </Chip>
        <Chip
          active={ratingFilter === "negative"}
          onClick={() => setRatingFilter("negative")}
        >
          ⚠ Críticas (1-2)
        </Chip>

        <span
          className="mx-1 h-5 w-px"
          style={{ background: "var(--color-paper-dark)" }}
        />

        <Chip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
          Cualquier estado
        </Chip>
        <Chip active={statusFilter === "auto"} onClick={() => setStatusFilter("auto")}>
          Auto
        </Chip>
        <Chip
          active={statusFilter === "escalated"}
          onClick={() => setStatusFilter("escalated")}
        >
          A CM
        </Chip>

        <span
          className="mx-1 h-5 w-px"
          style={{ background: "var(--color-paper-dark)" }}
        />

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
          style={{
            borderColor: "var(--color-wood)",
            color: "var(--color-wood)",
            background: "var(--color-bone)",
          }}
        >
          <option value="all">Todos los locales</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div>
        {filtered.length === 0 && (
          <div
            className="px-6 py-12 text-center text-sm"
            style={{ color: "var(--color-wood-light)" }}
          >
            Sin reseñas con esos filtros.
          </div>
        )}
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
                      ◆ Respuesta automática
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
                      ⚠ Escalada al CM
                    </div>
                    <div className="italic">Pendiente de respuesta del Community Manager.</div>
                    <div
                      className="mt-[6px] font-[family-name:var(--font-mono)] text-[11px]"
                      style={{ color: "var(--color-ember-dark)" }}
                    >
                      → Asignada a: {review.escalation.assignedTo} · SLA:{" "}
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
