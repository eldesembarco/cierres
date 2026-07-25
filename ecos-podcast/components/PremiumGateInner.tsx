'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Lock, Sparkles, Loader2 } from 'lucide-react'

type Props = {
  children: React.ReactNode
  label?: string
  className?: string
  compact?: boolean
}

export function GateInner({ children, label = 'Contenido premium', className, compact = false }: Props) {
  const { isLoaded, isSignedIn } = useAuth()
  const [subscribed, setSubscribed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { setSubscribed(false); return }
    let cancelled = false
    fetch('/api/user/status')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSubscribed(!!d.active) })
      .catch(() => { if (!cancelled) setSubscribed(false) })
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn])

  if (subscribed === true) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <div className="pointer-events-none blur-md opacity-40 select-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/85 p-6 text-center backdrop-blur-sm">
        {subscribed === null && isSignedIn ? (
          <Loader2 size={20} className="animate-spin text-gold" />
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/50 text-gold">
              <Lock size={16} />
            </div>
            <p className="eyebrow">{label}</p>
            {!compact && (
              <p className="max-w-xs text-xs text-cream-200/70">
                Desbloqueá el <span className="text-gold">Archivo Completo</span> y accedé a los regalos ocultos, audios inéditos y detrás de escena de cada episodio.
              </p>
            )}
            <Link
              href={isSignedIn ? '/cuenta?upgrade=1' : '/sign-in?redirect_url=/cuenta?upgrade=1'}
              className="btn-gold mt-2 text-xs"
            >
              <Sparkles size={12} /> Desbloquear
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
