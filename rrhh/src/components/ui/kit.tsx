// UI kit compartido. Todas las páginas usan estas piezas — no duplicar estilos.
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { iniciales } from '@/lib/format'
import type { EstadoDocumento, EstadoEmpleado, EstadoInvitacion, EstadoSolicitud } from '@/lib/types'

const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ')

// ── Layout ──────────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, icon: Icon }: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-ink">
          {Icon && <Icon className="size-6 text-brand" strokeWidth={2.25} />}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className, pad = true }: {
  children: React.ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <div className={cx('rounded-card border border-line bg-surface shadow-card', pad && 'p-5', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, hint, actions }: {
  children: React.ReactNode
  hint?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-ink">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
      {actions}
    </div>
  )
}

// ── Acciones ────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const btnBase = 'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none'
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong shadow-sm',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink-3 hover:bg-paper',
  ghost: 'text-ink-2 hover:bg-black/5 hover:text-ink',
  danger: 'bg-bad text-white hover:bg-red-700',
}
const btnSizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3.5', lg: 'h-11 px-5' }

export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...props }: {
  variant?: BtnVariant
  size?: keyof typeof btnSizes
  icon?: LucideIcon
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cx(btnBase, btnStyles[variant], btnSizes[size], className)} {...props}>
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.25} />}
      {children}
    </button>
  )
}

export function ButtonLink({ href, variant = 'primary', size = 'md', icon: Icon, className, children }: {
  href: string
  variant?: BtnVariant
  size?: keyof typeof btnSizes
  icon?: LucideIcon
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={cx(btnBase, btnStyles[variant], btnSizes[size], className)}>
      {Icon && <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.25} />}
      {children}
    </Link>
  )
}

// ── Datos ───────────────────────────────────────────────────────────────────

export function Avatar({ nombre, color, size = 'md', className }: {
  nombre: string
  color?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = { sm: 'size-7 text-[10px]', md: 'size-9 text-xs', lg: 'size-11 text-sm', xl: 'size-16 text-lg' }
  return (
    <div
      className={cx('flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none', sizes[size], className)}
      style={{ backgroundColor: color || '#78716c' }}
      aria-hidden
    >
      {iniciales(nombre)}
    </div>
  )
}

export function Badge({ tone = 'neutral', children, dot }: {
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'brand'
  children: React.ReactNode
  dot?: boolean
}) {
  const tones = {
    neutral: 'bg-black/5 text-ink-2',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    info: 'bg-info-soft text-info',
    brand: 'bg-brand-soft text-brand-strong',
  }
  const dots = { neutral: 'bg-ink-3', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', brand: 'bg-brand' }
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold', tones[tone])}>
      {dot && <span className={cx('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}

export function EstadoEmpleadoBadge({ estado }: { estado: EstadoEmpleado }) {
  if (estado === 'ACTIVO') return <Badge tone="ok" dot>Activo</Badge>
  if (estado === 'ONBOARDING') return <Badge tone="info" dot>Onboarding</Badge>
  return <Badge tone="neutral" dot>Egresado</Badge>
}

export function EstadoDocumentoBadge({ estado }: { estado: EstadoDocumento }) {
  if (estado === 'APROBADO') return <Badge tone="ok">Aprobado</Badge>
  if (estado === 'PENDIENTE') return <Badge tone="warn">Pendiente</Badge>
  return <Badge tone="bad">Rechazado</Badge>
}

export function EstadoSolicitudBadge({ estado }: { estado: EstadoSolicitud }) {
  if (estado === 'APROBADA') return <Badge tone="ok">Aprobada</Badge>
  if (estado === 'PENDIENTE') return <Badge tone="warn">Pendiente</Badge>
  return <Badge tone="bad">Rechazada</Badge>
}

export function EstadoInvitacionBadge({ estado }: { estado: EstadoInvitacion }) {
  const map: Record<EstadoInvitacion, React.ReactNode> = {
    ENVIADA: <Badge tone="info" dot>Enviada</Badge>,
    EN_CURSO: <Badge tone="warn" dot>En curso</Badge>,
    COMPLETADA: <Badge tone="brand" dot>Para revisar</Badge>,
    APROBADA: <Badge tone="ok" dot>Aprobada</Badge>,
    EXPIRADA: <Badge tone="neutral" dot>Expirada</Badge>,
  }
  return map[estado]
}

export function MarcaDot({ marca, color }: { marca: string | null; color: string | null }) {
  if (!marca) return <span className="text-xs text-ink-3">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: color ?? '#78716c' }} />
      {marca}
    </span>
  )
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'neutral', href }: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: LucideIcon
  tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'info'
  href?: string
}) {
  const iconTones = {
    neutral: 'bg-black/5 text-ink-2',
    brand: 'bg-brand-soft text-brand',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    info: 'bg-info-soft text-info',
  }
  const inner = (
    <Card className={cx('rise flex items-center gap-4', href && 'hover:border-line-strong hover:shadow-pop')}>
      <div className={cx('flex size-11 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}>
        <Icon className="size-5" strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <div className="tnum text-2xl font-extrabold leading-none tracking-tight text-ink">{value}</div>
        <div className="mt-1 truncate text-xs font-semibold text-ink-2">{label}</div>
        {sub && <div className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</div>}
      </div>
    </Card>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

export function EmptyState({ icon: Icon, title, hint, children }: {
  icon: LucideIcon
  title: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-black/5 text-ink-3">
        <Icon className="size-6" strokeWidth={2} />
      </div>
      <p className="text-sm font-bold text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-3">{hint}</p>}
      {children}
    </div>
  )
}

// ── Formularios ─────────────────────────────────────────────────────────────

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold text-ink-2">
      {children}
    </label>
  )
}

export const inputCls = 'h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-3'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(inputCls, 'appearance-none pr-8 bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23a19c96%27 stroke-width=%272.5%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[position:right_10px_center] bg-no-repeat', props.className)}>
      {children}
    </select>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// ── Tablas ──────────────────────────────────────────────────────────────────

export function TableShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto rounded-card border border-line bg-surface shadow-card', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className, right }: { children?: React.ReactNode; className?: string; right?: boolean }) {
  return (
    <th className={cx('whitespace-nowrap border-b border-line bg-paper/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3', right ? 'text-right' : 'text-left', className)}>
      {children}
    </th>
  )
}

export function Td({ children, className, right }: { children?: React.ReactNode; className?: string; right?: boolean }) {
  return (
    <td className={cx('border-b border-line px-4 py-2.5 align-middle', right && 'text-right', className)}>
      {children}
    </td>
  )
}

// ── Aviso modo demo ─────────────────────────────────────────────────────────

export function DemoBanner() {
  return (
    <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-dashed border-brand/40 bg-brand-soft px-4 py-2.5 text-xs font-semibold text-brand-strong">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-brand" />
      </span>
      Modo demo con datos de ejemplo — los cambios no se guardan. Conectá la base para operar en serio.
    </div>
  )
}
