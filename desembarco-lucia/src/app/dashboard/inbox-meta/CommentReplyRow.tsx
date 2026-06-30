'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { replyToCommentAction } from './actions';

interface CommentItem {
  id: string;
  contactName: string | null;
  brandName: string;
  text: string;
  postCaption: string | null;
  receivedAt: Date | string;
}

interface Props {
  comment: CommentItem;
  isLast: boolean;
}

function timeAgo(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const d2 = Math.floor(hr / 24);
  if (d2 === 1) return 'ayer';
  if (d2 < 7) return `hace ${d2} días`;
  return `hace ${Math.floor(d2 / 7)} sem`;
}

export function CommentReplyRow({ comment, isLast }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleReply() {
    if (text.trim().length < 2) {
      setError('Respuesta muy corta');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await replyToCommentAction({ commentId: comment.id, text });
      if (res.ok) {
        setSent(true);
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <article
      className="px-5 py-4"
      style={{
        borderBottom: isLast ? 'none' : '1px dashed var(--color-paper-dark)',
      }}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4">
        <div
          className="grid h-[36px] w-[36px] flex-shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-sm font-bold"
          style={{
            background: sent ? 'var(--color-moss)' : 'var(--color-gold)',
            color: 'var(--color-ink)',
          }}
        >
          {(comment.contactName || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold" style={{ color: 'var(--color-ink)' }}>
              @{comment.contactName || 'anónimo'}
            </span>
            <span
              className="rounded-[2px] px-[6px] py-px font-[family-name:var(--font-mono)] text-[10px]"
              style={{
                color: 'var(--color-wood-light)',
                background: 'var(--color-paper)',
              }}
            >
              {comment.brandName}
            </span>
            {sent && (
              <span
                className="rounded-full px-2 py-px font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{
                  background: 'var(--color-moss)',
                  color: 'var(--color-bone)',
                }}
              >
                Respondido
              </span>
            )}
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-ink)' }}>
            {comment.text}
          </p>
          {comment.postCaption && (
            <p
              className="mt-1 text-xs italic"
              style={{ color: 'var(--color-wood-light)' }}
            >
              en: {comment.postCaption.slice(0, 80)}
              {comment.postCaption.length > 80 ? '…' : ''}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="font-[family-name:var(--font-mono)] text-[11px]"
            style={{ color: 'var(--color-wood-light)' }}
          >
            {timeAgo(comment.receivedAt)}
          </span>
          {!sent && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="px-2 py-1 text-[10px] uppercase tracking-[0.1em]"
              style={{
                color: open ? 'var(--color-ember)' : 'var(--color-wood)',
                fontFamily: 'var(--font-mono)',
                background: 'transparent',
                border: '1px solid var(--color-paper-dark)',
              }}
            >
              {open ? 'cerrar' : 'responder'}
            </button>
          )}
        </div>
      </div>

      {open && !sent && (
        <div
          className="mt-3 ml-[52px] rounded-md p-3"
          style={{
            background: 'var(--color-paper)',
            border: '1px dashed var(--color-paper-dark)',
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tu respuesta…"
            rows={3}
            className="w-full rounded-sm p-2 text-sm"
            style={{
              background: 'var(--color-bone)',
              border: '1px solid var(--color-paper-dark)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
              resize: 'vertical',
            }}
          />
          {error && (
            <p
              className="mt-1 text-[11px]"
              style={{ color: 'var(--color-ember-dark)' }}
            >
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={handleReply}
              disabled={pending || text.trim().length < 2}
              className="px-3 py-1 text-[11px] uppercase tracking-[0.08em] disabled:opacity-50"
              style={{
                background: 'var(--color-ember)',
                color: 'var(--color-bone)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {pending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
