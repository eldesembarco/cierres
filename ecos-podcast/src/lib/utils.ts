export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Stable pseudo-random rotation based on a numeric seed */
export function tiltFromSeed(seed: number, max = 3): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  const frac = s - Math.floor(s)
  return (frac * 2 - 1) * max
}
