import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays, CheckCircle2, ChevronRight, Hourglass, Inbox, PenLine, Send, UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { getCatalogos, getInvitaciones, isDemo } from '@/lib/data'
import { fmtFecha, fmtFechaCorta } from '@/lib/format'
import type { EstadoInvitacion, Invitacion } from '@/lib/types'
import {
  Badge, Card, DemoBanner, EmptyState, EstadoInvitacionBadge, MarcaDot, PageHeader,
} from '@/components/ui/kit'
import { AprobarIngreso } from './_components/AprobarIngreso'
import { NuevaInvitacion } from './_components/NuevaInvitacion'

export const metadata = { title: 'Onboarding' }

type LocInfo = { marca: string | null; marcaColor: string | null }

function InvCard({ inv, loc, muted, children }: {
  inv: Invitacion
  loc?: LocInfo
  muted?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={`rise rounded-xl border border-line bg-surface p-3.5 shadow-card transition hover:border-line-strong hover:shadow-pop ${muted ? 'opacity-70 hover:opacity-100' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{inv.nombre ?? inv.email}</p>
          {inv.nombre && <p className="truncate text-xs text-ink-3">{inv.email}</p>}
        </div>
        <EstadoInvitacionBadge estado={inv.estado} />
      </div>

      <div className="mt-2.5 space-y-1">
        <p className="truncate text-xs font-semibold text-ink-2">{inv.posicion ?? 'Posición a definir'}</p>
        <MarcaDot marca={inv.locacion} color={loc?.marcaColor ?? null} />
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-ink-3">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="size-3" strokeWidth={2.25} />
          {fmtFechaCorta(inv.creadaEn)}
        </span>
        {inv.estado === 'EXPIRADA' ? (
          <span>Venció el {fmtFecha(inv.expiraEn)}</span>
        ) : inv.estado === 'ENVIADA' || inv.estado === 'EN_CURSO' ? (
          <span className="inline-flex items-center gap-1">
            <Hourglass className="size-3" strokeWidth={2.25} />
            vence {fmtFechaCorta(inv.expiraEn)}
          </span>
        ) : null}
      </div>

      {children}
    </div>
  )
}

export default async function OnboardingPage() {
  const [invitaciones, catalogos] = await Promise.all([getInvitaciones(), getCatalogos()])
  const demo = isDemo()

  const locPorId = new Map(catalogos.locaciones.map(l => [l.id, l]))
  const locDe = (inv: Invitacion): LocInfo | undefined =>
    inv.locacionId != null ? locPorId.get(inv.locacionId) : undefined

  const ordenadas = [...invitaciones].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
  const expiradas = ordenadas.filter(i => i.estado === 'EXPIRADA')

  const columnas: {
    estado: EstadoInvitacion
    titulo: string
    hint: string
    icon: LucideIcon
    chip: string
    vacio: string
    items: Invitacion[]
  }[] = [
    {
      estado: 'ENVIADA', titulo: 'Enviadas', hint: 'Link sin abrir todavía', icon: Send,
      chip: 'bg-info-soft text-info', vacio: 'No hay links esperando',
      items: ordenadas.filter(i => i.estado === 'ENVIADA'),
    },
    {
      estado: 'EN_CURSO', titulo: 'En curso', hint: 'El ingresante está cargando', icon: PenLine,
      chip: 'bg-warn-soft text-warn', vacio: 'Nadie cargando datos ahora',
      items: ordenadas.filter(i => i.estado === 'EN_CURSO'),
    },
    {
      estado: 'COMPLETADA', titulo: 'Para revisar', hint: 'Datos completos, falta aprobar', icon: Inbox,
      chip: 'bg-brand-soft text-brand', vacio: 'Sin altas para aprobar',
      items: ordenadas.filter(i => i.estado === 'COMPLETADA'),
    },
    {
      estado: 'APROBADA', titulo: 'Aprobadas', hint: 'Últimas 5 altas confirmadas', icon: CheckCircle2,
      chip: 'bg-ok-soft text-ok', vacio: 'Todavía no hay altas aprobadas',
      items: ordenadas.filter(i => i.estado === 'APROBADA').slice(0, 5),
    },
  ]

  const hayActivas = ordenadas.some(i => i.estado !== 'EXPIRADA')

  return (
    <>
      {demo && <DemoBanner />}
      <PageHeader
        title="Onboarding"
        icon={UserPlus}
        subtitle="Invitaciones de ingreso y altas pendientes de aprobar"
        actions={
          <NuevaInvitacion
            posiciones={catalogos.posiciones.map(p => ({ id: p.id, nombre: p.nombre }))}
            locaciones={catalogos.locaciones.map(l => ({ id: l.id, nombre: l.nombre, marca: l.marca }))}
          />
        }
      />

      {!hayActivas ? (
        <Card className="rise">
          <EmptyState
            icon={UserPlus}
            title="Todavía no hay invitaciones activas"
            hint="Creá la primera con el botón «Nueva invitación»: el ingresante recibe un link y carga sus datos solo, sin papeles."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columnas.map(col => (
            <section key={col.estado} className="flex flex-col gap-3">
              <header className="flex items-center gap-2.5 px-0.5">
                <div className={`flex size-7 items-center justify-center rounded-lg ${col.chip}`}>
                  <col.icon className="size-3.5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold tracking-tight text-ink">{col.titulo}</h2>
                    <span className="tnum rounded-full bg-black/5 px-1.5 py-px text-[10px] font-bold text-ink-2">
                      {col.items.length}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-ink-3">{col.hint}</p>
                </div>
              </header>

              {col.items.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line-strong/80 px-3 text-center text-[11px] font-semibold text-ink-3">
                  {col.vacio}
                </div>
              ) : (
                col.items.map(inv => (
                  <InvCard key={inv.id} inv={inv} loc={locDe(inv)}>
                    {inv.estado === 'COMPLETADA' && (
                      <AprobarIngreso invitacionId={inv.id} empleadoId={inv.empleadoId} />
                    )}
                    {inv.estado === 'APROBADA' && inv.empleadoId != null && (
                      <div className="mt-3 border-t border-line pt-2.5">
                        <Link
                          href={`/nomina/${inv.empleadoId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-strong"
                        >
                          Ver legajo
                          <ChevronRight className="size-3.5" strokeWidth={2.25} />
                        </Link>
                      </div>
                    )}
                  </InvCard>
                ))
              )}
            </section>
          ))}
        </div>
      )}

      {expiradas.length > 0 && (
        <details className="group mt-8">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-ink-2 select-none hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" strokeWidth={2.25} />
            Invitaciones expiradas
            <Badge tone="neutral">{expiradas.length}</Badge>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {expiradas.map(inv => (
              <InvCard key={inv.id} inv={inv} loc={locDe(inv)} muted />
            ))}
          </div>
        </details>
      )}
    </>
  )
}
