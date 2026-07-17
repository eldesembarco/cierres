// Solapa Vacaciones: cards de saldo por año con barra de progreso. Server Component.
import { TreePalm } from 'lucide-react'
import { Badge, Card, EmptyState } from '@/components/ui/kit'
import type { VacacionSaldo } from '@/lib/types'

export function VacacionesTab({ saldos }: { saldos: VacacionSaldo[] }) {
  if (!saldos.length) {
    return (
      <Card className="rise">
        <EmptyState
          icon={TreePalm}
          title="Sin saldos de vacaciones"
          hint="Cuando se carguen los días correspondientes por año, los saldos aparecen acá."
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {saldos.map(s => {
        const disponibles = s.diasCorrespondientes - s.diasTomados
        const pct = s.diasCorrespondientes > 0
          ? Math.min(100, Math.round((s.diasTomados / s.diasCorrespondientes) * 100))
          : 0
        return (
          <Card key={s.id} className="rise">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
                Período <span className="tnum">{s.anio}</span>
              </span>
              {disponibles <= 0
                ? <Badge tone="neutral">Agotado</Badge>
                : <Badge tone="ok">{disponibles} disp.</Badge>}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="tnum text-4xl font-extrabold leading-none tracking-tight text-ink">{disponibles}</span>
              <span className="text-xs font-semibold text-ink-3">días disponibles</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
            <div className="tnum mt-2 flex items-center justify-between text-[11px] font-semibold text-ink-3">
              <span>{s.diasTomados} tomados</span>
              <span>{s.diasCorrespondientes} correspondientes</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
