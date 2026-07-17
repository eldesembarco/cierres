'use client'
// Botón "Nueva invitación" + modal: crea la invitación y entrega el link
// /ingreso/[token] listo para copiar y mandar al ingresante.
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, Copy, Link2, Loader2, Plus, X } from 'lucide-react'
import { crearInvitacion } from '@/lib/actions'
import { Button, Field, Input, Select } from '@/components/ui/kit'

export function NuevaInvitacion({ posiciones, locaciones }: {
  posiciones: { id: number; nombre: string }[]
  locaciones: { id: number; nombre: string; marca: string | null }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [posicionId, setPosicionId] = useState('')
  const [locacionId, setLocacionId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creada, setCreada] = useState<{ token: string; demo: boolean } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [pending, startTransition] = useTransition()

  function cerrar() {
    setOpen(false)
    setCreada(null)
    setCopiado(false)
    setError(null)
    setEmail('')
    setNombre('')
    setPosicionId('')
    setLocacionId('')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await crearInvitacion({
        email,
        nombre: nombre.trim() || undefined,
        posicionId: posicionId ? Number(posicionId) : undefined,
        locacionId: locacionId ? Number(locacionId) : undefined,
      })
      if (!res.ok) {
        setError(res.error ?? 'No se pudo crear la invitación')
        return
      }
      setCreada({ token: res.token ?? '', demo: !!res.demo })
      if (!res.demo) router.refresh()
    })
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // sin permiso de clipboard: el usuario puede seleccionar el texto a mano
    }
  }

  const url = creada
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/ingreso/${creada.token}`
    : ''

  return (
    <>
      <Button icon={Plus} onClick={() => setOpen(true)}>Nueva invitación</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-coal/50 backdrop-blur-[2px]" onClick={cerrar} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nueva invitación"
            className="rise relative w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-pop"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-ink">Nueva invitación</h2>
                <p className="mt-0.5 text-xs text-ink-3">
                  El ingresante recibe un link y completa sus datos solo.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={cerrar} aria-label="Cerrar" icon={X} />
            </div>

            {creada ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-ok-soft px-4 py-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" strokeWidth={2.25} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink">Invitación creada</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
                      Mandale este link a <span className="font-bold">{email || 'el ingresante'}</span> por
                      WhatsApp o mail para que cargue sus datos.
                    </p>
                  </div>
                </div>

                {creada.demo && (
                  <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs font-bold text-brand-strong">
                    Modo demo: el cambio no se persiste — este es un link de ejemplo.
                  </p>
                )}

                <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
                  <Link2 className="size-4 shrink-0 text-ink-3" strokeWidth={2.25} />
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{url}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={copiado ? Check : Copy}
                    onClick={() => copiar(url)}
                  >
                    {copiado ? 'Copiado' : 'Copiar'}
                  </Button>
                </div>

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCreada(null)
                      setCopiado(false)
                      setEmail('')
                      setNombre('')
                      setPosicionId('')
                      setLocacionId('')
                    }}
                  >
                    Crear otra
                  </Button>
                  <Button onClick={cerrar}>Listo</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Email del ingresante *">
                  <Input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@gmail.com"
                  />
                </Field>
                <Field label="Nombre (si lo sabés)">
                  <Input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Posición">
                    <Select value={posicionId} onChange={e => setPosicionId(e.target.value)}>
                      <option value="">Elegir…</option>
                      {posiciones.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Locación">
                    <Select value={locacionId} onChange={e => setLocacionId(e.target.value)}>
                      <option value="">Elegir…</option>
                      {locaciones.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}{l.marca ? ` · ${l.marca}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {error && (
                  <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs font-bold text-bad">{error}</p>
                )}

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                  <Button type="button" variant="ghost" onClick={cerrar}>Cancelar</Button>
                  <Button type="submit" disabled={pending} icon={pending ? undefined : Link2}>
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    Generar link
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
