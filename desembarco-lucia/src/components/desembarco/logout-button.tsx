'use client';

import { useTransition } from 'react';
import { signOut } from 'next-auth/react';

interface LogoutButtonProps {
  /** Variante de estilo según el contexto (sub-header oscuro vs topbar oscuro) */
  variant?: 'topbar' | 'subheader';
}

export function LogoutButton({ variant = 'subheader' }: LogoutButtonProps) {
  const [pending, startTransition] = useTransition();

  function onLogout() {
    startTransition(async () => {
      await signOut({ callbackUrl: '/login' });
    });
  }

  const styles =
    variant === 'topbar'
      ? {
          color: 'var(--color-paper-dark)',
          borderColor: 'var(--color-gold)',
        }
      : {
          color: 'var(--color-paper-dark)',
          borderColor: 'transparent',
        };

  return (
    <button
      onClick={onLogout}
      disabled={pending}
      className="border px-3 py-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] transition-colors hover:underline disabled:opacity-50"
      style={styles}
    >
      {pending ? '…' : 'Salir'}
    </button>
  );
}
