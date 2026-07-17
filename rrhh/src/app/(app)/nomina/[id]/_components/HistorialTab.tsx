// Solapa Historial: timeline vertical de puestos. Server Component.
import { History } from 'lucide-react'
import { Badge, Card, CardTitle, EmptyState } from '@/components/ui/kit'
import { fmtAntiguedad, fmtFecha } from '@/lib/format'
import type { HistorialPuesto } from '@/lib/types'

function mesesEntre(desdeIso: string, hastaIso: string | null): number {
  const desde = new Date(desdeIso)
  const hasta = hastaIso ? new Date(hastaIso) : new Date()
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / (30.44 * 86400000)))
}

const duracion = (h: HistorialPuesto) => {
  const m = mesesEntre(h.desde, h.hasta)
  return m < 1 ? 'menos de un mes' : fmtAntiguedad(m)
}

export function HistorialTab({ historial }: { historial: HistorialPuesto[] }) {
  if (!historial.length) {
    return (
      <Card className="rise">
        <EmptyState
          icon={History}
          title="Sin historial de puestos"
          hint="Los cambios de posición y departamento van a quedar registrados acá."
        />
      </Card>
    )
  }

  return (
    <Card className="rise">
      <CardTitle hint="Del puesto más reciente al más antiguo">Recorrido en el grupo</CardTitle>
      <ol className="relative ml-2 space-y-7 border-l-2 border-line pl-6">
        {historial.map(h => {
          const vigente = h.hasta === null
          return (
            <li key={h.id} className="relative">
              <span
                aria-hidden
                className={[
                  'absolute -left-8 top-1 size-3.5 rounded-full border-2 border-surface',
                  vigente ? 'bg-brand shadow-[0_0_0_4px_rgba(232,89,12,0.15)]' : 'bg-line-strong',
                ].join(' ')}
              />
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-ink">{h.posicion}</p>
                {vigente && <Badge tone="ok">Actual</Badge>}
              </div>
              {h.departamento && <p className="mt-0.5 text-xs font-semibold text-ink-2">{h.departamento}</p>}
              <p className="tnum mt-1 text-xs text-ink-3">
                {fmtFecha(h.desde)} — {h.hasta ? fmtFecha(h.hasta) : 'presente'}
                <span className="ml-1.5">· {duracion(h)}</span>
              </p>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
