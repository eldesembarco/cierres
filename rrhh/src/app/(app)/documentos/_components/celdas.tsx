// Celdas y helpers compartidos por las tablas de la central de documentos.
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { Badge } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { Documento } from '@/lib/types'

/** Tipo de documento + nombre de archivo (linkeado si hay URL) o "Sin archivo" */
export function DocCell({ doc }: { doc: Documento }) {
  const archivo = doc.archivoNombre ? (
    <span className="flex min-w-0 items-center gap-1">
      <FileText className="size-3.5 shrink-0" strokeWidth={2} />
      <span className="truncate">{doc.archivoNombre}</span>
    </span>
  ) : null
  return (
    <div className="min-w-0 max-w-60">
      <div className="truncate text-sm font-semibold text-ink">{doc.tipo}</div>
      {archivo ? (
        doc.archivoUrl ? (
          <a
            href={doc.archivoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 block text-xs text-ink-3 hover:text-brand hover:underline"
            title={`Abrir ${doc.archivoNombre}`}
          >
            {archivo}
          </a>
        ) : (
          <div className="mt-0.5 text-xs text-ink-3">{archivo}</div>
        )
      ) : (
        <div className="mt-0.5 text-xs text-ink-3">Sin archivo</div>
      )}
    </div>
  )
}

/** Nombre del empleado (link al legajo) + locación chica */
export function EmpleadoCell({ doc }: { doc: Documento }) {
  return (
    <Link href={`/nomina/${doc.empleadoId}`} className="group/emp block min-w-0 max-w-52">
      <div className="truncate text-sm font-bold text-ink transition-colors group-hover/emp:text-brand">
        {doc.empleado}
      </div>
      {doc.empleadoLocacion && <div className="truncate text-xs text-ink-3">{doc.empleadoLocacion}</div>}
    </Link>
  )
}

/** Badge de urgencia según días al vencimiento */
export function VenceBadge({ dias }: { dias: number | null }) {
  if (dias === null) return null
  if (dias < 0) return <Badge tone="bad">Vencido hace {Math.abs(dias)} {Math.abs(dias) === 1 ? 'día' : 'días'}</Badge>
  if (dias === 0) return <Badge tone="bad">Vence hoy</Badge>
  if (dias <= 7) return <Badge tone="bad">En {dias} {dias === 1 ? 'día' : 'días'}</Badge>
  if (dias <= 30) return <Badge tone="warn">En {dias} días</Badge>
  return <Badge tone="neutral">En {dias} días</Badge>
}

/** Fecha de vencimiento + badge de urgencia (— si no vence) */
export function VenceCell({ doc }: { doc: Documento }) {
  if (!doc.vencimiento) return <span className="text-xs text-ink-3">—</span>
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="tnum text-sm font-semibold text-ink">{fmtFecha(doc.vencimiento)}</span>
      <VenceBadge dias={doc.diasAlVencimiento} />
    </div>
  )
}

/** Semáforo visual: borde izquierdo de la fila según urgencia */
export function bordeVencimiento(dias: number | null): string {
  if (dias === null) return 'border-l-2 border-l-transparent'
  if (dias <= 7) return 'border-l-2 border-l-bad'
  if (dias <= 30) return 'border-l-2 border-l-warn'
  return 'border-l-2 border-l-transparent'
}
