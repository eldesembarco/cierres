'use client';

import { useMemo, useState } from 'react';
import type { ReviewRow } from '@/lib/sheets';
import { Panel, Chip } from '@/components/desembarco/panel';
import { PageHero, EmptyState } from '@/components/desembarco/page-hero';
import { PhotoStrip } from '@/components/PhotoStrip';

type Filter = 'all' | 'pendientes' | 'respondidas';
type RatingFilter = 'all' | '1' | '2' | '3' | '4' | '5';

function Stars({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <span
      className="text-[13px] tracking-[1px]"
      style={{ color: 'var(--color-gold)' }}
    >
      {'★'.repeat(rating)}
      <span style={{ color: 'var(--color-paper-dark)' }}>
        {'★'.repeat(5 - rating)}
      </span>
    </span>
  );
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

export function ReviewsTable({ reviews }: { reviews: ReviewRow[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Filter>('all');
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [localFilter, setLocalFilter] = useState<string>('all');

  const locales = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.local))).sort(),
    [reviews]
  );

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter === 'pendientes' && r.respondida) return false;
      if (statusFilter === 'respondidas' && !r.respondida) return false;
      if (ratingFilter !== 'all' && String(r.rating) !== ratingFilter) return false;
      if (localFilter !== 'all' && r.local !== localFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = `${r.autor} ${r.texto} ${r.respuesta}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [reviews, statusFilter, ratingFilter, localFilter, search]);

  return (
    <div>
      <PageHero
        eyebrow="Panel · Reseñas"
        title="Histórico de reseñas"
        description={`Filtrá por estado, rating, local o texto. ${reviews.length.toLocaleString('es-AR')} reseñas en total.`}
      />

      {/* Toolbar */}
      <Panel className="mb-6">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar texto o autor…"
            className="border px-2 py-1 text-xs"
            style={{
              borderColor: 'var(--color-wood)',
              color: 'var(--color-ink)',
              background: 'var(--color-bone)',
              fontFamily: 'var(--font-sans)',
              minWidth: 200,
            }}
          />

          <span className="mx-1 h-5 w-px" style={{ background: 'var(--color-paper-dark)' }} />

          <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            Todas
          </Chip>
          <Chip
            active={statusFilter === 'pendientes'}
            onClick={() => setStatusFilter('pendientes')}
          >
            Pendientes
          </Chip>
          <Chip
            active={statusFilter === 'respondidas'}
            onClick={() => setStatusFilter('respondidas')}
          >
            Respondidas
          </Chip>

          <span className="mx-1 h-5 w-px" style={{ background: 'var(--color-paper-dark)' }} />

          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value as RatingFilter)}
            className="border px-2 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
            style={{
              borderColor: 'var(--color-wood)',
              color: 'var(--color-wood)',
              background: 'var(--color-bone)',
            }}
          >
            <option value="all">Todos los ratings</option>
            <option value="5">5 estrellas</option>
            <option value="4">4 estrellas</option>
            <option value="3">3 estrellas</option>
            <option value="2">2 estrellas</option>
            <option value="1">1 estrella</option>
          </select>

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

          <span
            className="ml-auto font-[family-name:var(--font-mono)] text-[11px]"
            style={{ color: 'var(--color-wood-light)' }}
          >
            {filtered.length} de {reviews.length}
          </span>
        </div>
      </Panel>

      {/* Lista */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Panel>
            <EmptyState
              title="Sin resultados"
              description="Probá ajustando los filtros o limpiando la búsqueda."
            />
          </Panel>
        )}
        {filtered.map((r) => (
          <Panel key={r.review_id}>
            <article className="grid grid-cols-[auto_1fr_auto] items-start gap-4 px-6 py-5">
              <div
                className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-base font-bold"
                style={{
                  background: r.respondida ? 'var(--color-moss)' : 'var(--color-wood)',
                  color: 'var(--color-bone)',
                }}
              >
                {(r.autor || '?').charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <div className="mb-[6px] flex flex-wrap items-center gap-[10px] text-[13px]">
                  <span
                    className="font-bold"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {r.autor || 'Anónimo'}
                  </span>
                  <Stars rating={r.rating} />
                  <span
                    className="rounded-[2px] px-[6px] py-px font-[family-name:var(--font-mono)] text-[11px]"
                    style={{
                      color: 'var(--color-wood-light)',
                      background: 'var(--color-paper)',
                    }}
                  >
                    {r.local}
                  </span>
                  <span
                    className="ml-auto font-[family-name:var(--font-mono)] text-[11px]"
                    style={{ color: 'var(--color-wood-light)' }}
                  >
                    {fmtRelative(r.fecha)}
                  </span>
                </div>

                {r.texto ? (
                  <p
                    className="mt-2 text-sm leading-[1.55]"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {r.texto}
                  </p>
                ) : (
                  <p className="mt-2 italic text-sm" style={{ color: 'var(--color-wood-light)' }}>
                    (Solo calificación)
                  </p>
                )}

                {r.imagenes && r.imagenes.length > 0 && (
                  <PhotoStrip urls={r.imagenes} size={64} visible={5} />
                )}

                {r.respondida && r.respuesta && (
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
                      ◆ Tu respuesta · {fmtRelative(r.respuesta_fecha)}
                    </div>
                    {r.respuesta}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-[6px]">
                {r.respondida ? (
                  <span
                    className="rounded-[2px] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{
                      background: 'var(--color-moss)',
                      color: 'var(--color-bone)',
                    }}
                  >
                    Respondida
                  </span>
                ) : (
                  <span
                    className="rounded-[2px] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{
                      background: 'var(--color-gold)',
                      color: 'var(--color-ink)',
                    }}
                  >
                    Pendiente
                  </span>
                )}
              </div>
            </article>
          </Panel>
        ))}
      </div>
    </div>
  );
}
