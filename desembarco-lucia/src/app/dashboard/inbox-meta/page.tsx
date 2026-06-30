import { prisma } from '@/lib/prisma';
import { Panel, PanelHead, Chip } from '@/components/desembarco/panel';
import { PageHero, EmptyState, StatCard } from '@/components/desembarco/page-hero';
import Link from 'next/link';
import { CommentReplyRow } from './CommentReplyRow';

export const revalidate = 30;

export default async function InboxMetaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; brand?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab ?? 'dms';
  const brandFilter = params.brand ?? 'all';

  let accountsCount = 0;
  let conversations: Awaited<ReturnType<typeof prisma.metaConversation.findMany>> = [];
  let comments: Awaited<ReturnType<typeof prisma.metaComment.findMany>> = [];
  let dbError: string | null = null;

  try {
    accountsCount = await prisma.metaAccount.count();
    if (accountsCount > 0) {
      const where = brandFilter !== 'all' ? { brandName: brandFilter } : {};
      conversations = await prisma.metaConversation.findMany({
        where: { ...where, archived: false },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
      });
      comments = await prisma.metaComment.findMany({
        where: { ...where, replied: false },
        orderBy: { receivedAt: 'desc' },
        take: 50,
      });
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const counts = {
    dms_unread: conversations.filter((c) => c.unread).length,
    dms_total: conversations.length,
    comments_pending: comments.filter((c) => !c.replied).length,
    comments_total: comments.length,
  };

  // Setup state
  if (accountsCount === 0 && !dbError) {
    return (
      <>
        <PageHero
          eyebrow="Inbox Meta · Instagram + Messenger"
          title="Mensajes y comentarios"
          description="Respuestas a DMs de Instagram, Messenger y comentarios de IG. Pendiente conectar las cuentas Meta de tus marcas."
        />
        <Panel>
          <EmptyState
            ornament="◆"
            title="Conectar Meta"
            description="Para empezar, configurá tu app en Meta for Developers y conectá las páginas/cuentas IG. Seguí la guía en docs/META-SETUP.md del proyecto."
            action={
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em]"
                style={{
                  background: 'var(--color-wood)',
                  color: 'var(--color-bone)',
                  padding: '10px 18px',
                }}
              >
                Abrir Meta for Developers →
              </a>
            }
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Inbox Meta · Instagram + Messenger"
        title="Mensajes y comentarios"
        description={
          <>
            <span style={{ color: 'var(--color-ember)' }}>
              {counts.dms_unread} DMs sin leer
            </span>{' '}
            ·{' '}
            <span style={{ color: 'var(--color-gold)' }}>
              {counts.comments_pending} comentarios sin responder
            </span>{' '}
            · {accountsCount} cuentas conectadas
          </>
        }
      />

      {dbError && (
        <Panel className="mb-6">
          <div
            className="px-5 py-3 text-sm"
            style={{ color: 'var(--color-ember-dark)' }}
          >
            <strong>DB no disponible.</strong> {dbError}
          </div>
        </Panel>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="DMs sin leer"
          value={counts.dms_unread.toString()}
          tone="ember"
          delay={0.05}
        />
        <StatCard
          label="Comentarios pendientes"
          value={counts.comments_pending.toString()}
          tone="gold"
          delay={0.1}
        />
        <StatCard
          label="Cuentas conectadas"
          value={accountsCount.toString()}
          tone="moss"
          delay={0.15}
        />
      </div>

      <Panel className="mb-6">
        <div
          className="flex flex-wrap items-center gap-2 px-5 py-3"
          style={{ background: 'var(--color-paper)' }}
        >
          <Link
            href={`/dashboard/inbox-meta?tab=dms${brandFilter !== 'all' ? `&brand=${brandFilter}` : ''}`}
            className={tab === 'dms' ? '' : ''}
          >
            <Chip active={tab === 'dms'}>
              💬 DMs ({counts.dms_total})
            </Chip>
          </Link>
          <Link
            href={`/dashboard/inbox-meta?tab=comments${brandFilter !== 'all' ? `&brand=${brandFilter}` : ''}`}
          >
            <Chip active={tab === 'comments'}>
              💭 Comentarios IG ({counts.comments_total})
            </Chip>
          </Link>
        </div>
      </Panel>

      {tab === 'dms' && (
        <Panel>
          <PanelHead title="Conversaciones" ornament="◆" />
          {conversations.length === 0 ? (
            <EmptyState
              title="Sin conversaciones"
              description="Cuando alguien te mande un DM en Instagram o Messenger, va a aparecer acá."
            />
          ) : (
            <div>
              {conversations.map((c, idx) => (
                <Link
                  key={c.id}
                  href={`/dashboard/inbox-meta/${c.id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-paper)]"
                  style={{
                    borderBottom:
                      idx === conversations.length - 1
                        ? 'none'
                        : '1px dashed var(--color-paper-dark)',
                  }}
                >
                  <div
                    className="grid h-[42px] w-[42px] flex-shrink-0 place-items-center rounded-full font-[family-name:var(--font-display)] text-base font-bold"
                    style={{
                      background: c.unread ? 'var(--color-ember)' : 'var(--color-wood)',
                      color: 'var(--color-bone)',
                    }}
                  >
                    {(c.contactName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span
                        className="font-bold"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {c.contactName || 'Anónimo'}
                      </span>
                      <span
                        className="rounded-[2px] px-[6px] py-px font-[family-name:var(--font-mono)] text-[10px]"
                        style={{
                          color: 'var(--color-wood-light)',
                          background: 'var(--color-paper)',
                        }}
                      >
                        {c.brandName} · {c.channel === 'INSTAGRAM_DM' ? 'IG' : 'Messenger'}
                      </span>
                      {c.unread && (
                        <span
                          className="rounded-full px-2 py-px font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.1em]"
                          style={{
                            background: 'var(--color-ember)',
                            color: 'var(--color-bone)',
                          }}
                        >
                          Nuevo
                        </span>
                      )}
                    </div>
                    {c.lastMessagePreview && (
                      <p
                        className="mt-1 truncate text-[13px] italic"
                        style={{ color: 'var(--color-wood-light)' }}
                      >
                        {c.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  <span
                    className="font-[family-name:var(--font-mono)] text-[11px]"
                    style={{ color: 'var(--color-wood-light)' }}
                  >
                    {timeAgo(c.lastMessageAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'comments' && (
        <Panel>
          <PanelHead title="Comentarios pendientes" ornament="◇" />
          {comments.length === 0 ? (
            <EmptyState
              title="Sin comentarios pendientes"
              description="Comentarios en posts de IG aparecen acá cuando llegan."
            />
          ) : (
            <div>
              {comments.map((c, idx) => (
                <CommentReplyRow
                  key={c.id}
                  comment={{
                    id: c.id,
                    contactName: c.contactName,
                    brandName: c.brandName,
                    text: c.text,
                    postCaption: c.postCaption,
                    receivedAt: c.receivedAt,
                  }}
                  isLast={idx === comments.length - 1}
                />
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
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
