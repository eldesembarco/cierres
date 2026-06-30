import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Panel, PanelHead } from '@/components/desembarco/panel';
import { PageHero } from '@/components/desembarco/page-hero';
import { ConversationReply } from './ConversationReply';
import { markConversationReadAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const conv = await prisma.metaConversation.findUnique({
    where: { id },
    include: {
      account: true,
      messages: { orderBy: { receivedAt: 'asc' } },
    },
  });

  if (!conv) notFound();

  // Mark read on open (fire & forget — server action)
  if (conv.unread) {
    await markConversationReadAction(conv.id).catch(() => {});
  }

  const windowExpired =
    conv.windowExpiresAt && conv.windowExpiresAt.getTime() < Date.now();
  const lastFromContact = [...conv.messages]
    .reverse()
    .find((m) => !m.fromBrand);

  return (
    <>
      <PageHero
        eyebrow={`Inbox Meta · ${conv.channel === 'INSTAGRAM_DM' ? 'Instagram DM' : 'Messenger'}`}
        title={conv.contactName ?? 'Anónimo'}
        description={
          <>
            <span style={{ color: 'var(--color-gold)' }}>{conv.brandName}</span> ·{' '}
            <span style={{ color: 'var(--color-wood-light)' }}>
              {conv.account.pageName ?? conv.account.handle ?? '—'}
            </span>
            {' · '}
            <Link
              href="/dashboard/inbox-meta"
              style={{
                color: 'var(--color-ember)',
                textDecoration: 'underline',
              }}
            >
              ← Volver al inbox
            </Link>
          </>
        }
      />

      {windowExpired && (
        <Panel className="mb-4">
          <div
            className="px-5 py-3 text-sm"
            style={{
              background: 'rgba(200, 51, 30, 0.1)',
              color: 'var(--color-ember-dark)',
              borderLeft: '3px solid var(--color-ember)',
            }}
          >
            <strong>Ventana de 24hs vencida.</strong> Solo se puede responder con
            el tag <code>HUMAN_AGENT</code> (válido 7 días, requiere App Review en
            producción).
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Thread */}
        <Panel>
          <PanelHead title="Conversación" ornament="◆" />
          <div className="px-5 py-4">
            {conv.messages.length === 0 ? (
              <p
                className="text-sm italic"
                style={{ color: 'var(--color-wood-light)' }}
              >
                Sin mensajes todavía.
              </p>
            ) : (
              <div className="space-y-3">
                {conv.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.fromBrand ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[80%] rounded-md px-4 py-2 text-sm"
                      style={{
                        background: m.fromBrand
                          ? 'var(--color-wood)'
                          : 'var(--color-paper)',
                        color: m.fromBrand
                          ? 'var(--color-bone)'
                          : 'var(--color-ink)',
                        border: m.fromBrand
                          ? 'none'
                          : '1px solid var(--color-paper-dark)',
                      }}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] opacity-70">
                        <span>{m.fromBrand ? conv.brandName : conv.contactName ?? 'Cliente'}</span>
                        <span>·</span>
                        <span>
                          {m.receivedAt.toLocaleString('es-AR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                      {m.attachmentUrl && (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-xs underline"
                          style={{
                            color: m.fromBrand
                              ? 'var(--color-gold-light)'
                              : 'var(--color-ember)',
                          }}
                        >
                          📎 Adjunto ({m.attachmentType ?? 'media'})
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* Reply panel (client) */}
        <ConversationReply
          conversationId={conv.id}
          brandName={conv.brandName}
          contactName={conv.contactName ?? 'Cliente'}
          windowExpired={!!windowExpired}
          hasIncomingMessage={!!lastFromContact?.text}
        />
      </div>
    </>
  );
}
