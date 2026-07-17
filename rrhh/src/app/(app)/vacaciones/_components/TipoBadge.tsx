// Badge y etiquetas del tipo de solicitud. Sin 'use client': lo consumen
// tanto server components como los componentes interactivos de la ruta.
import { Badge } from '@/components/ui/kit'
import type { TipoSolicitud } from '@/lib/types'

export const TIPO_LABEL: Record<TipoSolicitud, string> = {
  VACACIONES: 'Vacaciones',
  ESTUDIO: 'Estudio',
  ENFERMEDAD: 'Enfermedad',
  HORAS_EXTRA: 'Horas extra',
  OTRO: 'Otro',
}

const TIPO_TONE: Record<TipoSolicitud, 'info' | 'bad' | 'brand' | 'neutral'> = {
  VACACIONES: 'info',
  ENFERMEDAD: 'bad',
  ESTUDIO: 'brand',
  HORAS_EXTRA: 'neutral',
  OTRO: 'neutral',
}

export function TipoBadge({ tipo }: { tipo: TipoSolicitud }) {
  return <Badge tone={TIPO_TONE[tipo]}>{TIPO_LABEL[tipo]}</Badge>
}
