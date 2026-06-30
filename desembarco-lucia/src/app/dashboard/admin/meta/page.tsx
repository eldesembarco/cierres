import { prisma } from '@/lib/prisma';
import { Panel, PanelHead } from '@/components/desembarco/panel';
import { PageHero, EmptyState } from '@/components/desembarco/page-hero';
import { ConnectMetaForm } from './ConnectMetaForm';

export const dynamic = 'force-dynamic';

export default async function AdminMetaPage() {
  let accounts: Awaited<ReturnType<typeof prisma.metaAccount.findMany>> = [];
  let dbError: string | null = null;

  try {
    accounts = await prisma.metaAccount.findMany({
      orderBy: [{ brandName: 'asc' }, { channel: 'asc' }],
    });
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const hasEnvSetup =
    !!process.env.META_APP_ID &&
    !!process.env.META_APP_SECRET &&
    !!process.env.META_WEBHOOK_VERIFY_TOKEN;

  return (
    <>
      <PageHero
        eyebrow="Admin · Cuentas Meta"
        title="Conectar Instagram + Messenger"
        description="Conectá las Páginas de Facebook y cuentas Instagram Business de cada marca. Los tokens duran 60 días y se renuevan automáticamente."
      />

      {!hasEnvSetup && (
        <Panel className="mb-6">
          <div
            className="px-5 py-4 text-sm"
            style={{
              background: 'rgba(212, 160, 23, 0.1)',
              color: 'var(--color-wood)',
              borderLeft: '3px solid var(--color-gold)',
            }}
          >
            <strong>Falta env vars.</strong> Antes de conectar cuentas necesitás
            configurar <code>META_APP_ID</code>, <code>META_APP_SECRET</code> y{' '}
            <code>META_WEBHOOK_VERIFY_TOKEN</code> en Vercel. Seguí{' '}
            <code>docs/META-SETUP.md</code>.
          </div>
        </Panel>
      )}

      {dbError && (
        <Panel className="mb-6">
          <div
            className="px-5 py-3 text-sm"
            style={{ color: 'var(--color-ember-dark)' }}
          >
            <strong>DB error.</strong> {dbError}
          </div>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <PanelHead title="Cuentas conectadas" ornament="◆" />
          {accounts.length === 0 ? (
            <EmptyState
              title="Sin cuentas todavía"
              description="Cuando conectes tu primera Página/IG van a aparecer acá con su estado."
            />
          ) : (
            <div>
              {accounts.map((a, idx) => {
                const daysLeft = a.tokenExpiresAt
                  ? Math.floor(
                      (a.tokenExpiresAt.getTime() - Date.now()) /
                        (24 * 60 * 60 * 1000)
                    )
                  : null;
                const tokenWarning =
                  daysLeft !== null && daysLeft < 10
                    ? 'ember'
                    : daysLeft !== null && daysLeft < 30
                      ? 'gold'
                      : 'moss';
                const warningColor =
                  tokenWarning === 'ember'
                    ? 'var(--color-ember)'
                    : tokenWarning === 'gold'
                      ? 'var(--color-gold)'
                      : 'var(--color-moss)';

                return (
                  <div
                    key={a.id}
                    className="px-5 py-4"
                    style={{
                      borderBottom:
                        idx === accounts.length - 1
                          ? 'none'
                          : '1px dashed var(--color-paper-dark)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div
                          className="font-bold"
                          style={{ color: 'var(--color-ink)' }}
                        >
                          {a.brandName}
                        </div>
                        <div
                          className="font-[family-name:var(--font-mono)] text-[11px]"
                          style={{ color: 'var(--color-wood-light)' }}
                        >
                          {a.channel === 'INSTAGRAM_DM'
                            ? '📷 IG DM'
                            : a.channel === 'MESSENGER'
                              ? '💬 Messenger'
                              : '💭 IG Comments'}{' '}
                          · {a.pageName ?? a.handle ?? '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className="rounded-full px-2 py-px font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.1em]"
                          style={{
                            background: warningColor,
                            color: 'var(--color-bone)',
                          }}
                        >
                          {a.active ? 'activa' : 'inactiva'}
                        </span>
                        <div
                          className="mt-1 font-[family-name:var(--font-mono)] text-[10px]"
                          style={{ color: 'var(--color-wood-light)' }}
                        >
                          {daysLeft !== null
                            ? `token: ${daysLeft}d`
                            : 'sin token'}
                        </div>
                      </div>
                    </div>
                    <div
                      className="mt-1 truncate font-[family-name:var(--font-mono)] text-[10px]"
                      style={{ color: 'var(--color-paper-dark)' }}
                      title={a.externalId}
                    >
                      ext_id: {a.externalId}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <ConnectMetaForm disabled={!hasEnvSetup} />
      </div>

      <Panel className="mt-6">
        <PanelHead title="Cómo obtener un short-lived token" ornament="◇" />
        <div
          className="px-5 py-4 text-sm leading-relaxed"
          style={{ color: 'var(--color-wood)' }}
        >
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Abrí el{' '}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--color-ember)',
                  textDecoration: 'underline',
                }}
              >
                Graph API Explorer
              </a>
              .
            </li>
            <li>
              Top right: seleccioná tu app{' '}
              <code>Desembarco LucIA Inbox</code>.
            </li>
            <li>
              Tildá los permisos:{' '}
              <code>
                pages_show_list, pages_messaging, pages_manage_metadata,
                pages_read_engagement, instagram_basic,
                instagram_manage_messages, instagram_manage_comments
              </code>
              .
            </li>
            <li>
              Click <strong>Generate Access Token</strong> → autorizar.
            </li>
            <li>
              Copiá el token (dura 1 hora) y pegalo en el form de la derecha.
            </li>
            <li>
              Para los <code>pageId</code>: en el mismo Explorer corré{' '}
              <code>me/accounts?fields=id,name,instagram_business_account</code>
              .
            </li>
          </ol>
        </div>
      </Panel>
    </>
  );
}
