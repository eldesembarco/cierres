import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { brand } from '@/config/brand'
import { SectionHeading } from '@/components/SectionHeading'
import { EpisodeCard, type Episode } from '@/components/EpisodeCard'
import data from '@/data/episodes.json'

export function Archive() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('Todos')

  const filtered = useMemo(() => {
    return (data.episodes as Episode[]).filter((e) => {
      const inCat = cat === 'Todos' || (e as any).category === cat
      const query = q.trim().toLowerCase()
      const inQ = !query ||
        e.guest.toLowerCase().includes(query) ||
        e.quote.toLowerCase().includes(query) ||
        e.number.includes(query)
      return inCat && inQ
    })
  }, [q, cat])

  const available = filtered.filter((e) => e.status === 'available')
  const coming = filtered.filter((e) => e.status === 'coming-soon')

  return (
    <>
      <Helmet>
        <title>El Archivo · {brand.name}</title>
        <meta name="description" content="Explorá todas las historias del archivo de ECOS." />
      </Helmet>

      <section className="spotlight-bg pt-32 pb-16">
        <div className="container-page text-center">
          <p className="eyebrow mb-4">Bienvenidx a</p>
          <h1 className="font-serif text-5xl leading-none text-cream-50 md:text-7xl">
            EL ARCHIVO<br />
            <span className="italic text-gold-light">de {brand.name}</span>
          </h1>
          <p className="mt-6 font-serif text-xl italic text-cream-200/80">
            {brand.slogan}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm text-cream-200/70">
            Cada episodio deja una huella. Acá reunimos todas las historias que pasaron por {brand.name}.
          </p>
        </div>
      </section>

      {/* filters */}
      <section className="border-y border-cream-400/10 bg-ink-800/40 py-6">
        <div className="container-page flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {data.categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-sm border px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
                  cat === c
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-cream-400/15 text-cream-200/70 hover:border-gold/50 hover:text-cream-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-200/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar invitado o episodio..."
              className="w-full rounded-sm border border-cream-400/15 bg-ink-900/70 py-2 pl-9 pr-3 text-xs text-cream-100 placeholder:text-cream-400/50 focus:border-gold focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page">
          {available.length > 0 && (
            <>
              <p className="eyebrow mb-6">Disponibles · {available.length}</p>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {available.map((e, i) => (
                  <EpisodeCard key={e.id} episode={e} index={i} />
                ))}
              </div>
            </>
          )}

          {coming.length > 0 && (
            <div className="mt-20">
              <p className="eyebrow mb-6">Próximamente</p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {coming.map((e, i) => (
                  <EpisodeCard key={e.id} episode={e} index={i} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-16 text-center text-sm text-cream-200/70"
            >
              No encontramos nada con esos criterios. Probá con otra búsqueda o categoría.
            </motion.p>
          )}

          <p className="mt-24 text-center font-hand text-2xl text-gold/80">
            Gracias por ser parte de estas historias que nos cambian. ♡
          </p>
        </div>
      </section>
    </>
  )
}
