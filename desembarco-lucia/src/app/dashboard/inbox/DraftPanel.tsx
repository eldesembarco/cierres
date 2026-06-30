'use client';

import { useState, useTransition } from 'react';
import {
  generateDraftAction,
  discardDraftAction,
  regenerateDraftAction,
  compareProvidersAction,
  chooseComparedDraftAction,
  submitManualReplyAction,
  markManuallySentAction,
} from './actions';
import { PhotoStrip } from '@/components/PhotoStrip';
import { Panel } from '@/components/desembarco/panel';

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

interface DraftState {
  logId: string;
  initialDraft: string;
  currentText: string;
  provider?: string;
  model?: string;
}

interface ManualState {
  text: string;
}

interface CompareItem {
  provider: 'groq' | 'cerebras' | 'openrouter' | 'deepseek' | 'gemini';
  logId?: string;
  draft?: string;
  model?: string;
  error?: string;
}

const PROVIDER_LABEL: Record<string, { name: string; bg: string; color: string }> = {
  groq: {
    name: 'Groq · Llama 3.3 70B',
    bg: 'rgba(212, 160, 23, 0.15)',
    color: 'var(--color-gold)',
  },
  cerebras: {
    name: 'Cerebras · Qwen 235B',
    bg: 'rgba(90, 125, 58, 0.15)',
    color: 'var(--color-moss-dark)',
  },
  openrouter: {
    name: 'OpenRouter · Qwen 80B',
    bg: 'rgba(200, 51, 30, 0.15)',
    color: 'var(--color-ember-dark)',
  },
  deepseek: {
    name: 'OpenRouter · Qwen 80B',
    bg: 'rgba(200, 51, 30, 0.15)',
    color: 'var(--color-ember-dark)',
  },
  gemini: {
    name: 'Gemini Flash',
    bg: 'rgba(74, 44, 26, 0.15)',
    color: 'var(--color-wood)',
  },
};

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

export function ReviewCard({ review }: { review: ReviewItem }) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [comparison, setComparison] = useState<CompareItem[] | null>(null);
  const [manual, setManual] = useState<ManualState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isUrgent = review.rating > 0 && review.rating <= 2;
  const noText = !review.reviewText;

  function onManualOpen() {
    setError(null);
    setDraft(null);
    setComparison(null);
    setManual({ text: '' });
  }

  function onManualSubmit() {
    if (!manual) return;
    setError(null);
    const text = manual.text.trim();
    startTransition(async () => {
      // Copiar al portapapeles
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* fallback silencioso */
      }
      // Abrir Google Maps de la review
      const url = review.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${review.placeId}`
        : 'https://business.google.com/';
      window.open(url, '_blank', 'noopener,noreferrer');

      // Loggear la respuesta como manual + sent
      const res = await submitManualReplyAction({
        reviewId: review.reviewId,
        reviewName: review.reviewName,
        placeId: review.placeId,
        brand: review.brand,
        localName: review.localName,
        rating: review.rating,
        reviewText: review.reviewText,
        reviewerName: review.reviewerName,
        reviewDate: review.reviewDate,
        finalText: text,
      });
      if (!res.ok && res.error?.includes('GBP reply falló')) {
        // Esperado mientras no haya allowlist — el log queda APPROVED igual
        setManual(null);
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setManual(null);
    });
  }

  function onManualCancel() {
    setManual(null);
    setError(null);
  }

  function onGenerate() {
    setError(null);
    setComparison(null);
    setManual(null);
    startTransition(async () => {
      const res = await generateDraftAction(review);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft({
        logId: res.logId,
        initialDraft: res.draft,
        currentText: res.draft,
      });
    });
  }

  function onCompare() {
    setError(null);
    setDraft(null);
    setManual(null);
    startTransition(async () => {
      const res = await compareProvidersAction(review);
      setComparison(res.items);
    });
  }

  function onChooseFromCompare(item: CompareItem) {
    if (!item.logId || !item.draft) return;
    setError(null);
    startTransition(async () => {
      const others = (comparison || [])
        .filter((c) => c.logId && c.logId !== item.logId)
        .map((c) => c.logId!);
      await chooseComparedDraftAction({ chosenLogId: item.logId!, discardedLogIds: others });
      setComparison(null);
      setDraft({
        logId: item.logId!,
        initialDraft: item.draft!,
        currentText: item.draft!,
        provider: item.provider,
        model: item.model,
      });
    });
  }

  function onCancelCompare() {
    if (!comparison) return;
    setError(null);
    startTransition(async () => {
      const allIds = comparison
        .filter((c) => c.logId)
        .map((c) => c.logId!);
      await Promise.all(allIds.map((id) => discardDraftAction(id)));
      setComparison(null);
    });
  }

  function onCopyAndOpen() {
    if (!draft) return;
    setError(null);
    const edited = draft.currentText.trim() !== draft.initialDraft.trim();
    const text = draft.currentText.trim();

    startTransition(async () => {
      // Copiar al portapapeles
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback: si la Clipboard API falla, igual seguimos
      }

      // Abrir Google Business Profile Manager en nueva pestaña
      const url = review.placeId
        ? `https://www.google.com/maps/place/?q=place_id:${review.placeId}`
        : 'https://business.google.com/';
      window.open(url, '_blank', 'noopener,noreferrer');

      // Marcar log como SENT (asume que el CM va a pegar y enviar)
      const res = await markManuallySentAction({
        logId: draft.logId,
        finalText: text,
        edited,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(null);
    });
  }

  function onDiscard() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      await discardDraftAction(draft.logId);
      setDraft(null);
    });
  }

  function onRegenerate() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await regenerateDraftAction({
        previousLogId: draft.logId,
        ...review,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft({
        logId: res.logId,
        initialDraft: res.draft,
        currentText: res.draft,
      });
    });
  }

  return (
    <Panel
      className={isUrgent ? 'fade-up' : 'fade-up'}
    >
      {/* Urgent strip */}
      {isUrgent && (
        <div
          className="px-5 py-2 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em]"
          style={{
            background: 'linear-gradient(90deg, var(--color-ember-dark) 0%, transparent 100%)',
            color: 'var(--color-bone)',
          }}
        >
          ⚠ Urgente · responder con cuidado
        </div>
      )}

      <div className="px-6 py-5">
        {/* Header */}
        <header className="grid grid-cols-[auto_1fr_auto] items-start gap-4">
          <div
            className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-base font-bold"
            style={{
              background: isUrgent ? 'var(--color-ember)' : 'var(--color-wood)',
              color: 'var(--color-bone)',
            }}
          >
            {(review.reviewerName || '?').charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="mb-[4px] flex flex-wrap items-center gap-[10px] text-[13px]">
              <span
                className="font-bold"
                style={{ color: 'var(--color-ink)' }}
              >
                {review.reviewerName || 'Anónimo'}
              </span>
              <Stars rating={review.rating} />
              <span
                className="rounded-[2px] px-[6px] py-px font-[family-name:var(--font-mono)] text-[11px]"
                style={{
                  color: 'var(--color-wood-light)',
                  background: 'var(--color-paper)',
                }}
              >
                {review.localName}
              </span>
            </div>
            <span
              className="font-[family-name:var(--font-mono)] text-[11px]"
              style={{ color: 'var(--color-wood-light)' }}
            >
              {fmtRelative(review.reviewDate)}
            </span>
          </div>
        </header>

        {/* Texto */}
        {noText ? (
          <p
            className="mt-3 italic text-sm"
            style={{ color: 'var(--color-wood-light)' }}
          >
            (Solo calificación, sin texto)
          </p>
        ) : (
          <blockquote
            className="mt-3 border-l-[3px] px-[14px] py-[10px] text-sm leading-[1.55]"
            style={{
              borderColor: isUrgent ? 'var(--color-ember)' : 'var(--color-paper-dark)',
              color: 'var(--color-ink)',
              background: 'var(--color-paper)',
            }}
          >
            {review.reviewText}
          </blockquote>
        )}

        {/* Fotos */}
        {review.imagenes && review.imagenes.length > 0 && (
          <PhotoStrip urls={review.imagenes} size={64} visible={5} />
        )}

        {/* Error */}
        {error && (
          <div
            className="mt-3 border-l-[3px] px-[14px] py-[10px] text-xs"
            style={{
              borderColor: 'var(--color-ember)',
              background: 'rgba(200, 51, 30, 0.08)',
              color: 'var(--color-ember-dark)',
            }}
          >
            {error}
          </div>
        )}

        {/* Comparación side-by-side */}
        {comparison && (() => {
          const successful = comparison.filter((c) => c.draft && !c.error);
          const failedCount = comparison.length - successful.length;
          if (successful.length === 0) {
            return (
              <div
                className="mt-4 border-l-[3px] px-4 py-3 text-xs"
                style={{
                  borderColor: 'var(--color-gold)',
                  background: 'rgba(212, 160, 23, 0.08)',
                  color: 'var(--color-wood)',
                }}
              >
                Ningún proveedor respondió. Probá de nuevo en un minuto.
                <button
                  onClick={onCancelCompare}
                  className="ml-2 underline"
                >
                  Cerrar
                </button>
              </div>
            );
          }
          return (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em]"
                  style={{ color: 'var(--color-wood-light)' }}
                >
                  Comparativa de drafts · elegí uno con "Usar este"
                  {failedCount > 0 && (
                    <span style={{ color: 'var(--color-ember-dark)' }}>
                      {' '}({failedCount} no respondió)
                    </span>
                  )}
                </p>
                <button
                  onClick={onCancelCompare}
                  disabled={pending}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] underline disabled:opacity-50"
                  style={{ color: 'var(--color-wood-light)' }}
                >
                  Descartar todo
                </button>
              </div>
              <div
                className={`grid gap-3 ${
                  successful.length === 1
                    ? 'grid-cols-1'
                    : successful.length === 2
                      ? 'md:grid-cols-2'
                      : 'md:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {successful.map((item) => (
                  <CompareCard
                    key={item.provider}
                    item={item}
                    onChoose={() => onChooseFromCompare(item)}
                    pending={pending}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Acciones */}
        {!comparison && !draft && !manual && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={onGenerate}
              disabled={pending}
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
              style={{
                background: 'var(--color-wood)',
                color: 'var(--color-bone)',
                padding: '8px 14px',
                border: '1px solid var(--color-wood)',
              }}
            >
              {pending ? 'Generando…' : 'Generar con IA'}
            </button>
            <button
              onClick={onCompare}
              disabled={pending}
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
              style={{
                background: 'transparent',
                color: 'var(--color-wood)',
                padding: '8px 14px',
                border: '1px solid var(--color-wood)',
              }}
            >
              Comparar proveedores
            </button>
            <button
              onClick={onManualOpen}
              disabled={pending}
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
              style={{
                background: 'transparent',
                color: 'var(--color-ember-dark)',
                padding: '8px 14px',
                border: '1px solid var(--color-ember-dark)',
              }}
            >
              ✎ Escribir manual
            </button>
          </div>
        )}

        {/* Respuesta manual del CM */}
        {manual && (
          <div
            className="mt-4 border-l-[3px] px-4 py-3"
            style={{
              borderColor: 'var(--color-ember)',
              background: 'rgba(200, 51, 30, 0.04)',
            }}
          >
            <div
              className="mb-2 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
              style={{ color: 'var(--color-ember-dark)' }}
            >
              <span>✎ Respuesta manual · sin IA</span>
            </div>
            <textarea
              value={manual.text}
              onChange={(e) => setManual({ text: e.target.value })}
              rows={5}
              placeholder="Escribí la respuesta a mano. Va directo a Google sin pasar por IA."
              className="w-full resize-none border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--color-paper-dark)',
                background: 'var(--color-bone)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
              }}
              disabled={pending}
              autoFocus
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="font-[family-name:var(--font-mono)] text-[10px]"
                style={{ color: 'var(--color-wood-light)' }}
              >
                {manual.text.length} caracteres
                {manual.text.length < 10 && (
                  <span style={{ color: 'var(--color-ember-dark)' }}>
                    {' · '}mínimo 10
                  </span>
                )}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  onClick={onManualSubmit}
                  disabled={pending || manual.text.trim().length < 10}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
                  style={{
                    background: 'var(--color-ember)',
                    color: 'var(--color-bone)',
                    padding: '6px 12px',
                  }}
                  title="Copia tu respuesta al portapapeles y abre Google Maps. Pegá con Ctrl+V."
                >
                  {pending ? 'Procesando…' : '✎ Copiar y abrir en Google'}
                </button>
                <button
                  onClick={onManualCancel}
                  disabled={pending}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-wood-light)',
                    padding: '6px 12px',
                    border: '1px solid var(--color-paper-dark)',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Draft activo */}
        {draft && (
          <div
            className="mt-4 border-l-[3px] px-4 py-3"
            style={{
              borderColor: 'var(--color-moss)',
              background: 'rgba(90, 125, 58, 0.05)',
            }}
          >
            <div
              className="mb-2 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
              style={{ color: 'var(--color-moss-dark)' }}
            >
              <span>◆ Borrador IA</span>
              {draft.provider && (
                <span
                  className="rounded-[2px] px-2 py-px"
                  style={{
                    background: PROVIDER_LABEL[draft.provider]?.bg ?? 'var(--color-paper)',
                    color: PROVIDER_LABEL[draft.provider]?.color ?? 'var(--color-wood)',
                  }}
                >
                  {PROVIDER_LABEL[draft.provider]?.name ?? draft.provider}
                </span>
              )}
              {draft.currentText.trim() !== draft.initialDraft.trim() && (
                <span style={{ color: 'var(--color-ember-dark)' }}>· editado</span>
              )}
            </div>
            <textarea
              value={draft.currentText}
              onChange={(e) => setDraft({ ...draft, currentText: e.target.value })}
              rows={4}
              className="w-full resize-none border px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--color-paper-dark)',
                background: 'var(--color-bone)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
              }}
              disabled={pending}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="font-[family-name:var(--font-mono)] text-[10px]"
                style={{ color: 'var(--color-wood-light)' }}
              >
                {draft.currentText.length} caracteres
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button
                  onClick={onCopyAndOpen}
                  disabled={pending || draft.currentText.trim().length === 0}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
                  style={{
                    background: 'var(--color-moss)',
                    color: 'var(--color-bone)',
                    padding: '6px 12px',
                  }}
                  title="Copia el draft al portapapeles y abre Google Maps. Pegá con Ctrl+V en la reseña."
                >
                  {pending ? 'Procesando…' : 'Copiar y abrir en Google'}
                </button>
                <button
                  onClick={onRegenerate}
                  disabled={pending}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-wood)',
                    padding: '6px 12px',
                    border: '1px solid var(--color-wood)',
                  }}
                >
                  ↻ Regenerar
                </button>
                <button
                  onClick={onDiscard}
                  disabled={pending}
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-wood-light)',
                    padding: '6px 12px',
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function CompareCard({
  item,
  onChoose,
  pending,
}: {
  item: CompareItem;
  onChoose: () => void;
  pending: boolean;
}) {
  const label = PROVIDER_LABEL[item.provider] ?? {
    name: item.provider,
    bg: 'var(--color-paper)',
    color: 'var(--color-wood)',
  };
  const wordCount = (item.draft || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div
      className="border p-4"
      style={{
        borderColor: 'var(--color-paper-dark)',
        background: 'var(--color-bone)',
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded-[2px] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.05em]"
          style={{ background: label.bg, color: label.color }}
        >
          {label.name}
        </span>
        <span
          className="font-[family-name:var(--font-mono)] text-[10px]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          {wordCount} palabras · {item.draft?.length ?? 0} ch
        </span>
      </div>
      <p
        className="mb-3 text-sm leading-[1.5]"
        style={{ color: 'var(--color-ink)' }}
      >
        {item.draft}
      </p>
      <button
        onClick={onChoose}
        disabled={pending}
        className="w-full font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
        style={{
          background: 'var(--color-moss)',
          color: 'var(--color-bone)',
          padding: '8px 12px',
        }}
      >
        ✓ Usar este
      </button>
    </div>
  );
}
