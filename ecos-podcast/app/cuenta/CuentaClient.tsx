'use client'

import { useEffect, useState } from 'react'
import { SubscribeButton } from '@/components/SubscribeButton'
import { Check, Loader2, XCircle, Sparkles, RefreshCw } from 'lucide-react'

type Status = {
  active: boolean
  lastEvent: string | null
  activatedAt?: string | null
  cancelledAt?: string | null
}

export function CuentaClient({
  initialActive,
  initialLastEvent,
  price,
  mpReturn,
  upgradePrompt,
}: {
  initialActive: boolean
  initialLastEvent: string | null
  price: number
  mpReturn: boolean
  upgradePrompt: boolean
}) {
  const [status, setStatus] = useState<Status>({
    active: initialActive,
    lastEvent: initialLastEvent,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setRefreshing(true)
    try {
      const r = await fetch('/api/user/status', { cache: 'no-store' })
      const d = await r.json()
      setStatus({
        active: !!d.active,
        lastEvent: d.lastEvent,
        activatedAt: d.activatedAt,
        cancelledAt: d.cancelledAt,
      })
    } finally {
      setRefreshing(false)
    }
  }

  // Auto-refresh if user came back from MP
  useEffect(() => {
    if (mpReturn && !status.active) {
      let n = 0
      const iv = setInterval(async () => {
        n++
        await refresh()
        if (n >= 6) clearInterval(iv)
      }, 2500)
      return () => clearInterval(iv)
    }
  }, [mpReturn, status.active])

  const cancel = async () => {
    if (!confirm('¿Confirmás cancelar tu suscripción? Perderás el acceso al Archivo Completo al final del período pagado.')) return
    setCancelling(true)
    setError(null)
    try {
      const r = await fetch('/api/user/cancel', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error ?? 'Error al cancelar')
      await refresh()
    } catch (e: any) {
      setError(e?.message ?? 'Error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="mt-10">
      {mpReturn && !status.active && (
        <div className="mb-6 rounded-sm border border-gold/40 bg-gold/5 p-4 text-sm text-cream-100">
          Estamos confirmando tu pago con Mercado Pago. Puede tardar unos segundos.
          <button onClick={refresh} className="ml-3 inline-flex items-center gap-1 text-gold hover:underline">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      )}

      {status.active ? (
        <div className="card-panel">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 text-gold">
              <Check size={22} />
            </div>
            <div>
              <p className="eyebrow text-gold">Suscripción activa</p>
              <h2 className="mt-1 font-serif text-2xl text-cream-50">Sos parte del Archivo Completo</h2>
            </div>
          </div>
          <p className="mt-4 text-sm text-cream-200/80">
            Tenés acceso ilimitado a cartas, regalos ocultos, audios inéditos y detrás de escena de todos los episodios.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={refresh} className="btn-ghost" disabled={refreshing}>
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Actualizar estado
            </button>
            <button onClick={cancel} className="btn-ghost text-red-300 hover:text-red-400 hover:border-red-400/50" disabled={cancelling}>
              {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
              Cancelar suscripción
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className={`card-panel ${upgradePrompt ? 'border-gold/60 shadow-soft' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 text-gold">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="eyebrow text-gold">Archivo Completo</p>
              <h2 className="mt-1 font-serif text-2xl text-cream-50">Desbloqueá todo el contenido premium</h2>
            </div>
          </div>
          <ul className="mt-4 grid gap-2 text-sm text-cream-200/90 sm:grid-cols-2">
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 text-gold" />Cartas descargables</li>
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 text-gold" />Regalos ocultos por episodio</li>
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 text-gold" />Audio y video inéditos</li>
            <li className="flex items-start gap-2"><Check size={14} className="mt-0.5 text-gold" />Cancelás cuando quieras</li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-serif text-3xl text-cream-50">${price.toLocaleString('es-AR')}<span className="text-sm text-cream-200/60">/mes</span></div>
              <div className="text-[10px] uppercase tracking-widest text-cream-400/60">Pesos argentinos · vía Mercado Pago</div>
            </div>
            <SubscribeButton price={price} label="Suscribirme con Mercado Pago" />
          </div>
          {status.lastEvent && status.lastEvent !== 'created' && (
            <p className="mt-4 text-[11px] text-cream-400/60">Último evento: <span className="text-cream-200/80">{status.lastEvent}</span></p>
          )}
        </div>
      )}
    </div>
  )
}
