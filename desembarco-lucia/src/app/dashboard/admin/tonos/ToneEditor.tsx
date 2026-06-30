'use client';

import { useState, useTransition } from 'react';
import { upsertBrandToneAction, deleteBrandToneAction } from './actions';

interface BrandTone {
  brand: string;
  voice: string;
  examples: string | null;
}

const inputStyle: React.CSSProperties = {
  borderColor: 'var(--color-paper-dark)',
  background: 'var(--color-bone)',
  color: 'var(--color-ink)',
  fontFamily: 'var(--font-sans)',
};

export function ToneEditor({
  initial,
  isNew = false,
}: {
  initial: BrandTone;
  isNew?: boolean;
}) {
  const [brand, setBrand] = useState(initial.brand);
  const [voice, setVoice] = useState(initial.voice);
  const [examples, setExamples] = useState(initial.examples ?? '');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await upsertBrandToneAction({ brand, voice, examples });
      if (res.ok) {
        setMsg({ type: 'ok', text: '✓ Guardado' });
        if (isNew) {
          setBrand('');
          setVoice('');
          setExamples('');
        }
      } else {
        setMsg({ type: 'err', text: res.error });
      }
    });
  }

  function onDelete() {
    if (!confirm(`¿Eliminar el tono de "${brand}"?`)) return;
    setMsg(null);
    startTransition(async () => {
      await deleteBrandToneAction(brand);
    });
  }

  return (
    <article
      className="overflow-hidden rounded-[2px] border"
      style={{
        background: 'var(--color-bone)',
        borderColor: 'var(--color-paper-dark)',
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between border-b px-5 py-4"
        style={{
          borderColor: 'var(--color-paper-dark)',
          background:
            'linear-gradient(180deg, var(--color-bone) 0%, var(--color-paper) 100%)',
        }}
      >
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          disabled={!isNew || pending}
          placeholder="Nombre de marca"
          className="border px-3 py-1.5 font-[family-name:var(--font-display)] text-base font-bold"
          style={{
            ...inputStyle,
            background: !isNew ? 'transparent' : 'var(--color-bone)',
            border: !isNew ? 'none' : '1px solid var(--color-paper-dark)',
          }}
        />
        {!isNew && (
          <button
            onClick={onDelete}
            disabled={pending}
            className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] disabled:opacity-50"
            style={{ color: 'var(--color-ember-dark)' }}
          >
            ✕ Eliminar
          </button>
        )}
      </header>

      {/* Body */}
      <div className="px-5 py-4">
        <label
          className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          Voice · se inyecta en cada prompt
        </label>
        <textarea
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          disabled={pending}
          rows={5}
          placeholder="Ej: Tono cálido y cercano, tratamos de vos. Agradecemos sinceramente. Sin emojis…"
          className="w-full border px-3 py-2 text-sm"
          style={inputStyle}
        />
        <p
          className="mt-1 font-[family-name:var(--font-mono)] text-[10px]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          {voice.length} caracteres (mínimo 30)
        </p>

        <label
          className="mb-1 mt-4 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          Ejemplos · few-shot para mejorar consistencia
        </label>
        <textarea
          value={examples}
          onChange={(e) => setExamples(e.target.value)}
          disabled={pending}
          rows={4}
          placeholder="Ej: A 5★ con texto: 'Gracias por venir, nos alegra que hayas disfrutado…'"
          className="w-full border px-3 py-2 text-sm"
          style={inputStyle}
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={pending || !brand || voice.length < 30}
            className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.05em] disabled:opacity-50"
            style={{
              background: 'var(--color-wood)',
              color: 'var(--color-bone)',
              padding: '8px 16px',
            }}
          >
            {pending ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
          </button>
          {msg && (
            <span
              className="font-[family-name:var(--font-mono)] text-[11px]"
              style={{
                color:
                  msg.type === 'ok'
                    ? 'var(--color-moss-dark)'
                    : 'var(--color-ember-dark)',
              }}
            >
              {msg.text}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
