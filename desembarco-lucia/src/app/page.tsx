import Link from 'next/link';

export default function Home() {
  return (
    <main className="relative z-[1] mx-auto flex min-h-[90vh] max-w-3xl flex-col items-start justify-center px-8 py-16">
      <div
        className="mb-3 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em]"
        style={{ color: 'var(--color-ember-dark)' }}
      >
        <span>Panel · v1.0</span>
        <span
          className="h-px flex-1"
          style={{ background: 'linear-gradient(90deg, var(--color-ember-dark), transparent)' }}
        />
      </div>

      <h1
        className="font-[family-name:var(--font-display)] text-6xl font-black leading-none tracking-[-0.01em] sm:text-7xl"
        style={{ color: 'var(--color-wood)' }}
      >
        El Desembarco{' '}
        <span
          className="font-medium italic"
          style={{ color: 'var(--color-ember)' }}
        >
          LucIA
        </span>
      </h1>

      <p
        className="mt-6 max-w-[640px] text-lg leading-relaxed"
        style={{ color: 'var(--color-wood-light)' }}
      >
        Panel de gestión para Community Managers.
        <br />
        Reseñas de Google, borradores inteligentes, alertas tempranas.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em]"
          style={{
            background: 'var(--color-wood)',
            color: 'var(--color-bone)',
            padding: '14px 24px',
          }}
        >
          Entrar al panel
        </Link>
        <Link
          href="/login"
          className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em]"
          style={{
            border: '1px solid var(--color-wood)',
            color: 'var(--color-wood)',
            padding: '14px 24px',
          }}
        >
          Iniciar sesión
        </Link>
      </div>

      <div
        className="mt-16 grid w-full gap-4 sm:grid-cols-2"
      >
        <FeatureCard ornament="◆" title="Inbox CM">
          Cola de reseñas pendientes con borradores IA listos para revisar.
        </FeatureCard>
        <FeatureCard ornament="◇" title="Auto-respuesta">
          Las 5★ positivas se responden solas. Las negativas, esperan al CM.
        </FeatureCard>
        <FeatureCard ornament="✦" title="Comparativa de proveedores">
          Cerebras · Groq · OpenRouter · Gemini, side by side.
        </FeatureCard>
        <FeatureCard ornament="⚠" title="Alertas tempranas">
          Picos de reseñas negativas, caídas de visibilidad, problemas recurrentes.
        </FeatureCard>
      </div>

      <p
        className="mt-12 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em]"
        style={{ color: 'var(--color-wood-light)' }}
      >
        Parte 1: Google Business Profile + IA · Parte 2 (Meta) próximamente
      </p>
    </main>
  );
}

function FeatureCard({
  title,
  children,
  ornament,
}: {
  title: string;
  children: React.ReactNode;
  ornament: string;
}) {
  return (
    <div
      className="border p-5"
      style={{
        background: 'var(--color-bone)',
        borderColor: 'var(--color-paper-dark)',
      }}
    >
      <div
        className="mb-3 font-[family-name:var(--font-display)] text-2xl"
        style={{ color: 'var(--color-gold)' }}
      >
        {ornament}
      </div>
      <h3
        className="font-[family-name:var(--font-display)] text-base font-bold tracking-[0.04em]"
        style={{ color: 'var(--color-wood)' }}
      >
        {title}
      </h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-wood-light)' }}>
        {children}
      </p>
    </div>
  );
}
