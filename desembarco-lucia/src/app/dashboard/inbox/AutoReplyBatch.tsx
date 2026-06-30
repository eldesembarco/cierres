'use client';

import { useState, useTransition } from 'react';
import { generateAutoReplyDraftAction } from './actions';
import type { ClassifyResult } from '@/lib/llm';

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
}

interface BatchProgress {
  total: number;
  done: number;
  approved: number;
  skipped: number;
  failed: number;
  results: {
    reviewId: string;
    autor: string;
    status: 'approved' | 'skipped' | 'failed';
    detail: string;
    classification?: ClassifyResult;
  }[];
}

export function AutoReplyBatch({ candidates }: { candidates: ReviewItem[] }) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [pending, startTransition] = useTransition();

  function onRun() {
    if (candidates.length === 0) return;
    setProgress({
      total: candidates.length,
      done: 0,
      approved: 0,
      skipped: 0,
      failed: 0,
      results: [],
    });

    startTransition(async () => {
      for (const review of candidates) {
        const res = await generateAutoReplyDraftAction(review);
        setProgress((p) => {
          if (!p) return p;
          const newRes = {
            reviewId: review.reviewId,
            autor: review.reviewerName || 'Anónimo',
            status: (res.ok ? 'approved' : (res.classification ? 'skipped' : 'failed')) as
              | 'approved'
              | 'skipped'
              | 'failed',
            detail: res.ok ? 'Borrador aprobado' : res.error || 'Error',
            classification: 'classification' in res ? res.classification : undefined,
          };
          return {
            ...p,
            done: p.done + 1,
            approved: p.approved + (newRes.status === 'approved' ? 1 : 0),
            skipped: p.skipped + (newRes.status === 'skipped' ? 1 : 0),
            failed: p.failed + (newRes.status === 'failed' ? 1 : 0),
            results: [...p.results, newRes],
          };
        });
      }
    });
  }

  function onClose() {
    setProgress(null);
    setOpen(false);
  }

  if (candidates.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
        style={{
          background: 'var(--color-moss)',
          color: 'var(--color-bone)',
          padding: '6px 12px',
        }}
      >
        ◆ Auto-responder elegibles ({candidates.length})
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <div
            className="w-full max-w-2xl overflow-hidden border-4 border-double"
            style={{
              background: 'var(--color-bone)',
              borderColor: 'var(--color-gold)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              className="flex items-center justify-between px-6 py-4"
              style={{
                background: 'var(--color-wood)',
                color: 'var(--color-bone)',
              }}
            >
              <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.04em]">
                Auto-responder reseñas positivas
              </h2>
              <button
                onClick={onClose}
                disabled={pending}
                className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] disabled:opacity-50"
                style={{ color: 'var(--color-paper-dark)' }}
              >
                ✕ Cerrar
              </button>
            </header>

            <div className="px-6 py-5">
              {!progress ? (
                <>
                  <p className="text-sm" style={{ color: 'var(--color-ink)' }}>
                    Vas a procesar <strong>{candidates.length}</strong> reseñas de 5★ que
                    pasan el filtro inicial (sin red flags textuales).
                  </p>
                  <ul
                    className="mt-3 space-y-1 text-xs"
                    style={{ color: 'var(--color-wood-light)' }}
                  >
                    <li>• Por cada una, el classifier confirma sentiment positivo</li>
                    <li>• Si confirma → genera borrador y lo aprueba automáticamente</li>
                    <li>• Si NO confirma (5★ con texto negativo) → se salta a la cola manual</li>
                    <li>
                      • <strong>Importante</strong>: los borradores quedan APPROVED. El envío real a
                      Google requiere allowlist GBP (pendiente).
                    </li>
                  </ul>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={onClose}
                      className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
                      style={{
                        border: '1px solid var(--color-wood)',
                        color: 'var(--color-wood)',
                        padding: '6px 14px',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={onRun}
                      className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
                      style={{
                        background: 'var(--color-moss)',
                        color: 'var(--color-bone)',
                        padding: '6px 14px',
                      }}
                    >
                      Iniciar procesamiento
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="mb-3 flex items-center gap-3 font-[family-name:var(--font-mono)] text-xs"
                    style={{ color: 'var(--color-wood)' }}
                  >
                    <span>
                      <strong>{progress.done}</strong> / {progress.total}
                    </span>
                    <span style={{ color: 'var(--color-moss-dark)' }}>
                      ✓ {progress.approved} aprobadas
                    </span>
                    <span style={{ color: 'var(--color-gold)' }}>
                      ⚠ {progress.skipped} a manual
                    </span>
                    {progress.failed > 0 && (
                      <span style={{ color: 'var(--color-ember-dark)' }}>
                        ✕ {progress.failed} fallaron
                      </span>
                    )}
                  </div>
                  <div
                    className="h-[6px] overflow-hidden"
                    style={{ background: 'var(--color-paper)' }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${(progress.done / progress.total) * 100}%`,
                        background:
                          'linear-gradient(90deg, var(--color-moss), var(--color-gold))',
                      }}
                    />
                  </div>

                  <div className="mt-4 max-h-96 space-y-1 overflow-auto text-xs">
                    {progress.results.map((r) => (
                      <div
                        key={r.reviewId}
                        className="flex items-start gap-2 py-1.5"
                        style={{
                          borderBottom: '1px dashed var(--color-paper-dark)',
                        }}
                      >
                        <span
                          style={{
                            color:
                              r.status === 'approved'
                                ? 'var(--color-moss-dark)'
                                : r.status === 'skipped'
                                  ? 'var(--color-gold)'
                                  : 'var(--color-ember-dark)',
                          }}
                        >
                          {r.status === 'approved' ? '✓' : r.status === 'skipped' ? '⚠' : '✕'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-medium"
                            style={{ color: 'var(--color-ink)' }}
                          >
                            {r.autor}
                          </div>
                          <div style={{ color: 'var(--color-wood-light)' }}>{r.detail}</div>
                          {r.classification && (
                            <div
                              className="mt-0.5 font-[family-name:var(--font-mono)] text-[10px]"
                              style={{ color: 'var(--color-wood-light)' }}
                            >
                              {r.classification.sentiment} · conf{' '}
                              {r.classification.confidence.toFixed(2)}
                              {r.classification.redFlags.length > 0 &&
                                ` · flags: ${r.classification.redFlags.join(', ')}`}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {progress.done === progress.total && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={onClose}
                        className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em]"
                        style={{
                          background: 'var(--color-wood)',
                          color: 'var(--color-bone)',
                          padding: '6px 14px',
                        }}
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
