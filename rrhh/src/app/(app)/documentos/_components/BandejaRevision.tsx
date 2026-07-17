'use client'
// Bandeja de revisión: aprobar o rechazar (con observación inline) cada
// documento subido. Optimista: al resolver, la fila sale de la lista.
import { Fragment, useState, useTransition } from 'react'
import { AlertCircle, Check, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { revisarDocumento } from '@/lib/actions'
import { Button, Card, EmptyState, EstadoDocumentoBadge, Input, TableShell, Td, Th } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { Documento } from '@/lib/types'
import { DocCell, EmpleadoCell } from './celdas'

type Aviso = { tono: 'demo' | 'ok' | 'error'; texto: string }

// El kit no trae botón "ok" ni "danger suave": se extienden acá con su misma métrica
const accionCls =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50'

export function BandejaRevision({ documentos, onResuelto }: {
  documentos: Documento[]
  onResuelto: (id: number) => void
}) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [rechazoId, setRechazoId] = useState<number | null>(null)
  const [observacion, setObservacion] = useState('')
  const [enCursoId, setEnCursoId] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  function revisar(doc: Documento, decision: 'APROBADO' | 'RECHAZADO', obs?: string) {
    setAviso(null)
    setEnCursoId(doc.id)
    startTransition(async () => {
      const res = await revisarDocumento(doc.id, decision, obs)
      setEnCursoId(null)
      if (!res.ok) {
        setAviso({ tono: 'error', texto: res.error ?? 'No se pudo guardar la revisión. Probá de nuevo.' })
        return
      }
      const verbo = decision === 'APROBADO' ? 'aprobó' : 'rechazó'
      setAviso(
        res.demo
          ? { tono: 'demo', texto: `Modo demo: el cambio no se persiste. Se ${verbo} «${doc.tipo}» de ${doc.empleado} solo en pantalla.` }
          : { tono: 'ok', texto: `Se ${verbo} «${doc.tipo}» de ${doc.empleado}.` },
      )
      setRechazoId(null)
      setObservacion('')
      onResuelto(doc.id)
    })
  }

  return (
    <div>
      {aviso && <AvisoInline aviso={aviso} onCerrar={() => setAviso(null)} />}

      {documentos.length === 0 ? (
        <Card className="rise">
          <EmptyState
            icon={CheckCircle2}
            title="Todo revisado"
            hint="No queda ningún documento esperando validación. Cuando un empleado suba un archivo nuevo al legajo, va a aparecer acá."
          />
        </Card>
      ) : (
        <TableShell className="rise">
          <thead>
            <tr>
              <Th>Documento</Th>
              <Th>Empleado</Th>
              <Th>Subido</Th>
              <Th>Estado</Th>
              <Th right>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {documentos.map(doc => {
              const rechazando = rechazoId === doc.id
              const cargando = enCursoId === doc.id
              return (
                <Fragment key={doc.id}>
                  <tr className="transition-colors hover:bg-paper/60">
                    <Td><DocCell doc={doc} /></Td>
                    <Td><EmpleadoCell doc={doc} /></Td>
                    <Td className="tnum whitespace-nowrap text-xs text-ink-2">{fmtFecha(doc.subidoEn)}</Td>
                    <Td>
                      <EstadoDocumentoBadge estado={doc.estado} />
                      {doc.observacion && (
                        <div className="mt-1 max-w-52 truncate text-[11px] text-ink-3" title={doc.observacion}>
                          «{doc.observacion}»
                        </div>
                      )}
                    </Td>
                    <Td right className="whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => revisar(doc, 'APROBADO')}
                          disabled={cargando || rechazando}
                          title={`Aprobar ${doc.tipo} de ${doc.empleado}`}
                          className={`${accionCls} bg-ok text-white shadow-sm hover:bg-green-700`}
                        >
                          {cargando && !rechazando
                            ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                            : <Check className="size-3.5" strokeWidth={2.5} />}
                          Aprobar
                        </button>
                        <button
                          onClick={() => { setRechazoId(rechazando ? null : doc.id); setObservacion('') }}
                          disabled={cargando}
                          title={`Rechazar ${doc.tipo} de ${doc.empleado}`}
                          className={`${accionCls} border text-bad hover:border-bad/50 hover:bg-bad-soft ${
                            rechazando ? 'border-bad/50 bg-bad-soft' : 'border-bad/30 bg-surface'
                          }`}
                        >
                          <X className="size-3.5" strokeWidth={2.5} />
                          Rechazar
                        </button>
                      </div>
                    </Td>
                  </tr>

                  {rechazando && (
                    <tr className="bg-bad-soft/40">
                      <td colSpan={5} className="border-b border-line px-4 py-3">
                        <form
                          onSubmit={e => {
                            e.preventDefault()
                            if (observacion.trim()) revisar(doc, 'RECHAZADO', observacion.trim())
                          }}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="text-xs font-bold text-bad">Motivo del rechazo</span>
                          <Input
                            autoFocus
                            value={observacion}
                            onChange={e => setObservacion(e.target.value)}
                            placeholder="Ej.: la foto está ilegible, pedile que vuelva a subirla"
                            aria-label="Motivo del rechazo"
                            className="max-w-md flex-1"
                          />
                          <Button variant="danger" size="sm" type="submit" disabled={!observacion.trim() || cargando}>
                            {cargando
                              ? <Loader2 className="size-3.5 animate-spin" strokeWidth={2.25} />
                              : <X className="size-3.5" strokeWidth={2.5} />}
                            Confirmar rechazo
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => { setRechazoId(null); setObservacion('') }}
                          >
                            Cancelar
                          </Button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}

function AvisoInline({ aviso, onCerrar }: { aviso: Aviso; onCerrar: () => void }) {
  const estilos: Record<Aviso['tono'], string> = {
    demo: 'border-brand/30 bg-brand-soft text-brand-strong',
    ok: 'border-ok/25 bg-ok-soft text-ok',
    error: 'border-bad/25 bg-bad-soft text-bad',
  }
  const Icono = aviso.tono === 'error' ? AlertCircle : aviso.tono === 'ok' ? CheckCircle2 : Info
  return (
    <div
      role="status"
      className={`rise mb-3 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-semibold ${estilos[aviso.tono]}`}
    >
      <Icono className="size-4 shrink-0" strokeWidth={2.25} />
      <span className="flex-1">{aviso.texto}</span>
      <button onClick={onCerrar} aria-label="Cerrar aviso" className="rounded-md p-0.5 hover:bg-black/10">
        <X className="size-3.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}
