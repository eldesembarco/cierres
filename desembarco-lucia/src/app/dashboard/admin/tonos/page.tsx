import { prisma } from '@/lib/prisma';
import { ToneEditor } from './ToneEditor';
import { Panel } from '@/components/desembarco/panel';
import { PageHero } from '@/components/desembarco/page-hero';

const SUGGESTED_BRANDS = ['El Desembarco', 'Mr Tasty', 'Mila & Go'];

function SectionHeading({ title, ornament }: { title: string; ornament?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3">
      {ornament && (
        <span
          className="font-[family-name:var(--font-display)] text-2xl"
          style={{ color: 'var(--color-gold)' }}
          aria-hidden
        >
          {ornament}
        </span>
      )}
      <h2
        className="font-[family-name:var(--font-display)] text-xl font-bold tracking-[0.04em]"
        style={{ color: 'var(--color-wood)' }}
      >
        {title}
      </h2>
      <span
        className="h-px flex-1"
        style={{
          background: 'linear-gradient(90deg, var(--color-paper-dark), transparent)',
        }}
      />
    </div>
  );
}

export default async function TonosPage() {
  let tones: { brand: string; voice: string; examples: string | null }[] = [];
  let dbError: string | null = null;

  try {
    tones = await prisma.brandTone.findMany({ orderBy: { brand: 'asc' } });
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const existingBrands = new Set(tones.map((t) => t.brand));
  const missing = SUGGESTED_BRANDS.filter((b) => !existingBrands.has(b));

  return (
    <>
      <PageHero
        breadcrumb={[
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Tonos' },
        ]}
        eyebrow="Admin · Voz de la marca"
        title="Tonos por marca"
        description="Voice y ejemplos que la IA usa al generar borradores. Se inyectan en cada prompt para mantener consistencia con cada marca."
      />

      {dbError && (
        <Panel className="mb-6">
          <div
            className="px-5 py-3 text-sm"
            style={{ color: 'var(--color-ember-dark)' }}
          >
            <strong>DB no disponible.</strong> Configurá <code>DATABASE_URL</code> y corré{' '}
            <code>npm run db:push</code>. Detalle: {dbError}
          </div>
        </Panel>
      )}

      {tones.length > 0 && (
        <>
          <SectionHeading title="Tonos configurados" ornament="✦" />
          <div className="space-y-4">
            {tones.map((t) => (
              <ToneEditor key={t.brand} initial={t} />
            ))}
          </div>
        </>
      )}

      {missing.length > 0 && !dbError && (
        <>
          <SectionHeading title="Marcas sin tono" ornament="⚠" />
          <p
            className="mb-4 text-sm"
            style={{ color: 'var(--color-wood-light)' }}
          >
            Marcas detectadas en el piloto que todavía no tienen voz configurada.
          </p>
          <div className="space-y-4">
            {missing.map((b) => (
              <ToneEditor
                key={b}
                isNew
                initial={{ brand: b, voice: '', examples: null }}
              />
            ))}
          </div>
        </>
      )}

      <SectionHeading title="Nueva marca" ornament="◇" />
      <ToneEditor isNew initial={{ brand: '', voice: '', examples: null }} />
    </>
  );
}
