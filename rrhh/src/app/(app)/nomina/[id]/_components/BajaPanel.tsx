'use client'
// Botón "Dar de baja" con panel inline (popover) de confirmación:
// fecha de egreso + motivo → darDeBaja. Maneja demo, error y pending.
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { TriangleAlert, UserRoundX, X } from 'lucide-react'
import { darDeBaja } from '@/lib/actions'
import { Button, Field, Input, inputCls } from '@/components/ui/kit'
import { hoyIso } from '@/lib/format'

export function BajaPanel({ empleadoId, nombre }: { empleadoId: number; nombre: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fecha, setFecha] = useState(hoyIso())
  const [motivo, setMotivo] = useState('')
  const [demoAviso, setDemoAviso] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const abrir = () => {
    setOpen(o => !o)
    setError(null)
    setDemoAviso(false)
  }

  const confirmar = () => {
    setError(null)
    if (!motivo.trim()) {
      setError('Indicá el motivo de la baja.')
      return
    }
    startTransition(async () => {
      const res = await darDeBaja(empleadoId, fecha, motivo.trim())
      if (!res.ok) {
        setError(res.error ?? 'No se pudo registrar la baja.')
        return
      }
      if (res.demo) {
        setDemoAviso(true)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        icon={UserRoundX}
        className="text-bad hover:bg-bad-soft hover:text-bad"
        onClick={abrir}
      >
        Dar de baja
      </Button>

      {open && (
        <div className="rise absolute left-0 top-full z-20 mt-2 w-[19rem] rounded-card border border-line bg-surface p-4 shadow-pop sm:w-80">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-bad-soft text-bad">
                <TriangleAlert className="size-4" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">Dar de baja</p>
                <p className="mt-0.5 text-xs leading-snug text-ink-3">
                  {nombre} pasa a estado Egresado y sale de la nómina activa.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-black/5 hover:text-ink"
            >
              <X className="size-3.5" strokeWidth={2.25} />
            </button>
          </div>

          <div className="space-y-3">
            <Field label="Fecha de egreso">
              <Input type="date" value={fecha} required onChange={ev => setFecha(ev.target.value)} />
            </Field>
            <Field label="Motivo">
              <textarea
                rows={2}
                value={motivo}
                onChange={ev => setMotivo(ev.target.value)}
                placeholder="Renuncia, fin de contrato…"
                className={`${inputCls} h-auto resize-none py-2`}
              />
            </Field>

            {demoAviso && (
              <div className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand-strong">
                Modo demo: el cambio no se persiste.
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-bad-soft px-3 py-2 text-xs font-semibold text-bad">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="danger" size="sm" disabled={pending} onClick={confirmar}>
                {pending ? 'Procesando…' : 'Confirmar baja'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
