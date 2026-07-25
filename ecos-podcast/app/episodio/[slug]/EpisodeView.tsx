'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Play, Youtube, Music2, Clock, MapPin, Calendar, Share2, Download, ArrowLeft, ChevronRight,
  Instagram, Facebook, Link as LinkIcon,
} from 'lucide-react'
import { brand } from '@/lib/config/brand'
import { Polaroid } from '@/components/Polaroid'
import { Stamp } from '@/components/Stamp'
import { Envelope } from '@/components/Envelope'
import { PremiumGate } from '@/components/PremiumGate'
import { formatDate } from '@/lib/utils'

export function EpisodeView({ ep, available, upcoming }: { ep: any; available: any[]; upcoming: any[] }) {
  const share = (net: string) => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    const text = `"${ep.quote}" — ${ep.guest} · ${brand.name}`
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      instagram: brand.socials.instagram,
    }
    window.open(map[net], '_blank', 'noopener')
  }

  return (
    <section className="spotlight-bg pt-28 pb-10">
      <div className="container-page">
        <Link href="/archivo" className="mb-6 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-cream-200/60 hover:text-gold">
          <ArrowLeft size={12} /> Volver al archivo
        </Link>

        <div className="grid gap-10 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <h3 className="font-serif text-3xl text-cream-50">EL ARCHIVO</h3>
              <p className="mt-1 font-serif italic text-gold-light">Historias que quedan.</p>
              <p className="mt-4 text-xs text-cream-200/70">Cada historia deja una huella. Este es el lugar donde viven para siempre.</p>

              <div className="mt-6 flex gap-2">
                <button className="rounded-sm border border-gold bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-widest text-gold">Episodios</button>
                <button className="rounded-sm border border-cream-400/15 px-3 py-1 text-[10px] uppercase tracking-widest text-cream-200/70">Próximos</button>
              </div>

              <ul className="mt-6 space-y-2">
                {available.slice(0, 6).map((e) => {
                  const active = e.slug === ep.slug
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/episodio/${e.slug}`}
                        className={`flex items-center gap-3 border p-2 transition ${
                          active ? 'border-gold/60 bg-gold/5' : 'border-cream-400/10 hover:border-gold/40'
                        }`}
                      >
                        <img src={e.photo!} alt="" className="h-10 w-10 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-widest text-cream-200/60">EP. {e.number}</div>
                          <div className="truncate text-xs font-semibold text-cream-50">{e.guest.toUpperCase()}</div>
                          <div className="text-[10px] text-cream-200/50">Disponible</div>
                        </div>
                        {active && <ChevronRight size={14} className="text-gold" />}
                      </Link>
                    </li>
                  )
                })}

                {upcoming.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <div className="border border-cream-400/10 p-2 opacity-70">
                      <div className="text-[10px] uppercase tracking-widest text-cream-200/60">EP. {e.number}</div>
                      <div className="text-xs font-semibold text-cream-50">MUY PRONTO...</div>
                      <div className="mt-1 line-clamp-2 text-[10px] italic text-cream-200/60">&ldquo;{e.quote}&rdquo;</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div>
            <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
              <Polaroid src={ep.photo!} alt={ep.guest} caption={ep.guest} seed={ep.id} size="lg" />

              <div>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="border border-cream-400/20 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-cream-100/80">
                    Episodio {ep.number}
                  </span>
                  <div className="hidden md:block ml-auto">
                    <Stamp className="scale-75 opacity-70" />
                  </div>
                </div>

                <h1 className="font-serif text-5xl leading-none text-cream-50 md:text-6xl">
                  {ep.guest.toUpperCase()}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-[0.2em] text-cream-200/60">
                  {ep.date && <span className="inline-flex items-center gap-1.5"><Calendar size={12} />{formatDate(ep.date)}</span>}
                  {ep.duration && <span className="inline-flex items-center gap-1.5"><Clock size={12} />{ep.duration} hs</span>}
                  {ep.location && <span className="inline-flex items-center gap-1.5"><MapPin size={12} />{ep.location}</span>}
                  <span className="text-gold/80">·  {ep.role}</span>
                </div>

                <blockquote className="mt-8 border-l-2 border-gold pl-4">
                  <p className="font-serif text-2xl italic leading-snug text-cream-50 md:text-3xl">
                    &ldquo;{ep.quote}&rdquo;
                  </p>
                </blockquote>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a href={ep.youtube ?? '#'} target="_blank" rel="noreferrer" className="btn-gold">
                    <Play size={14} /> Ver episodio completo
                  </a>
                  <div className="flex items-center gap-2">
                    <a href={ep.youtube ?? '#'} target="_blank" rel="noreferrer" aria-label="YouTube"
                       className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600/90 text-white hover:bg-red-600">
                      <Youtube size={16} />
                    </a>
                    <a href={ep.spotify ?? '#'} target="_blank" rel="noreferrer" aria-label="Spotify"
                       className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/90 text-white hover:bg-green-600">
                      <Music2 size={16} />
                    </a>
                    <a href={ep.apple ?? '#'} target="_blank" rel="noreferrer" aria-label="Apple Podcasts"
                       className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600/90 text-white hover:bg-purple-600">
                      <Music2 size={16} />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-5">
              <div className="card-panel lg:col-span-2">
                <p className="eyebrow mb-3">Lo que pasó</p>
                <p className="text-sm leading-relaxed text-cream-100/90">{ep.summary}</p>
                <div className="mt-6 font-hand text-2xl text-gold/70">— {ep.guest.split(' ')[0]}</div>
              </div>

              <div className="card-panel lg:col-span-2">
                <p className="eyebrow mb-4">Frases que nos quedaron</p>
                <ul className="space-y-4">
                  {ep.moments.slice(0, 4).map((m: string, i: number) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="font-serif text-base italic text-cream-100/90"
                    >
                      <span className="mr-2 text-gold">&ldquo;</span>{m}
                    </motion.li>
                  ))}
                </ul>
              </div>

              <PremiumGate label="La carta (Archivo Completo)" className="card-panel flex flex-col lg:col-span-1">
                <div>
                  <p className="eyebrow mb-3">La carta</p>
                  <p className="text-xs text-cream-200/70">La carta que le escribimos. Para que la tengas siempre.</p>
                  <div className="mt-4">
                    <Envelope label="La carta" sealText={brand.name[0]} />
                  </div>
                  <a href={`/premium/${ep.slug}/carta.pdf`} className="mt-4 btn-ghost justify-center">
                    <Download size={12} /> Descargar carta
                  </a>
                </div>
              </PremiumGate>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <PremiumGate label="Regalos ocultos (Archivo Completo)" className="card-panel">
                <div>
                  <p className="eyebrow mb-3">Regalos ocultos</p>
                  <p className="text-xs text-cream-200/70">Cada episodio tiene algo especial para vos.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="aspect-square bg-gradient-to-br from-cream-200/10 to-cream-200/5 flex items-center justify-center text-2xl text-cream-300/60">◱</div>
                    <div className="aspect-square bg-gradient-to-br from-cream-200/10 to-cream-200/5 flex items-center justify-center text-2xl text-cream-300/60">◱</div>
                  </div>
                  <a href={`/premium/${ep.slug}/regalos.zip`} className="mt-4 btn-ghost w-full justify-center">
                    <Download size={12} /> Descargar contenido
                  </a>
                </div>
              </PremiumGate>

              <PremiumGate label="No salió al aire (Archivo Completo)" className="card-panel">
                <div>
                  <p className="eyebrow mb-3">Lo que no salió al aire</p>
                  <p className="text-xs text-cream-200/70">Un momento íntimo después de apagar las cámaras.</p>
                  <div className="mt-4 aspect-video overflow-hidden rounded-sm bg-ink-700 relative">
                    <img src={ep.extras?.photos?.[0]} alt="" className="h-full w-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/90 text-ink-900">
                        <Play size={22} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  <a href={`/premium/${ep.slug}/no-al-aire.mp4`} className="mt-4 btn-ghost w-full justify-center">
                    <Play size={12} /> Ver video
                  </a>
                </div>
              </PremiumGate>

              <div className="card-panel">
                <p className="eyebrow mb-3">Detrás del episodio</p>
                <p className="text-xs text-cream-200/70">Así fue el detrás de escena.</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {(ep.extras?.photos ?? []).slice(0, 3).map((src: string, i: number) => (
                    <div key={i} className="aspect-square overflow-hidden bg-ink-700">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {ep.extras?.object && (
                <div className="card-panel">
                  <p className="eyebrow mb-4">Objetos de su historia</p>
                  <p className="mb-4 text-xs text-cream-200/70">Cada objeto tiene una historia.</p>
                  <div className="flex items-start gap-4">
                    <div className="h-24 w-24 shrink-0 border border-cream-400/20 bg-ink-700 flex items-center justify-center text-cream-300/50 text-xs uppercase tracking-widest">
                      {ep.extras.object.name.split(' ')[0]}
                    </div>
                    <div>
                      <div className="font-serif text-lg text-cream-50">{ep.extras.object.name}</div>
                      <p className="mt-2 font-serif italic text-sm text-cream-200/80">
                        &ldquo;{ep.extras.object.note}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="card-panel">
                <p className="eyebrow mb-4">Compartí esta historia</p>
                <p className="mb-4 text-xs text-cream-200/70">Una historia vale más cuando se comparte.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => share('whatsapp')} className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/90 text-white hover:bg-green-600" aria-label="WhatsApp">
                    <Share2 size={16} />
                  </button>
                  <button onClick={() => share('instagram')} className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-600/90 text-white hover:bg-pink-600" aria-label="Instagram">
                    <Instagram size={16} />
                  </button>
                  <button onClick={() => share('x')} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-100/10 text-cream-100 hover:bg-cream-100/20" aria-label="X">
                    X
                  </button>
                  <button onClick={() => share('facebook')} className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700/90 text-white hover:bg-blue-700" aria-label="Facebook">
                    <Facebook size={16} />
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-100/10 text-cream-100 hover:bg-cream-100/20" aria-label="Copiar link">
                    <LinkIcon size={16} />
                  </button>
                </div>

                <div className="mt-6 rounded-sm border border-cream-400/10 bg-ink-900/40 p-3">
                  <p className="font-serif italic text-sm text-cream-100/90">&ldquo;{ep.quote}&rdquo;</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-gold/70">— {ep.guest}</p>
                </div>
              </div>
            </div>

            <p className="mt-16 text-center font-hand text-2xl text-gold/80">
              Detrás de cada historia, hay alguien que decidió ser real. Gracias por ser parte de esto. ♡
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
