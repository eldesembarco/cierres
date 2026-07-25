import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Stat = { label: string; value: string }

export function StatBlock({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-6 md:grid-cols-4', className)}>
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="text-center"
        >
          <div className="font-serif text-4xl text-cream-50 md:text-5xl">{s.value}</div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.3em] text-gold/80">{s.label}</div>
        </motion.div>
      ))}
    </div>
  )
}
