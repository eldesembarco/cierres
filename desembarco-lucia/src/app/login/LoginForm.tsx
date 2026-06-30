'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

interface LoginFormProps {
  callbackUrl: string;
  initialError?: string;
}

export function LoginForm({ callbackUrl, initialError }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await signIn('credentials', {
        username: username.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Usuario o contraseña incorrectos');
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 w-full space-y-4 border p-8"
      style={{
        background: 'var(--color-bone)',
        borderColor: 'var(--color-paper-dark)',
      }}
    >
      <div>
        <label
          className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          Usuario
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          required
          disabled={pending}
          className="w-full border px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-paper-dark)',
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
          }}
        />
      </div>

      <div>
        <label
          className="mb-1 block font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em]"
          style={{ color: 'var(--color-wood-light)' }}
        >
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={pending}
          className="w-full border px-3 py-2 text-sm"
          style={{
            borderColor: 'var(--color-paper-dark)',
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
          }}
        />
      </div>

      {error && (
        <p
          className="border-l-[3px] px-3 py-2 text-xs"
          style={{
            borderColor: 'var(--color-ember)',
            background: 'rgba(200, 51, 30, 0.08)',
            color: 'var(--color-ember-dark)',
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !username || !password}
        className="w-full font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[0.1em] disabled:opacity-50"
        style={{
          background: 'var(--color-wood)',
          color: 'var(--color-bone)',
          padding: '10px',
        }}
      >
        {pending ? 'Verificando…' : 'Entrar'}
      </button>
    </form>
  );
}
