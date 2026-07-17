'use client'
// Vista completa del archivo documental, con filtro de texto en el cliente.
import { useState } from 'react'
import { FolderOpen, Search, SearchX } from 'lucide-react'
import { Card, EmptyState, EstadoDocumentoBadge, Input, TableShell, Td, Th } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { Documento } from '@/lib/types'
import { DocCell, EmpleadoCell, VenceCell } from './celdas'

export function TablaTodos({ documentos }: { documentos: Documento[] }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const filas = query
    ? documentos.filter(d => `${d.empleado} ${d.tipo}`.toLowerCase().includes(query))
    : documentos

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
            strokeWidth={2}
          />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por empleado o tipo…"
            aria-label="Buscar documento"
            className="pl-9"
          />
        </div>
        <span className="tnum text-xs font-semibold text-ink-3">
          {filas.length === documentos.length
            ? `${documentos.length} documentos`
            : `${filas.length} de ${documentos.length} documentos`}
        </span>
      </div>

      {filas.length === 0 ? (
        <Card className="rise">
          {documentos.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Sin documentos"
              hint="Todavía no se subió ningún documento al legajo digital."
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              hint={`No encontramos documentos que coincidan con «${q.trim()}». Probá con otro nombre o tipo.`}
            />
          )}
        </Card>
      ) : (
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
            {filas.map(d => (
              <tr key={d.id} className="transition-colors hover:bg-paper/60">
                <Td><DocCell doc={d} /></Td>
                <Td><EmpleadoCell doc={d} /></Td>
                <Td className="tnum whitespace-nowrap text-xs text-ink-2">{fmtFecha(d.subidoEn)}</Td>
                <Td><VenceCell doc={d} /></Td>
                <Td><EstadoDocumentoBadge estado={d.estado} /></Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
