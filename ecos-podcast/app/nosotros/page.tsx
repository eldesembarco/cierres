'use client'

import { brand } from '@/lib/config/brand'
import { SectionHeading } from '@/components/SectionHeading'
import { TeamCard } from '@/components/TeamCard'
import { Polaroid } from '@/components/Polaroid'
import team from '@/data/team.json'

export default function TeamPage() {
  return (
    <>
      <section className="spotlight-bg pt-32 pb-16">
        <div className="container-page text-center">
          <p className="eyebrow mb-4">05 · Nosotros</p>
          <h1 className="font-serif text-5xl leading-none text-cream-50 md:text-7xl">
            Detrás de cada historia,<br />
            <span className="italic text-gold-light">un equipo.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm text-cream-200/70">
            No buscamos respuestas. Buscamos verdad. {brand.name} nace de la idea de que las mejores charlas
            pasan cuando somos reales. Somos un equipo que ama contar historias con respeto y cuidado.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-5">
            {team.members.map((m, i) => (
              <TeamCard key={m.name} member={m} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-800/40 py-24">
        <div className="container-page">
          <SectionHeading
            eyebrow="Nuestro manifiesto"
            title={<>Contar historias es<br /><span className="italic">un acto de cuidado.</span></>}
          />
          <div className="mx-auto mt-14 grid max-w-4xl gap-10 md:grid-cols-[auto_1fr] md:items-center">
            <Polaroid src="https://picsum.photos/seed/team-polaroid/800/1000" alt="Equipo" caption="Equipo" seed={11} size="md" />
            <div className="space-y-4 text-cream-200/90">
              <p>Creemos que las mejores conversaciones se dan cuando alguien se anima a bajar la guardia. Nuestro trabajo es sostener ese espacio.</p>
              <p>No hay clickbait. No hay guiones cerrados. Hay preguntas, silencios, tiempo. Y una cámara que no busca captar el efecto, sino el momento.</p>
              <p className="font-hand text-2xl text-gold/80">Historias reales. Conversaciones que quedan.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
