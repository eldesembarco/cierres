'use client';

import { useMemo, useState } from 'react';
import { ReviewCard } from './DraftPanel';
import { AutoReplyBatch } from './AutoReplyBatch';
import { Panel, Chip } from '@/components/desembarco/panel';
import { PageHero, EmptyState } from '@/components/desembarco/page-hero';

interface ReviewItem {
  reviewId: string;
  reviewName: string;
  placeId: string;
  brand: string;
  localName: string;
  rating: number;
  reviewText: string;
  reviewerName: string;
  reviewDate: string;
  imagenes?: string[];
}

type RatingFilter = 'all' | 'low' | '1' | '2' | '3' | '4' | '5';

// Heurística client-side: 5★ con texto y sin red flags textuales
const NEGATIVE_KEYWORDS = [
  'crudo', 'quemado', 'frío', 'frio', 'horrible', 'pésimo', 'pesimo',
  'maltrato', 'demora', 'alergia', 'sucio', 'pelo', 'cucaracha',
  'vergüenza', 'verguenza', 'no recomiendo', 'jamás', 'jamas',
  'malísimo', 'malisimo', 'asco', 'lento', 'caro', 'estafa',
];

function isAutoReplyCandidate(r: ReviewItem): boolean {
  if (r.rating !== 5) return false;
  if (!r.reviewText || r.reviewText.length < 8) return false;
  const lower = r.reviewText.toLowerCase();
  return !NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function InboxClient({ reviews }: { reviews: ReviewItem[] }) {
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [localFilter, setLocalFilter] = useState<string>('all');
  const [urgentFirst, setUrgentFirst] = useState(false);

  const locales = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.localName))).sort(),
    [reviews]
  );

  // Sort: por default cronológico (más recientes arriba). Toggle "urgentes primero"
  // pone las 1-2★ en la cima.
  const sorted = useMemo(() => {
    if (!urgentFirst) {
      return [...reviews].sort((a, b) =>
        (b.reviewDate || '').localeCompare(a.reviewDate || '')
      );
    }
    const score = (r: ReviewItem) => {
      let s = 0;
      if (r.rating <= 2) s += 1000;
      else if (r.rating === 3) s += 500;
      else s += 100;
      return s;
    };
    return [...reviews].sort((a, b) => {
      const ds = score(b) - score(a);
      if (ds !== 0) return ds;
      return (b.reviewDate || '').localeCompare(a.reviewDate || '');
    });
  }, [reviews, urgentFirst]);

  const filtered = useMemo(() => {
    return sorted.filter((r) => {
      if (localFilter !== 'all' && r.localName !== localFilter) return false;
      if (ratingFilter === 'low') return r.rating > 0 && r.rating <= 2;
      if (ratingFilter !== 'all' && String(r.rating) !== ratingFilter) return false;
      return true;
    });
  }, [sorted, ratingFilter, localFilter]);

  const stats = useMemo(() => {
    const urgentes = reviews.filter((r) => r.rating > 0 && r.rating <= 2).length;
    const autoReplyCandidates = reviews.filter(isAutoReplyCandidate);
    return { total: reviews.length, urgentes, autoReplyCandidates };
  }, [reviews]);

  return (
    <div>
      <PageHero
        eyebrow="Inbox · Cola del CM"
        title="Reseñas pendientes"
        description={
          <>
            {stats.total.toLocaleString('es-AR')} reseñas con texto sin responder ·{' '}
            <span style={{ color: 'var(--color-ember)' }}>
              {stats.urgentes} urgentes (1-2★)
            </span>
            {stats.autoReplyCandidates.length > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--color-moss-dark)' }}>
                  {stats.autoReplyCandidates.length} elegibles para auto-respuesta
                </span>
              </>
            )}
          </>
        }
      />

      {/* Toolbar */}
      <Panel className="mb-6">
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
        >
          <Chip active={ratingFilter === 'all'} onClick={() => setRatingFilter('all')}>
            Todas
          </Chip>
          <Chip
            active={ratingFilter === 'low'}
            onClick={() => setRatingFilter('low')}
          >
            ⚠ Urgentes
          </Chip>
          <Chip active={ratingFilter === '3'} onClick={() => setRatingFilter('3')}>
            3★
          </Chip>
          <Chip active={ratingFilter === '4'} onClick={() => setRatingFilter('4')}>
            4★
          </Chip>
          <Chip active={ratingFilter === '5'} onClick={() => setRatingFilter('5')}>
            5★
          </Chip>

          <span
            className="mx-2 h-5 w-px"
            style={{ background: 'var(--color-paper-dark)' }}
          />

          <select
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value)}
            className="border px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
            style={{
              borderColor: 'var(--color-wood)',
              color: 'var(--color-wood)',
              background: 'var(--color-bone)',
            }}
          >
            <option value="all">Todos los locales</option>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
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

          <span
            className="ml-auto"
            style={{ color: 'var(--color-wood-light)' }}
          >
            {filtered.length} de {reviews.length}
          </span>

          <AutoReplyBatch candidates={stats.autoReplyCandidates} />
        </div>
      </Panel>

      {/* Lista */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              title="Sin reseñas con esos filtros"
              description="Probá cambiando filtro de rating o local."
            />
          </Panel>
        ) : (
          filtered.map((r) => <ReviewCard key={r.reviewId} review={r} />)
        )}
      </div>
    </div>
  );
}
