import { prisma } from '@/lib/prisma';
import { Panel, PanelHead } from '@/components/desembarco/panel';
import { PageHero, StatCard, EmptyState } from '@/components/desembarco/page-hero';

export const revalidate = 60;

const ACTION_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'Pendiente', bg: 'var(--color-paper)', color: 'var(--color-wood)' },
  APPROVED:   { label: 'Aprobado',  bg: 'var(--color-moss)',  color: 'var(--color-bone)' },
  EDITED:     { label: 'Editado',   bg: 'var(--color-gold)',  color: 'var(--color-ink)' },
  DISCARDED:  { label: 'Descart.',  bg: 'var(--color-paper-dark)', color: 'var(--color-wood-light)' },
  SENT:       { label: 'Enviado',   bg: 'var(--color-ember)', color: 'var(--color-bone)' },
};

export default async function IaLogsPage() {
  let logs: Awaited<ReturnType<typeof prisma.responseLog.findMany>> = [];
  let dbError: string | null = null;

  try {
    logs = await prisma.responseLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const stats = logs.reduce(
    (acc, l) => ({
      total: acc.total + 1,
      sent: acc.sent + (l.action === 'SENT' ? 1 : 0),
      edited:
        acc.edited +
        (l.action === 'EDITED' || (l.action === 'SENT' && l.finalText && l.finalText !== l.draft)
          ? 1
          : 0),
      discarded: acc.discarded + (l.action === 'DISCARDED' ? 1 : 0),
    }),
    { total: 0, sent: 0, edited: 0, discarded: 0 }
  );

  const editRate = stats.sent > 0 ? Math.round((stats.edited / stats.sent) * 100) : 0;

  return (
    <>
      <PageHero
        breadcrumb={[
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Logs IA' },
        ]}
        eyebrow="Admin · Auditoría IA"
        title="Auditoría IA"
        description="Registro de cada borrador generado por la IA, qué proveedor lo produjo y qué decidió el CM. Últimos 200 registros."
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

      {!dbError && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Drafts totales" value={stats.total.toString()} delay={0.05} />
            <StatCard
              label="Enviados"
              value={stats.sent.toString()}
              tone="ember"
              delay={0.1}
            />
            <StatCard
              label="Descartados"
              value={stats.discarded.toString()}
              tone="wood"
              delay={0.15}
            />
            <StatCard
              label="% editados"
              value={`${editRate}%`}
              tone="moss"
              hint="cuánto interviene el CM"
              delay={0.2}
            />
          </div>

          <Panel>
            <PanelHead title="Registro reciente" ornament="◇" />
            {logs.length === 0 ? (
              <EmptyState
                title="Sin borradores generados"
                description="Cuando el CM use el panel para generar respuestas, los logs aparecerán acá."
              />
            ) : (
              <div>
                {logs.map((l, idx) => {
                  const badge = ACTION_BADGE[l.action];
                  return (
                    <details
                      key={l.id}
                      className="group"
                      style={{
                        borderBottom:
                          idx === logs.length - 1
                            ? 'none'
                            : '1px dashed var(--color-paper-dark)',
                      }}
                    >
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className="rounded-[2px] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {badge.label}
                          </span>
                          <span
                            className="font-[family-name:var(--font-display)] font-bold"
                            style={{ color: 'var(--color-ink)' }}
                          >
                            {l.brand}
                          </span>
                          <span
                            className="font-[family-name:var(--font-mono)] text-[11px]"
                            style={{ color: 'var(--color-gold)' }}
                          >
                            {l.rating}★
                          </span>
                          {l.llmProvider && (
                            <span
                              className="rounded-[2px] px-2 py-px font-[family-name:var(--font-mono)] text-[10px] uppercase"
                              style={{
                                background: 'var(--color-paper)',
                                color: 'var(--color-wood-light)',
                              }}
                            >
                              {l.llmProvider}
                            </span>
                          )}
                        </div>
                        <span
                          className="font-[family-name:var(--font-mono)] text-[11px]"
                          style={{ color: 'var(--color-wood-light)' }}
                        >
                          {l.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                        </span>
                      </summary>
                      <div
                        className="space-y-3 px-5 py-4 text-sm sm:px-6"
                        style={{ borderTop: '1px dashed var(--color-paper-dark)' }}
                      >
                        <Field label="Reseña original">
                          <p className="italic">{l.reviewText}</p>
                        </Field>
                        <Field label="Borrador IA">
                          <p
                            className="px-3 py-2"
                            style={{
                              background: 'var(--color-paper)',
                              color: 'var(--color-ink)',
                            }}
                          >
                            {l.draft}
                          </p>
                        </Field>
                        {l.finalText && l.finalText !== l.draft && (
                          <Field label="Final enviado · editado">
                            <p
                              className="border-l-[3px] px-3 py-2"
                              style={{
                                background: 'rgba(212, 160, 23, 0.1)',
                                borderColor: 'var(--color-gold)',
                                color: 'var(--color-ink)',
                              }}
                            >
                              {l.finalText}
                            </p>
                          </Field>
                        )}
                        {l.llmModel && (
                          <p
                            className="font-[family-name:var(--font-mono)] text-[11px]"
                            style={{ color: 'var(--color-wood-light)' }}
                          >
                            Modelo: {l.llmModel}
                          </p>
                        )}
                        <details
                          className="font-[family-name:var(--font-mono)] text-xs"
                          style={{ color: 'var(--color-wood-light)' }}
                        >
                          <summary className="cursor-pointer">Ver prompt completo</summary>
                          <pre
                            className="mt-2 overflow-x-auto whitespace-pre-wrap p-3 text-[11px]"
                            style={{
                              background: 'var(--color-paper)',
                              color: 'var(--color-wood)',
                            }}
                          >
                            {l.prompt}
                          </pre>
                        </details>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
        style={{ color: 'var(--color-wood-light)' }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
