// Card de cumpleaños del mes (server component).
import { Cake } from 'lucide-react'
import { Avatar, Badge, Card, CardTitle, EmptyState } from '@/components/ui/kit'
import { fmtFechaCorta } from '@/lib/format'
import type { DashboardData } from '@/lib/types'

export function CumpleanosCard({ items }: { items: DashboardData['cumpleanosDelMes'] }) {
  return (
    <Card className="rise [animation-delay:240ms]">
      <CardTitle hint="Para no dejar pasar ningún festejo en los locales">
        Cumpleaños del mes
      </CardTitle>
      {items.length === 0 ? (
        <EmptyState
          icon={Cake}
          title="Sin cumpleaños este mes"
          hint="Nadie del equipo sopla velitas este mes."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map(c => (
            <li key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Avatar nombre={c.nombreCompleto} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{c.nombreCompleto}</p>
                <p className="truncate text-xs text-ink-3">{c.locacion ?? 'Sin locación'}</p>
              </div>
              <Badge tone="brand">{fmtFechaCorta(c.fecha)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
