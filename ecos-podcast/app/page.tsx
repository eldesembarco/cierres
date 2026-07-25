'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Mail } from 'lucide-react'
import { brand } from '@/lib/config/brand'
import { SectionHeading } from '@/components/SectionHeading'
import { EpisodeCard, type Episode } from '@/components/EpisodeCard'
import { StatBlock } from '@/components/StatBlock'
import { TeamCard } from '@/components/TeamCard'
import { Polaroid } from '@/components/Polaroid'
import { Stamp } from '@/components/Stamp'
import data from '@/data/episodes.json'
import team from '@/data/team.json'
import stats from '@/data/stats.json'

export default function HomePage() {
  const available = (data.episodes as Episode[]).filter((e) => e.status === 'available')
  const latest = available.slice(0, 4)

  return (
    <>
      <section className="spotlight-bg relative min-h-[92vh] overflow-hidden pt-24">
        <div className="container-page relative z-10 flex min-h-[80vh] flex-col items-center justify-center text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 1 }}
            className="eyebrow mb-6"
          >
            {brand.slogan}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
            className="max-w-4xl font-serif text-5xl leading-[1.05] text-cream-50 sm:text-6xl md:text-7xl"
          >
            Hay historias<br />
            <span className="italic text-gold-light">que cambian vidas.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="mt-6 max-w-xl font-serif text-xl italic text-cream-200/90 sm:text-2xl"
          >
            Algunas todavía no fueron contadas.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link href="/archivo" className="btn-gold">
              {brand.cta.exploreArchive} <ArrowRight size={16} />
            </Link>
            <Link href="/contacto" className="btn-ghost">
              {brand.cta.tellStory}
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-cream-400/60"
          >
            <span className="text-[10px] uppercase tracking-[0.4em]">Scroll</span>
            <ChevronDown size={18} className="animate-float-slow" />
          </motion.div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-900 to-transparent" />
      </section>

      <section className="border-y border-cream-400/10 bg-ink-800/60 py-20">
        <div className="container-page grid gap-10 md:grid-cols-2 md:items-center">
          <div className="text-center md:text-left">
            <p className="eyebrow mb-3">La comunidad</p>
            <h2 className="font-serif text-4xl leading-tight text-cream-50 md:text-5xl">
              Más de<br />
              <span className="text-gold">1.000.000</span><br />
              <span className="italic">de personas ya escucharon una historia.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-cream-200/70">
              Y seguimos creciendo. Cada episodio deja una huella, un pensamiento, un momento que se queda.
            </p>
            <div className="mt-6 flex items-center gap-2 justify-center md:justify-start">
              {latest.slice(0, 4).map((e) => (
                <img key={e.id} src={e.photo!} alt="" className="h-10 w-10 rounded-full border border-cream-400/20 object-cover" />
              ))}
              <div className="h-10 w-10 rounded-full border border-cream-400/20 bg-ink-700 flex items-center justify-center text-[10px] text-cream-200/70">+9</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard title="Historias" text="Conocé a quienes se animaron a contar." to="/archivo" />
            <StatCard title="Archivo" text="Explorá cada episodio, cartas, regalos y más." to="/archivo" />
            <StatCard title="Comunidad" text="Vení también vos a ser parte de esta historia." to="/comunidad" />
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="Últimas historias"
            title={<>Historias reales.<br /><span className="italic">Conversaciones que quedan.</span></>}
            subtitle="Cada persona tiene algo para contar. Cada historia, algo para enseñarnos."
          />
          <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {latest.map((e, i) => (
              <EpisodeCard key={e.id} episode={e} variant="home" index={i} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/archivo" className="btn-ghost">
              Ver todo el archivo <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-ink-800/40 py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="Lo que quedó"
            title={<>Más que un episodio.<br /><span className="italic">Recuerdos que se quedan.</span></>}
            subtitle="Cada historia deja algo. Acá vas a encontrar esas perlitas — con acceso al Archivo Completo."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <RemainsCard icon="✉" title="La Carta" text="La carta que le escribimos a cada invitado." />
            <RemainsCard icon="◱" title="Fotos inéditas" text="Detrás de escena y momentos que nadie vio." />
            <RemainsCard icon="♪" title="Audio exclusivo" text="Un audio que no salió al aire." />
            <RemainsCard icon="◯" title="Playlist" text="La banda de sonido de cada historia." />
          </div>
          <div className="mt-10 text-center">
            <Link href="/cuenta?upgrade=1" className="btn-gold">
              Sumate al Archivo Completo <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container-page">
          <div className="relative mx-auto max-w-4xl overflow-hidden border border-gold/30 bg-gradient-to-br from-ink-800/80 to-ink-700/60 p-10 md:p-14">
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-3 text-gold">
                  <Mail size={20} />
                  <span className="eyebrow">Contá tu historia</span>
                </div>
                <h3 className="mt-4 font-serif text-3xl italic text-cream-50 md:text-4xl">
                  ¿Y si la próxima historia es la tuya?
                </h3>
                <p className="mt-4 max-w-lg text-sm text-cream-200/80">
                  Nos encantaría escucharte. Contanos lo que te pasó, lo que aprendiste, o simplemente lo que necesitás decir.
                </p>
              </div>
              <Link href="/contacto" className="btn-gold whitespace-nowrap">
                Contanos <ArrowRight size={16} />
              </Link>
            </div>
            <div className="pointer-events-none absolute -right-6 -top-6 opacity-40">
              <Stamp />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink-800/40 py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="05 · Nosotros"
            title={<>Detrás de cada historia,<br /><span className="italic">hay un equipo que la hace posible.</span></>}
          />
          <div className="mt-14 grid grid-cols-2 gap-8 md:grid-cols-5">
            {team.members.map((m, i) => (
              <TeamCard key={m.name} member={m} index={i} />
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-cream-200/70">
            {brand.name} no es solo un podcast. Es un lugar seguro donde las historias se cuentan con respeto, profundidad y verdad.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/nosotros" className="btn-ghost">
              Conocé más sobre nosotros <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="La comunidad"
            title={<>Ya somos miles creyendo que<br /><span className="italic">las historias importan.</span></>}
          />
          <div className="mt-14 space-y-14">
            <StatBlock stats={stats.primary} />
            <StatBlock stats={stats.secondary} />
          </div>
        </div>
      </section>

      <section className="pb-32">
        <div className="container-page">
          <div className="relative mx-auto max-w-5xl overflow-hidden bg-ink-800/50 p-10 md:p-16">
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <div className="flex justify-center">
                <Polaroid
                  src="https://picsum.photos/seed/inv-polaroid/800/1000"
                  alt="Estudio"
                  caption="Bienvenida"
                  seed={7}
                  size="lg"
                />
              </div>
              <div>
                <p className="eyebrow mb-4">Un lugar</p>
                <h3 className="font-serif text-4xl italic text-cream-50 md:text-5xl">
                  Donde las historias<br />
                  <span className="hand-underline">se quedan.</span>
                </h3>
                <p className="mt-6 text-sm text-cream-200/80">
                  Bienvenida al archivo de {brand.name}. Cada polaroid, cada carta, cada objeto acá es real. Y sigue creciendo con vos.
                </p>
                <div className="mt-8">
                  <Link href="/archivo" className="btn-gold">
                    {brand.cta.exploreArchive} <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function StatCard({ title, text, to }: { title: string; text: string; to: string }) {
  return (
    <Link
      href={to}
      className="group flex flex-col justify-between border border-cream-400/10 bg-ink-800/70 p-4 transition hover:border-gold/50"
    >
      <div>
        <div className="eyebrow text-gold/90">{title}</div>
        <p className="mt-3 text-xs text-cream-200/70">{text}</p>
      </div>
      <div className="mt-4 flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-cream-100/70 group-hover:text-gold">
        Ver más <ArrowRight size={12} />
      </div>
    </Link>
  )
}

function RemainsCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card-panel text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gold/50 text-2xl text-gold">
        {icon}
      </div>
      <div className="font-serif text-xl text-cream-50">{title}</div>
      <p className="mt-2 text-xs text-cream-200/70">{text}</p>
    </div>
  )
}
