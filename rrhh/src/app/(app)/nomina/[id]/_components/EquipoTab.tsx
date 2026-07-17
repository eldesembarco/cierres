// Solapa Equipo: grid de reportes directos con link a cada legajo. Server Component.
import Link from 'next/link'
import { ChevronRight, UsersRound } from 'lucide-react'
import { Avatar, Card, EmptyState } from '@/components/ui/kit'
import type { EmpleadoDetalle } from '@/lib/types'

export function EquipoTab({ reportes }: { reportes: EmpleadoDetalle['reportes'] }) {
  if (!reportes.length) {
    return (
      <Card className="rise">
        <EmptyState
          icon={UsersRound}
          title="No tiene reportes directos"
          hint="Cuando otras personas reporten a este legajo, el equipo aparece acá."
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {reportes.map(r => (
        <Link key={r.id} href={`/nomina/${r.id}`} className="group block">
          <Card className="rise flex items-center gap-3.5 hover:border-line-strong hover:shadow-pop">
            <Avatar nombre={r.nombreCompleto} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink group-hover:text-brand-strong">{r.nombreCompleto}</p>
              <p className="truncate text-xs font-semibold text-ink-2">{r.posicion ?? '—'}</p>
              <p className="truncate text-[11px] text-ink-3">{r.locacion ?? '—'}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
          </Card>
        </Link>
      ))}
    </div>
  )
}
