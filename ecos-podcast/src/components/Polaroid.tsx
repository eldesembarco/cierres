import { cn, tiltFromSeed } from '@/lib/utils'

type Props = {
  src: string
  alt: string
  caption?: string
  seed?: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showTape?: boolean
}

export function Polaroid({ src, alt, caption, seed = 1, className, size = 'md', showTape = true }: Props) {
  const rotation = tiltFromSeed(seed, 2.5)
  const dims = {
    sm: 'w-40',
    md: 'w-56 sm:w-64',
    lg: 'w-72 sm:w-80 md:w-96',
  }[size]

  return (
    <div
      className={cn('polaroid-tilt relative inline-block', dims, className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {showTape && <div className="tape" />}
      <div className="bg-cream-50 p-3 pb-14 shadow-polaroid">
        <div className="aspect-[4/5] w-full overflow-hidden bg-ink-700">
          <img src={src} alt={alt} className="h-full w-full object-cover grayscale-[15%] contrast-105" loading="lazy" />
        </div>
        {caption && (
          <p className="mt-3 text-center font-hand text-2xl leading-none text-ink-900">
            {caption}
          </p>
        )}
      </div>
    </div>
  )
}
