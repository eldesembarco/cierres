// Solapa Solicitudes: tabla de licencias y pedidos del empleado. Server Component.
import { CalendarClock } from 'lucide-react'
import { Badge, Card, EmptyState, EstadoSolicitudBadge, TableShell, Td, Th } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { Solicitud, TipoSolicitud } from '@/lib/types'

const TIPO: Record<TipoSolicitud, { label: string; tone: 'brand' | 'info' | 'warn' | 'neutral' }> = {
  VACACIONES: { label: 'Vacaciones', tone: 'brand' },
  ESTUDIO: { label: 'Estudio', tone: 'info' },
  ENFERMEDAD: { label: 'Enfermedad', tone: 'warn' },
  HORAS_EXTRA: { label: 'Horas extra', tone: 'neutral' },
  OTRO: { label: 'Otro', tone: 'neutral' },
}

export function SolicitudesTab({ solicitudes }: { solicitudes: Solicitud[] }) {
  if (!solicitudes.length) {
    return (
      <Card className="rise">
        <EmptyState
          icon={CalendarClock}
          title="Sin solicitudes"
          hint="Vacaciones, licencias y otros pedidos del empleado van a aparecer acá."
        />
      </Card>
    )
  }

  return (
    <TableShell className="rise">
      <thead>
        <tr>
          <Th>Tipo</Th>
          <Th>Período</Th>
          <Th right>Días</Th>
          <Th>Estado</Th>
          <Th>Observación</Th>
        </tr>
      </thead>
      <tbody>
        {solicitudes.map(s => {
          const tipo = TIPO[s.tipo]
          return (
            <tr key={s.id} className="hover:bg-paper/60">
              <Td><Badge tone={tipo.tone}>{tipo.label}</Badge></Td>
              <Td>
                <span className="tnum text-xs font-semibold text-ink-2">
                  {fmtFecha(s.desde)} <span className="text-ink-3">→</span> {fmtFecha(s.hasta)}
                </span>
              </Td>
              <Td right className="tnum font-bold text-ink">{s.dias}</Td>
              <Td><EstadoSolicitudBadge estado={s.estado} /></Td>
              <Td>
                {s.observacion
                  ? <span className="text-xs text-ink-2">{s.observacion}</span>
                  : <span className="text-ink-3">—</span>}
              </Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}
