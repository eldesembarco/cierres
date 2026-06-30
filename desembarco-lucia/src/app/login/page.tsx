import { LoginForm } from './LoginForm';

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return (
    <main className="relative z-[1] mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-8">
      <div
        className="mb-8 grid h-16 w-16 place-items-center rounded-full border-4 border-double font-[family-name:var(--font-display)] text-3xl font-black"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, var(--color-gold-light), var(--color-gold) 50%, var(--color-ember-dark))',
          borderColor: 'var(--color-gold)',
          color: 'var(--color-ink)',
          boxShadow: '0 2px 0 rgba(0,0,0,0.4), inset 0 0 8px rgba(0,0,0,0.3)',
        }}
      >
        D
      </div>

      <h1
        className="text-center font-[family-name:var(--font-display)] text-3xl font-black tracking-[0.04em]"
        style={{ color: 'var(--color-wood)' }}
      >
        Iniciar sesión
      </h1>
      <p
        className="mt-2 text-center text-sm"
        style={{ color: 'var(--color-wood-light)' }}
      >
        Panel CM · El Desembarco LucIA
      </p>

      <LoginForm
        callbackUrl={params.callbackUrl ?? '/dashboard'}
        initialError={params.error}
      />
    </main>
  );
}
