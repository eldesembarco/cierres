'use client'
// Tabla de solicitudes con filtro por estado (chips, estado local) y
// aprobación/rechazo inline vía server action.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Palmtree, SearchX, X } from 'lucide-react'
import { Avatar, Button, Card, EmptyState, EstadoSolicitudBadge, TableShell, Td, Th } from '@/components/ui/kit'
import { resolverSolicitud } from '@/lib/actions'
import { fmtFecha } from '@/lib/format'
import type { EstadoSolicitud, Solicitud } from '@/lib/types'
import { TipoBadge } from './TipoBadge'

type Filtro = 'TODAS' | EstadoSolicitud

const FILTROS: { clave: Filtro; label: string; vacio: string }[] = [
  { clave: 'TODAS', label: 'Todas', vacio: '' },
  { clave: 'PENDIENTE', label: 'Pendientes', vacio: 'pendientes' },
  { clave: 'APROBADA', label: 'Aprobadas', vacio: 'aprobadas' },
  { clave: 'RECHAZADA', label: 'Rechazadas', vacio: 'rechazadas' },
]

export function SolicitudesTable({ solicitudes, colores }: {
  solicitudes: Solicitud[]
  colores: Record<number, string | null>
}) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('TODAS')
  const [actuandoId, setActuandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tono: 'demo' | 'error'; texto: string } | null>(null)
  const [pending, startTransition] = useTransition()

  if (!solicitudes.length) {
    return (
      <Card className="rise">
        <EmptyState
          icon={Palmtree}
          title="Todavía no hay solicitudes"
          hint="Cuando el equipo pida vacaciones, licencias u horas extra las vas a ver acá. Arrancá con «Nueva solicitud»."
        />
      </Card>
    )
  }

  const filtradas = filtro === 'TODAS' ? solicitudes : solicitudes.filter(s => s.estado === filtro)
  const labelVacio = FILTROS.find(f => f.clave === filtro)?.vacio ?? ''

  function resolver(id: number, decision: 'APROBADA' | 'RECHAZADA') {
    setActuandoId(id)
    setAviso(null)
    startTransition(async () => {
      const r = await resolverSolicitud(id, decision)
      if (r.demo) {
        setAviso({ tono: 'demo', texto: 'Modo demo: el cambio no se persiste.' })
      } else if (!r.ok) {
        setAviso({ tono: 'error', texto: r.error ?? 'No se pudo resolver la solicitud.' })
      } else {
        router.refresh()
      }
      setActuandoId(null)
    })
  }

  return (
    <div className="rise">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTROS.map(f => {
          const n = f.clave === 'TODAS' ? solicitudes.length : solicitudes.filter(s => s.estado === f.clave).length
          const activo = filtro === f.clave
          return (
            <button
              key={f.clave}
              type="button"
              onClick={() => setFiltro(f.clave)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                activo
                  ? 'border-coal bg-coal text-white'
                  : 'border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink'
              }`}
            >
              {f.label}
              <span className={`tnum ${activo ? 'text-white/60' : 'text-ink-3'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      {aviso && (
        <div
          className={
            aviso.tono === 'demo'
              ? 'mb-3 rounded-xl border border-dashed border-brand/40 bg-brand-soft px-4 py-2.5 text-xs font-semibold text-brand-strong'
              : 'mb-3 rounded-xl bg-bad-soft px-4 py-2.5 text-xs font-semibold text-bad'
          }
        >
          {aviso.texto}
        </div>
      )}

      {!filtradas.length ? (
        <Card>
          <EmptyState
            icon={SearchX}
            title={`No hay solicitudes ${labelVacio}`}
            hint="Probá con otro filtro para ver el resto del historial."
          />
        </Card>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Empleado</Th>
              <Th>Tipo</Th>
              <Th>Período</Th>
              <Th right>Días</Th>
              <Th>Estado</Th>
              <Th right>Acciones</Th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {filtradas.map(s => {
              const ocupada = pending && actuandoId === s.id
              return (
                <tr key={s.id} className="hover:bg-paper/50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar nombre={s.empleado} color={colores[s.empleadoId]} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink">{s.empleado}</div>
                        {s.empleadoLocacion && (
                          <div className="truncate text-[11px] text-ink-3">{s.empleadoLocacion}</div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td><TipoBadge tipo={s.tipo} /></Td>
                  <Td>
                    <div className="whitespace-nowrap text-ink-2">
                      {fmtFecha(s.desde)} <span className="text-ink-3">→</span> {fmtFecha(s.hasta)}
                    </div>
                    {s.observacion && (
                      <div className="mt-0.5 max-w-52 truncate text-[11px] text-ink-3" title={s.observacion}>
                        {s.observacion}
                      </div>
                    )}
                  </Td>
                  <Td right>
                    <span className="tnum font-bold text-ink">{s.dias}</span>
                  </Td>
                  <Td><EstadoSolicitudBadge estado={s.estado} /></Td>
                  <Td right>
                    {s.estado === 'PENDIENTE' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={Check}
                          disabled={pending}
                          onClick={() => resolver(s.id, 'APROBADA')}
                          title={`Aprobar la solicitud de ${s.empleado}`}
                        >
                          {ocupada ? '…' : 'Aprobar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={X}
                          disabled={pending}
                          onClick={() => resolver(s.id, 'RECHAZADA')}
                          title={`Rechazar la solicitud de ${s.empleado}`}
                        >
                          Rechazar
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
