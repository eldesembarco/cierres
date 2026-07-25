import { cn } from '@/lib/utils'
import { brand } from '@/config/brand'

export function Stamp({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-gold/60 text-gold/80 opacity-80',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 animate-flicker">
        <defs>
          <path id="stamp-arc" d="M 100,100 m -70,0 a 70,70 0 1,1 140,0 a 70,70 0 1,1 -140,0" />
        </defs>
        <text fontSize="16" fontFamily="Cormorant Garamond, serif" fill="currentColor" letterSpacing="4">
          <textPath xlinkHref="#stamp-arc" startOffset="0">
            {`${brand.name.toUpperCase()} · ${brand.tagline.toUpperCase()} · `}
          </textPath>
        </text>
      </svg>
      <div className="text-center font-serif text-xl leading-tight">
        <div>{brand.name}</div>
        <div className="text-[9px] uppercase tracking-[0.3em] text-gold/70">{brand.tagline}</div>
      </div>
    </div>
  )
}
