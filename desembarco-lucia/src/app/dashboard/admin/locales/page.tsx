import { getLocales } from '@/lib/sheets';
import { Panel, PanelHead } from '@/components/desembarco/panel';
import { PageHero, StatCard, EmptyState } from '@/components/desembarco/page-hero';

export const revalidate = 60;

export default async function LocalesAdminPage() {
  let locales: Awaited<ReturnType<typeof getLocales>> = [];
  let error: string | null = null;

  try {
    locales = await getLocales();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const activos = locales.filter((l) => l.activo);
  const sinDiscover = activos.filter((l) => !l.location_name || !l.place_id);

  return (
    <>
      <PageHero
        breadcrumb={[
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Locales' },
        ]}
        eyebrow="Admin · Maestro de locales"
        title="Locales"
        description={
          <>
            Read-only · el maestro vive en la hoja{' '}
            <code
              style={{
                background: 'var(--color-paper)',
                padding: '1px 4px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Locales
            </code>{' '}
            del Sheet.
          </>
        }
      />

      {error && (
        <Panel className="mb-6">
          <div
            className="px-5 py-3 text-sm"
            style={{ color: 'var(--color-ember-dark)' }}
          >
            <strong>Sheet no disponible.</strong> {error}
          </div>
        </Panel>
      )}

      {!error && (
        <>
          {/* Stats */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Total fichas" value={locales.length.toString()} delay={0.05} />
            <StatCard
              label="Activos en piloto"
              value={activos.length.toString()}
              tone="moss"
              delay={0.1}
            />
            <StatCard
              label="Sin discovery"
              value={sinDiscover.length.toString()}
              tone={sinDiscover.length > 0 ? 'ember' : 'wood'}
              hint={
                sinDiscover.length > 0 ? 'Falta correr workflow n8n discovery' : 'Todo en orden'
              }
              delay={0.15}
            />
          </div>

          {/* Tabla */}
          <Panel>
            <PanelHead title="Fichas registradas" ornament="◆" />
            {locales.length === 0 ? (
              <EmptyState
                title="Sin locales"
                description="Cargá los 4 del piloto en la hoja Locales para verlos acá."
              />
            ) : (
              <div>
                {locales.map((l, idx) => (
                  <div
                    key={l.local}
                    className="grid grid-cols-1 items-start gap-2 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:gap-4 sm:px-6"
                    style={{
                      borderBottom:
                        idx === locales.length - 1
                          ? 'none'
                          : '1px dashed var(--color-paper-dark)',
                    }}
                  >
                    <div>
                      <div
                        className="font-[family-name:var(--font-display)] font-bold"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {l.local}
                      </div>
                      {l.direccion && (
                        <div
                          className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px]"
                          style={{ color: 'var(--color-wood-light)' }}
                        >
                          {l.direccion}
                        </div>
                      )}
                      <div
                        className="mt-1 flex flex-wrap gap-3 font-[family-name:var(--font-mono)] text-[10px]"
                        style={{ color: 'var(--color-wood-light)' }}
                      >
                        {l.store_code && <span>store: {l.store_code}</span>}
                        <span>
                          place_id:{' '}
                          {l.place_id ? (
                            <span style={{ color: 'var(--color-moss-dark)' }}>
                              {l.place_id.slice(0, 20)}…
                            </span>
                          ) : (
                            <em style={{ color: 'var(--color-ember-dark)' }}>pendiente</em>
                          )}
                        </span>
                      </div>
                    </div>
                    <div
                      className="font-[family-name:var(--font-mono)] text-[11px]"
                      style={{ color: 'var(--color-wood-light)' }}
                    >
                      {l.categoria || '—'}
                    </div>
                    <div>
                      {l.activo ? (
                        <span
                          className="rounded-[2px] px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                          style={{
                            background: 'var(--color-moss)',
                            color: 'var(--color-bone)',
                          }}
                        >
                          Activo
                        </span>
                      ) : (
                        <span
                          className="rounded-[2px] border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
                          style={{
                            borderColor: 'var(--color-wood-light)',
                            color: 'var(--color-wood-light)',
                          }}
                        >
                          Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
