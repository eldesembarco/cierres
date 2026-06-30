/**
 * Componentes UI compartidos: Avatar, RatingStars, RelativeTime, Badge.
 */

import { StarIcon } from './Icons';

// ────────── Avatar ──────────
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  // Color hash basado en el nombre — consistente para el mismo autor
  const hash = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = [
    'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200',
  ];
  const color = palette[hash % palette.length];

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-medium ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || '?'}
    </div>
  );
}

// ────────── Rating Stars ──────────
export function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const starClass = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const color =
    rating >= 4
      ? 'text-emerald-500'
      : rating === 3
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <div className="flex items-center gap-0.5" title={`${rating} estrellas`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <StarIcon
          key={s}
          filled={s <= rating}
          className={`${starClass} ${s <= rating ? color : 'text-zinc-300 dark:text-zinc-700'}`}
        />
      ))}
    </div>
  );
}

// ────────── Relative time ──────────
export function RelativeTime({ date }: { date: string }) {
  if (!date) return <span className="text-xs text-zinc-400">—</span>;

  const d = new Date(date);
  if (isNaN(d.getTime())) return <span className="text-xs text-zinc-400">{date.slice(0, 10)}</span>;

  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let text: string;
  if (diffDays < 0) text = d.toLocaleDateString('es-AR');
  else if (diffDays === 0) text = 'Hoy';
  else if (diffDays === 1) text = 'Ayer';
  else if (diffDays < 7) text = `Hace ${diffDays} días`;
  else if (diffDays < 30) text = `Hace ${Math.floor(diffDays / 7)} sem`;
  else if (diffDays < 365) text = `Hace ${Math.floor(diffDays / 30)} meses`;
  else text = `Hace ${Math.floor(diffDays / 365)} años`;

  return (
    <time
      dateTime={d.toISOString()}
      title={d.toLocaleDateString('es-AR', { dateStyle: 'long' })}
      className="text-xs text-zinc-500"
    >
      {text}
    </time>
  );
}

// ────────── Badge ──────────
type BadgeTone = 'neutral' | 'warning' | 'critical' | 'success' | 'brand-desembarco' | 'brand-tasty' | 'brand-mila';

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    warning: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    'brand-desembarco': 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
    'brand-tasty': 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    'brand-mila': 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ────────── Brand badge helper ──────────
export function brandTone(brand: string): BadgeTone {
  const b = (brand || '').toLowerCase();
  if (b.includes('desembarco')) return 'brand-desembarco';
  if (b.includes('tasty')) return 'brand-tasty';
  if (b.includes('mila')) return 'brand-mila';
  return 'neutral';
}

// ────────── Stars distribution mini-chart ──────────
export function StarsDistribution({
  data,
  total,
}: {
  data: Record<1 | 2 | 3 | 4 | 5, number>;
  total: number;
}) {
  const entries: { stars: 1 | 2 | 3 | 4 | 5; color: string }[] = [
    { stars: 5, color: 'bg-emerald-500' },
    { stars: 4, color: 'bg-emerald-300 dark:bg-emerald-600' },
    { stars: 3, color: 'bg-amber-400' },
    { stars: 2, color: 'bg-orange-400' },
    { stars: 1, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-1.5">
      {entries.map(({ stars, color }) => {
        const count = data[stars] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={stars} className="flex items-center gap-2 text-xs">
            <span className="w-7 text-right font-mono text-zinc-500">{stars}★</span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-12 text-right tabular-nums text-zinc-500">
              {count} <span className="text-zinc-400">({pct.toFixed(0)}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
