'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Send } from 'lucide-react'
import { Envelope } from '@/components/Envelope'

export default function ContactPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('sending')
    const form = e.currentTarget
    const data = new FormData(form)
    const payload: Record<string, string> = {}
    data.forEach((v, k) => (payload[k] = String(v)))
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) router.push('/gracias')
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <section className="spotlight-bg pt-32 pb-10">
        <div className="container-page text-center">
          <p className="eyebrow mb-4">Contá tu historia</p>
          <h1 className="font-serif text-5xl leading-none text-cream-50 md:text-6xl">
            La próxima historia<br />
            <span className="italic text-gold-light">puede ser la tuya.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-sm text-cream-200/70">
            No hace falta ser famosx. Ni tener un final feliz. Solo animarte a contar. Nosotros leemos todo, con respeto y confidencialidad.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page">
          <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[auto_1fr] md:items-start">
            <div className="hidden md:block w-72">
              <Envelope label="Tu carta" />
              <p className="mt-6 font-hand text-2xl text-gold/80 text-center">
                Contanos lo que necesités contar.
              </p>
            </div>

            <form onSubmit={onSubmit} className="card-panel space-y-5">
              <div>
                <label className="eyebrow mb-2 block">Nombre</label>
                <input name="nombre" required className="w-full rounded-sm border border-cream-400/15 bg-ink-900/70 px-3 py-2.5 text-sm text-cream-100 focus:border-gold focus:outline-none" />
              </div>

              <div>
                <label className="eyebrow mb-2 block">Email</label>
                <div className="relative">
                  <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-200/50" />
                  <input type="email" name="email" required className="w-full rounded-sm border border-cream-400/15 bg-ink-900/70 py-2.5 pl-9 pr-3 text-sm text-cream-100 focus:border-gold focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="eyebrow mb-2 block">Asunto</label>
                <input name="asunto" placeholder="¿De qué querés hablar?" className="w-full rounded-sm border border-cream-400/15 bg-ink-900/70 px-3 py-2.5 text-sm text-cream-100 focus:border-gold focus:outline-none" />
              </div>

              <div>
                <label className="eyebrow mb-2 block">Tu historia</label>
                <textarea name="historia" required rows={7} placeholder="Contanos lo que necesités..." className="w-full rounded-sm border border-cream-400/15 bg-ink-900/70 px-3 py-2.5 text-sm text-cream-100 focus:border-gold focus:outline-none" />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-cream-400/70">Con cuidado. Con respeto. Con tiempo.</p>
                <button type="submit" className="btn-gold" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Enviando…' : 'Enviar'} <Send size={14} />
                </button>
              </div>
              {status === 'error' && (
                <p className="text-sm text-red-400">Ocurrió un error. Probá de nuevo en unos minutos.</p>
              )}
            </form>
          </div>
        </div>
      </section>
    </>
  )
}
