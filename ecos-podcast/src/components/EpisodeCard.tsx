import { Link } from 'react-router-dom'
import { Lock, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type Episode = {
  id: number
  number: string
  slug: string
  guest: string
  role: string
  quote: string
  photo: string | null
  status: 'available' | 'coming-soon'
  hint?: string | null
}

type Props = {
  episode: Episode
  variant?: 'archive' | 'compact' | 'home'
  index?: number
}

export function EpisodeCard({ episode, variant = 'archive', index = 0 }: Props) {
  const isComingSoon = episode.status === 'coming-soon'

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: (index % 6) * 0.06 }}
      className={cn(
        'group relative overflow-hidden border border-cream-400/10 bg-ink-800/70 transition',
        !isComingSoon && 'hover:border-gold/50',
      )}
    >
      {isComingSoon ? (
        <div className="p-5">
          <p className="eyebrow text-gold/80">Próximamente</p>
          <p className="mt-6 font-serif text-lg italic leading-snug text-cream-100">
            "{episode.quote}"
          </p>
          <p className="mt-6 text-xs text-cream-200/60">
            <span className="text-gold">Pista:</span> {episode.hint}
          </p>
          <div className="mt-6 flex items-center gap-2 text-cream-400/40">
            <Lock size={14} />
            <span className="text-[10px] uppercase tracking-widest">Bloqueado</span>
          </div>
          <div className="absolute right-3 top-3 rounded-sm border border-cream-400/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-cream-200/60">
            EP. {episode.number}
          </div>
        </div>
      ) : (
        <Link to={`/episodio/${episode.slug}`} className="block">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink-700">
            <img
              src={episode.photo!}
              alt={episode.guest}
              loading="lazy"
              className="h-full w-full object-cover grayscale-[10%] contrast-105 transition duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
            <div className="absolute left-3 top-3 rounded-sm border border-cream-400/15 bg-ink-900/60 px-2 py-0.5 text-[10px] uppercase tracking-widest text-cream-100/80 backdrop-blur">
              EP. {episode.number}
            </div>
            {variant === 'archive' && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-sm border border-gold/40 bg-ink-900/60 px-2 py-1 text-[10px] text-gold/90 backdrop-blur">
                <FileText size={12} /> Historia
              </div>
            )}
          </div>
          <div className="px-4 py-4">
            <div className="text-sm font-semibold uppercase tracking-[0.15em] text-cream-50">
              {episode.guest}
            </div>
            <p className="mt-2 line-clamp-2 font-serif text-sm italic text-cream-200/80">
              "{episode.quote}"
            </p>
          </div>
        </Link>
      )}
    </motion.article>
  )
}
