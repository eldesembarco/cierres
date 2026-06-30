'use client';

import { useState } from 'react';

interface PhotoStripProps {
  urls: string[];
  size?: number;
  /** Cuántas miniaturas mostrar inline antes del "+N más" */
  visible?: number;
}

/**
 * Tira de miniaturas de fotos de una review, con lightbox modal al click.
 * Las imágenes vienen del scraper de Google Maps (CDN público de Google).
 */
export function PhotoStrip({ urls, size = 64, visible = 4 }: PhotoStripProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  const shown = urls.slice(0, visible);
  const remaining = urls.length - shown.length;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {shown.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpenIdx(i)}
            className="group relative overflow-hidden rounded-md border border-zinc-200 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-zinc-800"
            style={{ width: size, height: size }}
            aria-label={`Ver foto ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Foto ${i + 1} de la reseña`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setOpenIdx(shown.length)}
            className="flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
            style={{ width: size, height: size }}
          >
            +{remaining}
          </button>
        )}
      </div>

      {openIdx !== null && (
        <Lightbox urls={urls} startIdx={openIdx} onClose={() => setOpenIdx(null)} />
      )}
    </>
  );
}

function Lightbox({
  urls,
  startIdx,
  onClose,
}: {
  urls: string[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const total = urls.length;

  function prev() {
    setIdx((i) => (i - 1 + total) % total);
  }
  function next() {
    setIdx((i) => (i + 1) % total);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Cerrar"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Anterior"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            aria-label="Siguiente"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[idx]}
          alt={`Foto ${idx + 1} de ${total}`}
          referrerPolicy="no-referrer"
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        />
        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            {idx + 1} / {total}
          </div>
        )}
      </div>
    </div>
  );
}
