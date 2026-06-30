'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelHead } from '@/components/desembarco/panel';
import {
  generateMetaDraftAction,
  replyToConversationAction,
  archiveConversationAction,
} from '../actions';

interface Props {
  conversationId: string;
  brandName: string;
  contactName: string;
  windowExpired: boolean;
  hasIncomingMessage: boolean;
}

interface Draft {
  logId: string;
  text: string;
  provider?: string;
}

export function ConversationReply({
  conversationId,
  brandName,
  contactName,
  windowExpired,
  hasIncomingMessage,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await generateMetaDraftAction({ conversationId });
      if (res.ok) {
        setDraft({ logId: res.logId, text: res.draft, provider: res.provider });
        setText(res.draft);
      } else {
        setError(res.error);
      }
    });
  }

  function handleSend() {
    if (text.trim().length < 2) {
      setError('Mensaje muy corto');
      return;
    }
    setError(null);
    setSuccess(null);
    const wasEdited = !!draft && draft.text !== text;
    startTransition(async () => {
      const res = await replyToConversationAction({
        conversationId,
        text,
        edited: wasEdited,
        draftLogId: draft?.logId,
      });
      if (res.ok) {
        setSuccess(`Mensaje enviado ✓`);
        setDraft(null);
        setText('');
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveConversationAction(conversationId);
      router.push('/dashboard/inbox-meta');
    });
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHead title="Responder" ornament="◇" />
        <div className="space-y-3 px-5 py-4">
          {!hasIncomingMessage && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background: 'rgba(212, 160, 23, 0.1)',
                color: 'var(--color-wood)',
              }}
            >
              No hay mensaje del cliente para generar borrador IA. Podés escribir
              uno manual abajo.
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={pending || !hasIncomingMessage}
              className="flex-1 px-3 py-2 text-xs uppercase tracking-[0.08em] transition-all disabled:opacity-50"
              style={{
                background: 'var(--color-moss)',
                color: 'var(--color-bone)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {pending ? 'Generando…' : '✦ Generar borrador IA'}
            </button>
          </div>

          {draft && (
            <div
              className="rounded-md p-3 text-xs"
              style={{
                background: 'var(--color-paper)',
                border: '1px dashed var(--color-paper-dark)',
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="text-[10px] uppercase tracking-[0.1em] opacity-70"
                  style={{ color: 'var(--color-wood)' }}
                >
                  Borrador IA · {draft.provider ?? '—'}
                </span>
                <button
                  onClick={() => {
                    setDraft(null);
                    setText('');
                  }}
                  className="text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: 'var(--color-ember)' }}
                >
                  descartar
                </button>
              </div>
              <p
                className="text-[11px] italic"
                style={{ color: 'var(--color-wood-light)' }}
              >
                Editá libremente abajo antes de enviar.
              </p>
            </div>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Escribí un mensaje para ${contactName} (${brandName})…`}
            rows={6}
            className="w-full rounded-sm p-3 text-sm"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-paper-dark)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
              resize: 'vertical',
            }}
          />

          {error && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background: 'rgba(200, 51, 30, 0.1)',
                color: 'var(--color-ember-dark)',
                borderLeft: '2px solid var(--color-ember)',
              }}
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="rounded-md px-3 py-2 text-xs"
              style={{
                background: 'rgba(90, 125, 58, 0.1)',
                color: 'var(--color-moss-dark)',
                borderLeft: '2px solid var(--color-moss)',
              }}
            >
              {success}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSend}
              disabled={pending || text.trim().length < 2}
              className="flex-1 px-3 py-2 text-xs uppercase tracking-[0.08em] transition-all disabled:opacity-50"
              style={{
                background: 'var(--color-ember)',
                color: 'var(--color-bone)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {pending ? 'Enviando…' : '➤ Enviar'}
            </button>
            <button
              onClick={handleArchive}
              disabled={pending}
              className="px-3 py-2 text-xs uppercase tracking-[0.08em] transition-all disabled:opacity-50"
              style={{
                background: 'transparent',
                color: 'var(--color-wood)',
                border: '1px solid var(--color-paper-dark)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Archivar
            </button>
          </div>

          {windowExpired && (
            <p
              className="text-[10px] italic"
              style={{ color: 'var(--color-wood-light)' }}
            >
              Se enviará con tag HUMAN_AGENT (ventana 24hs vencida).
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
