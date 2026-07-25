'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Lock, Sparkles, Loader2, Info } from 'lucide-react'
import { CLERK_ACTIVE_CLIENT } from '@/lib/env'
import { GateInner } from './PremiumGateInner'

type Props = {
  children: React.ReactNode
  label?: string
  className?: string
  compact?: boolean
}

export function PremiumGate({ children, label = 'Contenido premium', className, compact = false }: Props) {
  if (!CLERK_ACTIVE_CLIENT) {
    return (
      <div className={`relative ${className ?? ''}`}>
        <div className="pointer-events-none blur-md opacity-40 select-none">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/85 p-6 text-center backdrop-blur-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/50 text-gold">
            <Info size={16} />
          </div>
          <p className="eyebrow">{label}</p>
          <p className="max-w-xs text-xs text-cream-200/70">
            Muy pronto vas a poder desbloquearlo. Suscribite a la newsletter para enterarte.
          </p>
          <Link href="/comunidad" className="btn-ghost mt-2 text-[10px]">
            <Sparkles size={12} /> Enterarme
          </Link>
        </div>
      </div>
    )
  }
  return <GateInner children={children} label={label} className={className} compact={compact} />
}
