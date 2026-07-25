'use client'

import { SectionHeading } from '@/components/SectionHeading'
import { StatBlock } from '@/components/StatBlock'
import { SubscribeButton } from '@/components/SubscribeButton'
import stats from '@/data/stats.json'
import { Sparkles, Check } from 'lucide-react'

export default function CommunityPage() {
  const price = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_ARS ?? '1500')

  return (
    <>
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
            eyebrow="Archivo completo"
            title={<>Sumate al <span className="italic">Archivo</span></>}
            subtitle={`Por $${price.toLocaleString('es-AR')} al mes desbloqueás todo el contenido premium: cartas, regalos ocultos, audios inéditos, detrás de escena. Cancelás cuando quieras.`}
          />
          <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
            <ul className="space-y-3 text-sm text-cream-200/90">
              {[
                'La carta escrita para cada invitado (PDF)',
                'Regalos ocultos: fotos inéditas y descargables',
                'Audio exclusivo: lo que no salió al aire',
                'Video sin cortes del detrás de escena',
                'Playlist curada por episodio',
                'Cancelás cuando quieras desde tu cuenta',
              ].map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-gold" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col justify-center items-center gap-4 border border-gold/40 bg-ink-900/50 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/50 text-gold">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="font-serif text-4xl text-cream-50">${price.toLocaleString('es-AR')}<span className="text-base text-cream-200/60">/mes</span></div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-cream-400/70">Acceso completo · Cancelación en 1 click</div>
              </div>
              <SubscribeButton price={price} label="Suscribirme con Mercado Pago" />
              <p className="text-[10px] text-cream-400/60">Cobros vía Mercado Pago · Tarjeta, débito o saldo MP</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
