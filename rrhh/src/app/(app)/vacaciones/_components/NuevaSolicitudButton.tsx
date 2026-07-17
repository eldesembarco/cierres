'use client'
// Botón de header + panel modal para cargar una solicitud nueva.
// Los días finales los calcula el server: acá solo se anticipa el conteo.
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Plus, X } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui/kit'
import { crearSolicitud } from '@/lib/actions'
import type { TipoSolicitud } from '@/lib/types'
import { TIPO_LABEL } from './TipoBadge'

export interface EmpleadoOption {
  id: number
  nombre: string
  locacion: string | null
}

export function NuevaSolicitudButton({ empleados }: { empleados: EmpleadoOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [empleadoId, setEmpleadoId] = useState('')
  const [tipo, setTipo] = useState<TipoSolicitud>('VACACIONES')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [observacion, setObservacion] = useState('')
  const [aviso, setAviso] = useState<{ tono: 'demo' | 'error'; texto: string } | null>(null)

  // Anticipo de días corridos (desde y hasta inclusive); -1 = rango inválido
  const dias = useMemo(() => {
    if (!desde || !hasta) return null
    const diff = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000)
    return diff < 0 ? -1 : diff + 1
  }, [desde, hasta])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function abrir() {
    setEmpleadoId('')
    setTipo('VACACIONES')
    setDesde('')
    setHasta('')
    setObservacion('')
    setAviso(null)
    setOpen(true)
  }

  const valido = empleadoId !== '' && dias !== null && dias > 0

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido || pending) return
    setAviso(null)
    startTransition(async () => {
      const r = await crearSolicitud({
        empleadoId: Number(empleadoId),
        tipo,
        desde,
        hasta,
        observacion: observacion.trim() || undefined,
      })
      if (r.demo) {
        setAviso({ tono: 'demo', texto: 'Modo demo: el cambio no se persiste.' })
      } else if (!r.ok) {
        setAviso({ tono: 'error', texto: r.error ?? 'No se pudo crear la solicitud.' })
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <>
      <Button icon={Plus} onClick={abrir}>Nueva solicitud</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-coal/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nueva solicitud"
            className="rise relative w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-pop"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-ink">Nueva solicitud</h2>
                <p className="mt-0.5 text-xs text-ink-3">Vacaciones, licencias y novedades del equipo.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink-3 hover:bg-black/5 hover:text-ink"
                aria-label="Cerrar"
              >
                <X className="size-4.5" strokeWidth={2.25} />
              </button>
            </div>

            <form onSubmit={enviar} className="grid gap-4">
              <Field label="Empleado">
                <Select value={empleadoId} onChange={e => setEmpleadoId(e.target.value)} required>
                  <option value="">Elegí un empleado…</option>
                  {empleados.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}{e.locacion ? ` — ${e.locacion}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tipo">
                <Select value={tipo} onChange={e => setTipo(e.target.value as TipoSolicitud)}>
                  {(Object.keys(TIPO_LABEL) as TipoSolicitud[]).map(t => (
                    <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                  ))}
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Desde">
                  <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} required />
                </Field>
                <Field label="Hasta">
                  <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} required />
                </Field>
              </div>

              <div className="min-h-4 text-xs" aria-live="polite">
                {dias === -1 && (
                  <span className="font-semibold text-bad">La fecha «hasta» no puede ser anterior a «desde».</span>
                )}
                {dias !== null && dias > 0 && (
                  <span className="text-ink-3">
                    Serán <span className="tnum font-bold text-ink-2">{dias}</span> {dias === 1 ? 'día corrido' : 'días corridos'}.
                  </span>
                )}
              </div>

              <Field label="Observación">
                <textarea
                  value={observacion}
                  onChange={e => setObservacion(e.target.value)}
                  rows={3}
                  placeholder="Opcional: detalle o motivo"
                  className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3"
                />
              </Field>

              {aviso && (
                <div
                  className={
                    aviso.tono === 'demo'
                      ? 'rounded-xl border border-dashed border-brand/40 bg-brand-soft px-3.5 py-2.5 text-xs font-semibold text-brand-strong'
                      : 'rounded-xl bg-bad-soft px-3.5 py-2.5 text-xs font-semibold text-bad'
                  }
                >
                  {aviso.texto}
                </div>
              )}

              <div className="mt-1 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" icon={CalendarPlus} disabled={!valido || pending}>
                  {pending ? 'Creando…' : 'Crear solicitud'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
