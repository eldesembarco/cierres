// Solapa Documentos: resumen + tabla del legajo documental. Server Component.
import { FileText, FolderOpen } from 'lucide-react'
import { Badge, Card, EmptyState, EstadoDocumentoBadge, TableShell, Td, Th } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { Documento } from '@/lib/types'

function vencimientoBadge(dias: number | null) {
  if (dias === null) return null
  if (dias < 0) return <Badge tone="bad">Vencido hace {Math.abs(dias)} d</Badge>
  if (dias === 0) return <Badge tone="warn">Vence hoy</Badge>
  if (dias <= 30) return <Badge tone="warn">Vence en {dias} d</Badge>
  return null
}

export function DocumentosTab({ documentos }: { documentos: Documento[] }) {
  if (!documentos.length) {
    return (
      <Card className="rise">
        <EmptyState
          icon={FolderOpen}
          title="Sin documentos en el legajo"
          hint="Cuando el empleado suba su documentación o RRHH la cargue, va a aparecer acá."
        />
      </Card>
    )
  }

  const aprobados = documentos.filter(d => d.estado === 'APROBADO').length
  const pendientes = documentos.filter(d => d.estado === 'PENDIENTE').length
  const rechazados = documentos.filter(d => d.estado === 'RECHAZADO').length
  const porVencer = documentos.filter(d => d.diasAlVencimiento !== null && d.diasAlVencimiento <= 30).length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="ok">{aprobados} aprobados</Badge>
        <Badge tone="warn">{pendientes} pendientes</Badge>
        {rechazados > 0 && <Badge tone="bad">{rechazados} rechazados</Badge>}
        <Badge tone={porVencer > 0 ? 'bad' : 'neutral'}>{porVencer} por vencer</Badge>
        <span className="tnum ml-auto text-xs font-semibold text-ink-3">
          {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}
        </span>
      </div>

      <TableShell className="rise">
        <thead>
          <tr>
            <Th>Tipo</Th>
            <Th>Archivo</Th>
            <Th>Vencimiento</Th>
            <Th>Estado</Th>
            <Th>Observación</Th>
          </tr>
        </thead>
        <tbody>
          {documentos.map(d => (
            <tr key={d.id} className="hover:bg-paper/60">
              <Td className="font-semibold text-ink">{d.tipo}</Td>
              <Td>
                {d.archivoNombre ? (
                  <span className="inline-flex max-w-56 items-center gap-1.5">
                    <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={2} />
                    {d.archivoUrl ? (
                      <a
                        href={d.archivoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-semibold text-ink hover:text-brand-strong hover:underline"
                      >
                        {d.archivoNombre}
                      </a>
                    ) : (
                      <span className="truncate font-semibold text-ink">{d.archivoNombre}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-ink-3">Sin archivo</span>
                )}
              </Td>
              <Td>
                {d.vencimiento ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="tnum text-xs font-semibold text-ink-2">{fmtFecha(d.vencimiento)}</span>
                    {vencimientoBadge(d.diasAlVencimiento)}
                  </span>
                ) : (
                  <span className="text-ink-3">—</span>
                )}
              </Td>
              <Td><EstadoDocumentoBadge estado={d.estado} /></Td>
              <Td>
                {d.observacion
                  ? <span className="text-xs text-ink-2">{d.observacion}</span>
                  : <span className="text-ink-3">—</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  )
}
