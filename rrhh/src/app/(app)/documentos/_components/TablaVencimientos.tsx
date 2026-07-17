// Vista de vencimientos: todo documento con fecha de vencimiento, ordenado
// por urgencia, con semáforo en el borde izquierdo de la fila.
import { CalendarCheck } from 'lucide-react'
import { Card, EmptyState, EstadoDocumentoBadge, TableShell, Td, Th } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { Documento } from '@/lib/types'
import { bordeVencimiento, DocCell, EmpleadoCell, VenceCell } from './celdas'

export function TablaVencimientos({ documentos }: { documentos: Documento[] }) {
  if (documentos.length === 0) {
    return (
      <Card className="rise">
        <EmptyState
          icon={CalendarCheck}
          title="Sin vencimientos a la vista"
          hint="Ningún documento del legajo tiene fecha de vencimiento cargada."
        />
      </Card>
    )
  }
  return (
    <TableShell className="rise">
      <thead>
        <tr>
          <Th>Documento</Th>
          <Th>Empleado</Th>
          <Th>Subido</Th>
          <Th>Vence</Th>
          <Th>Estado</Th>
        </tr>
      </thead>
      <tbody>
        {documentos.map(d => (
          <tr key={d.id} className="transition-colors hover:bg-paper/60">
            <Td className={bordeVencimiento(d.diasAlVencimiento)}>
              <DocCell doc={d} />
            </Td>
            <Td><EmpleadoCell doc={d} /></Td>
            <Td className="tnum whitespace-nowrap text-xs text-ink-2">{fmtFecha(d.subidoEn)}</Td>
            <Td><VenceCell doc={d} /></Td>
            <Td><EstadoDocumentoBadge estado={d.estado} /></Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  )
}
