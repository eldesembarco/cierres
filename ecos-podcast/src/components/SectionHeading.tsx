import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

type Props = {
  eyebrow?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  align?: 'center' | 'left'
  className?: string
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'center', className }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(align === 'center' ? 'text-center' : 'text-left', 'max-w-3xl', align === 'center' && 'mx-auto', className)}
    >
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="font-serif text-3xl italic leading-tight text-cream-50 sm:text-4xl md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-sm text-cream-200/80 sm:text-base">{subtitle}</p>
      )}
      {align === 'center' && <div className="divider-line" />}
    </motion.header>
  )
}
