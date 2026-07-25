import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Mail, Heart } from 'lucide-react'
import { brand } from '@/config/brand'
import { SectionHeading } from '@/components/SectionHeading'
import { StatBlock } from '@/components/StatBlock'
import stats from '@/data/stats.json'

export function Community() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  const encode = (data: Record<string, string>) =>
    Object.keys(data).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(data[k])).join('&')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('sending')
    const form = e.currentTarget
    const data = new FormData(form)
    const payload: Record<string, string> = { 'form-name': 'newsletter' }
    data.forEach((v, k) => (payload[k] = String(v)))
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload),
      })
      setStatus(res.ok ? 'ok' : 'error')
      if (res.ok) form.reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <Helmet>
        <title>Comunidad · {brand.name}</title>
      </Helmet>
      <section className="spotlight-bg pt-32 pb-16">
        <div className="container-page text-center">
          <p className="eyebrow mb-4">La comunidad</p>
          <h1 className="font-serif text-5xl leading-none text-cream-50 md:text-7xl">
            Ya somos miles creyendo que<br />
            <span className="italic text-gold-light">las historias importan.</span>
          </h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page space-y-16">
          <StatBlock stats={stats.primary} />
          <StatBlock stats={stats.secondary} />
        </div>
      </section>

      <section className="bg-ink-800/40 py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="Suscribite"
            title={<>Sé parte del <span className="italic">Archivo.</span></>}
            subtitle="Enterate antes que nadie quiénes son los próximos invitados y recibí contenido exclusivo."
          />
          <form
            name="newsletter"
            data-netlify="true"
            netlify-honeypot="bot-field"
            onSubmit={onSubmit}
            className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <input type="hidden" name="form-name" value="newsletter" />
            <p className="hidden">
              <label>No completar: <input name="bot-field" /></label>
            </p>
            <div className="relative flex-1">
              <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-200/50" />
              <input
                type="email"
                name="email"
                required
                placeholder="tu@email.com"
                className="w-full rounded-sm border border-cream-400/15 bg-ink-900/70 py-3 pl-9 pr-3 text-sm text-cream-100 placeholder:text-cream-400/50 focus:border-gold focus:outline-none"
              />
            </div>
            <button type="submit" className="btn-gold justify-center" disabled={status === 'sending'}>
              {status === 'sending' ? 'Enviando…' : 'Suscribirme'} <Heart size={14} />
            </button>
          </form>
          {status === 'ok' && (
            <p className="mt-4 text-center text-sm text-gold">¡Listo! Ya sos parte del Archivo. ♡</p>
          )}
          {status === 'error' && (
            <p className="mt-4 text-center text-sm text-red-400">Hubo un problema. Probá otra vez en unos minutos.</p>
          )}
        </div>
      </section>
    </>
  )
}
