// Primitivas de gráficos (SVG/HTML puro, server-safe). Reglas dataviz:
// marcas finas, gaps de 2px, etiquetas directas de valor (el ámbar lo exige),
// un solo eje, color por entidad, grid recesiva, texto en tintas de texto.
import { CHART_GRID } from '@/lib/palette'

const NF = new Intl.NumberFormat('es-AR')

/** Barras horizontales con etiqueta y valor directo. Ideal para rankings. */
export function BarList({ items, max: maxProp }: {
  items: { label: string; sub?: string | null; value: number; color: string }[]
  max?: number
}) {
  const max = maxProp ?? Math.max(1, ...items.map(i => i.value))
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-xs font-semibold text-ink-2">
              {it.label}
              {it.sub && <span className="ml-1.5 font-normal text-ink-3">{it.sub}</span>}
            </span>
            <span className="tnum text-xs font-bold text-ink">{NF.format(it.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
            <div
              className="h-full rounded-full transition-[width] duration-500 group-hover:opacity-80"
              style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, backgroundColor: it.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Barras verticales agrupadas (p. ej. altas vs bajas por mes). Un solo eje. */
export function GroupedBars({ data, series }: {
  data: { label: string; values: number[] }[]
  series: { name: string; color: string }[]
}) {
  const max = Math.max(1, ...data.flatMap(d => d.values))
  const H = 120
  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        {series.map(s => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-2">
            <span className="size-2 rounded-[3px]" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-1" style={{ height: H }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex flex-1 items-end justify-center gap-[2px]" title={`${d.label}: ${series.map((s, si) => `${s.name} ${d.values[si]}`).join(' · ')}`}>
            {d.values.map((v, si) => (
              <div
                key={si}
                className="w-full max-w-3 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{
                  height: v > 0 ? Math.max(3, (v / max) * (H - 18)) : 2,
                  backgroundColor: v > 0 ? series[si]!.color : CHART_GRID,
                }}
              />
            ))}
            <span className="pointer-events-none absolute -top-1 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block">
              {series.map((s, si) => `${d.values[si]}`).join(' / ')}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-semibold text-ink-3">{d.label}</span>
        ))}
      </div>
    </div>
  )
}

/** Donut con leyenda + valores directos. Gap de 2px entre segmentos. */
export function Donut({ items, centerLabel }: {
  items: { label: string; value: number; color: string }[]
  centerLabel?: string
}) {
  const total = Math.max(1, items.reduce((a, b) => a + b.value, 0))
  const R = 42
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={centerLabel}>
          <circle cx="60" cy="60" r={R} fill="none" stroke={CHART_GRID} strokeWidth="12" />
          {items.map((it, i) => {
            const frac = it.value / total
            const len = Math.max(0, frac * C - 2) // gap 2px
            const el = (
              <circle
                key={i}
                cx="60" cy="60" r={R} fill="none"
                stroke={it.color} strokeWidth="12"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform="rotate(-90 60 60)"
              >
                <title>{`${it.label}: ${NF.format(it.value)}`}</title>
              </circle>
            )
            offset += frac * C
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-xl font-extrabold text-ink">{NF.format(total)}</span>
          {centerLabel && <span className="text-[10px] font-semibold text-ink-3">{centerLabel}</span>}
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-ink-2">
              <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: it.color }} />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="tnum shrink-0 font-bold text-ink">
              {NF.format(it.value)}
              <span className="ml-1 font-semibold text-ink-3">{Math.round((it.value / total) * 100)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
