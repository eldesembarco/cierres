// Card de próximos vencimientos documentales (server component).
import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Badge, Card, CardTitle, EmptyState } from '@/components/ui/kit'
import { fmtFechaCorta } from '@/lib/format'
import type { Documento } from '@/lib/types'

function DiasBadge({ dias }: { dias: number }) {
  if (dias < 0) return <Badge tone="bad" dot>Vencido</Badge>
  if (dias === 0) return <Badge tone="bad" dot>Hoy</Badge>
  if (dias <= 7) return <Badge tone="bad">{dias} d</Badge>
  if (dias <= 30) return <Badge tone="warn">{dias} d</Badge>
  return <Badge tone="neutral">{dias} d</Badge>
}

export function VencimientosCard({ items }: { items: Documento[] }) {
  return (
    <Card className="rise [animation-delay:180ms]">
      <CardTitle
        hint="Documentación que vence dentro de los próximos 45 días"
        actions={
          <Link
            href="/documentos"
            className="text-xs font-bold text-brand hover:text-brand-strong"
          >
            Ver todos
          </Link>
        }
      >
        Próximos vencimientos
      </CardTitle>
      {items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nada por vencer"
          hint="Ningún documento del equipo vence en los próximos 45 días. Todo en regla."
        />
      ) : (
        <ul className="divide-y divide-line">
          {items.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{d.tipo}</p>
                <p className="truncate text-xs text-ink-3">
                  {d.empleado}
                  {d.empleadoLocacion && <span> · {d.empleadoLocacion}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="tnum text-xs font-semibold text-ink-2">{fmtFechaCorta(d.vencimiento)}</span>
                <DiasBadge dias={d.diasAlVencimiento ?? 0} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
