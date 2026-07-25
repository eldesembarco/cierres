import { cn } from '@/lib/utils'

type Props = { label?: string; className?: string; sealText?: string }

export function Envelope({ label, className, sealText = 'ECOS' }: Props) {
  return (
    <div className={cn('relative aspect-[4/3] w-full', className)}>
      <div className="kraft absolute inset-0 rounded-sm">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(45deg, transparent 48%, rgba(0,0,0,0.25) 50%, transparent 52%), linear-gradient(-45deg, transparent 48%, rgba(0,0,0,0.25) 50%, transparent 52%)',
            opacity: 0.4,
          }}
        />
        <div
          className="absolute left-0 right-0 top-0 h-1/2"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.15), transparent), linear-gradient(135deg, #7d6440 0%, #5b4930 100%)',
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
            boxShadow: 'inset 0 -6px 12px rgba(0,0,0,0.4)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 rounded-full flex items-center justify-center text-cream-100 font-serif text-sm"
          style={{
            background: 'radial-gradient(circle at 40% 35%, #b23a3a, #6b1414 70%)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.6), inset 0 -6px 8px rgba(0,0,0,0.4)',
          }}
        >
          {sealText}
        </div>
      </div>
      {label && (
        <div className="absolute -bottom-2 left-3 rotate-[-2deg] bg-cream-50 px-2 py-0.5 text-[10px] uppercase tracking-widest text-ink-900 shadow-md">
          {label}
        </div>
      )}
    </div>
  )
}
