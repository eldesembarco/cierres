'use client';

import { useMemo, useState } from 'react';
import { ReviewCard } from '@/app/dashboard/inbox/DraftPanel';
import { AutoReplyBatch } from '@/app/dashboard/inbox/AutoReplyBatch';
import { Panel, PanelHead, Chip } from './panel';
import type { InboxReviewItem } from '@/lib/desembarco-adapters';

type RatingFilter = 'all' | 'positive' | 'negative' | '5' | '4' | '3' | '2' | '1';
type StatusFilter = 'all' | 'pending' | 'replied';

const NEGATIVE_KEYWORDS = [
  'crudo', 'quemado', 'frío', 'frio', 'horrible', 'pésimo', 'pesimo',
  'maltrato', 'demora', 'alergia', 'sucio', 'pelo', 'cucaracha',
  'vergüenza', 'verguenza', 'no recomiendo', 'jamás', 'jamas',
  'malísimo', 'malisimo', 'asco', 'lento', 'caro', 'estafa',
];

function isAutoReplyCandidate(r: InboxReviewItem): boolean {
  if (r.respondida) return false;
  if (r.rating !== 5) return false;
  if (!r.reviewText || r.reviewText.length < 8) return false;
  const lower = r.reviewText.toLowerCase();
  return !NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

function fmtRelative(date: string): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date.slice(0, 10);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} sem`;
  return d.toLocaleDateString('es-AR');
}

export function DashboardReviewsPanel({ items }: { items: InboxReviewItem[] }) {
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [urgentFirst, setUrgentFirst] = useState(false);

  const branches = useMemo(
    () => Array.from(new Set(items.map((i) => i.localName))).sort(),
    [items]
  );

  const sorted = useMemo(() => {
    if (!urgentFirst) {
      return [...items].sort((a, b) =>
        (b.reviewDate || '').localeCompare(a.reviewDate || '')
      );
    }
    const score = (r: InboxReviewItem) => {
      let s = 0;
      if (!r.respondida && r.rating <= 2) s += 1000;
      else if (!r.respondida && r.rating === 3) s += 500;
      else s += 100;
      return s;
    };
    return [...items].sort((a, b) => {
      const ds = score(b) - score(a);
      if (ds !== 0) return ds;
      return (b.reviewDate || '').localeCompare(a.reviewDate || '');
    });
  }, [items, urgentFirst]);

  const filtered = useMemo(() => {
    return sorted.filter((r) => {
      if (statusFilter === 'pending' && r.respondida) return false;
      if (statusFilter === 'replied' && !r.respondida) return false;
      if (branchFilter !== 'all' && r.localName !== branchFilter) return false;
      if (ratingFilter !== 'all') {
        if (ratingFilter === 'positive') return r.rating >= 4;
        if (ratingFilter === 'negative') return r.rating <= 2 && r.rating > 0;
        if (String(r.rating) !== ratingFilter) return false;
      }
      return true;
    });
  }, [sorted, statusFilter, branchFilter, ratingFilter]);

  const autoReplyCandidates = useMemo(
    () => items.filter(isAutoReplyCandidate),
    [items]
  );

  return (
    <Panel>
      <PanelHead
        title="Reseñas recientes"
        ornament="◆"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-[family-name:var(--font-mono)] text-[11px]"
              style={{ color: 'var(--color-wood-light)' }}
            >
              {filtered.length} de {items.length}
            </span>
            <AutoReplyBatch candidates={autoReplyCandidates} />
          </div>
        }
      />

      {/* Toolbar de filtros */}
      <div
        className="flex flex-wrap items-center gap-2 border-b px-5 py-3 sm:px-6"
        style={{
          borderColor: 'var(--color-paper-dark)',
          background: 'var(--color-paper)',
        }}
      >
        <Chip active={ratingFilter === 'all'} onClick={() => setRatingFilter('all')}>
          Todas
        </Chip>
        <Chip
          active={ratingFilter === 'positive'}
          onClick={() => setRatingFilter('positive')}
        >
          ★ Positivas
        </Chip>
        <Chip
          active={ratingFilter === 'negative'}
          onClick={() => setRatingFilter('negative')}
        >
          ⚠ Críticas
        </Chip>

        <span
          className="mx-1 h-5 w-px"
          style={{ background: 'var(--color-paper-dark)' }}
        />

        <Chip
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        >
          Cualquier estado
        </Chip>
        <Chip
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter('pending')}
        >
          Pendientes
        </Chip>
        <Chip
          active={statusFilter === 'replied'}
          onClick={() => setStatusFilter('replied')}
        >
          Respondidas
        </Chip>

        <span
          className="mx-1 h-5 w-px"
          style={{ background: 'var(--color-paper-dark)' }}
        />

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="border px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
          style={{
            borderColor: 'var(--color-wood)',
            color: 'var(--color-wood)',
            background: 'var(--color-bone)',
          }}
        >
          <option value="all">Todos los locales</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <label
          className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
          style={{ color: 'var(--color-wood)' }}
        >
          <input
            type="checkbox"
            checked={urgentFirst}
            onChange={(e) => setUrgentFirst(e.target.checked)}
            className="accent-[var(--color-ember)]"
          />
          Urgentes primero
        </label>
      </div>

      {/* Lista */}
      <div className="space-y-3 p-4">
        {filtered.length === 0 && (
          <div
            className="px-6 py-12 text-center text-sm"
            style={{ color: 'var(--color-wood-light)' }}
          >
            Sin reseñas con esos filtros.
          </div>
        )}
        {filtered.map((r) => {
          if (r.respondida) {
            // Respondida: card sobrio con la respuesta visible (sin flow IA)
            return (
              <article
                key={r.reviewId}
                className="overflow-hidden rounded-[2px] border"
                style={{
                  background: 'var(--color-bone)',
                  borderColor: 'var(--color-paper-dark)',
                }}
              >
                <div className="px-5 py-4 sm:px-6">
                  <header className="grid grid-cols-[auto_1fr_auto] items-start gap-3 text-[13px]">
                    <div
                      className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-sm font-bold"
                      style={{
                        background: 'var(--color-moss)',
                        color: 'var(--color-bone)',
                      }}
                    >
                      {(r.reviewerName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="font-bold"
                          style={{ color: 'var(--color-ink)' }}
                        >
                          {r.reviewerName || 'Anónimo'}
                        </span>
                        <span style={{ color: 'var(--color-gold)' }}>
                          {'★'.repeat(r.rating)}
                          <span style={{ color: 'var(--color-paper-dark)' }}>
                            {'★'.repeat(5 - r.rating)}
                          </span>
                        </span>
                        <span
                          className="rounded-[2px] px-[6px] py-px font-[family-name:var(--font-mono)] text-[10px]"
                          style={{
                            color: 'var(--color-wood-light)',
                            background: 'var(--color-paper)',
                          }}
                        >
                          {r.localName}
                        </span>
                      </div>
                      <span
                        className="font-[family-name:var(--font-mono)] text-[11px]"
                        style={{ color: 'var(--color-wood-light)' }}
                      >
                        {fmtRelative(r.reviewDate)}
                      </span>
                    </div>
                    <span
                      className="rounded-[2px] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                      style={{
                        background: 'var(--color-moss)',
                        color: 'var(--color-bone)',
                      }}
                    >
                      Respondida
                    </span>
                  </header>

                  <p
                    className="mt-3 text-sm"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {r.reviewText}
                  </p>

                  {r.respuesta && (
                    <div
                      className="mt-3 border-l-[3px] px-[14px] py-[10px] text-[13px] italic"
                      style={{
                        background: 'var(--color-paper)',
                        borderColor: 'var(--color-moss)',
                        color: 'var(--color-wood)',
                      }}
                    >
                      <div
                        className="mb-1 font-[family-name:var(--font-mono)] text-[10px] not-italic uppercase tracking-[0.15em]"
                        style={{ color: 'var(--color-moss-dark)' }}
                      >
                        ◆ Tu respuesta
                        {r.respuestaFecha && ` · ${fmtRelative(r.respuestaFecha)}`}
                      </div>
                      {r.respuesta}
                    </div>
                  )}
                </div>
              </article>
            );
          }
          // Pendiente: flow IA completo
          return <ReviewCard key={r.reviewId} review={r} />;
        })}
      </div>
    </Panel>
  );
}
