'use client'
// Wizard público de onboarding: 3 pasos (Identidad → Contacto y emergencia →
// Bancarios y obra social) + revisión final → completarOnboarding(token, datos).
import { useState, useTransition } from 'react'
import {
  ArrowLeft, ArrowRight, Check, ClipboardCheck, HeartPulse, Landmark, Loader2,
  Pencil, Phone, Send, UserRound,
} from 'lucide-react'
import { completarOnboarding } from '@/lib/actions'
import { Button, Field, Input, Select } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'

type Datos = {
  nombreCompleto: string; cuil: string; dni: string; fechaNacimiento: string
  nacionalidad: string; estadoCivil: string; email: string; telefono: string
  direccion: string; pisoDpto: string; localidad: string; cp: string
  emergenciaNombre: string; emergenciaTelefono: string; emergenciaRelacion: string
  cbu: string; obraSocial: string
}

const PASOS = [
  { titulo: 'Identidad', hint: 'Contanos quién sos, como figura en tu DNI', icon: UserRound },
  { titulo: 'Contacto y emergencia', hint: 'Cómo ubicarte y a quién llamar si pasa algo', icon: Phone },
  { titulo: 'Datos bancarios y obra social', hint: 'Para pagarte en fecha y cubrir tu obra social', icon: Landmark },
] as const

const REVISION = 3 // índice virtual del paso de resumen

function Progreso({ paso }: { paso: number }) {
  return (
    <ol className="flex gap-2" aria-label="Progreso del formulario">
      {PASOS.map((p, i) => {
        const done = paso > i
        const activo = paso === i
        return (
          <li key={p.titulo} className="min-w-0 flex-1">
            <div className={`h-1 rounded-full transition-colors duration-300 ${done || activo ? 'bg-brand' : 'bg-black/10'}`} />
            <div className={`mt-2 hidden items-center gap-1 text-[11px] font-bold sm:flex ${activo ? 'text-brand-strong' : done ? 'text-ink-2' : 'text-ink-3'}`}>
              {done
                ? <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
                : <p.icon className="size-3.5 shrink-0" strokeWidth={2.25} />}
              <span className="truncate">{p.titulo}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  )
}

export function WizardIngreso({ token, emailInicial, nombreInicial }: {
  token: string
  emailInicial: string
  nombreInicial: string
}) {
  const [paso, setPaso] = useState(0)
  const [datos, setDatos] = useState<Datos>({
    nombreCompleto: nombreInicial, cuil: '', dni: '', fechaNacimiento: '',
    nacionalidad: '', estadoCivil: '', email: emailInicial, telefono: '',
    direccion: '', pisoDpto: '', localidad: '', cp: '',
    emergenciaNombre: '', emergenciaTelefono: '', emergenciaRelacion: '',
    cbu: '', obraSocial: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [esDemo, setEsDemo] = useState(false)
  const [pending, startTransition] = useTransition()

  const set = (k: keyof Datos) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDatos(d => ({ ...d, [k]: e.target.value }))

  function validar(p: number): string | null {
    if (p === 0 && datos.nombreCompleto.trim().length < 3) {
      return 'Ingresá tu nombre completo, como figura en el DNI.'
    }
    if (p === 1 && (!datos.emergenciaNombre.trim() || !datos.emergenciaTelefono.trim())) {
      return 'Completá el contacto de emergencia: nombre y teléfono.'
    }
    if (p === 2 && datos.cbu.trim() && !/^\d{22}$/.test(datos.cbu.trim())) {
      return 'El CBU tiene 22 dígitos, sin espacios ni guiones. Revisalo o dejalo vacío.'
    }
    return null
  }

  function irA(p: number) {
    setError(null)
    setPaso(p)
  }

  function avanzar() {
    const err = validar(paso)
    if (err) {
      setError(err)
      return
    }
    irA(paso + 1)
  }

  function enviar() {
    setServerError(null)
    startTransition(async () => {
      const res = await completarOnboarding(token, { ...datos })
      if (!res.ok) {
        setServerError(res.error ?? 'No pudimos enviar tus datos. Probá de nuevo en un rato.')
        return
      }
      setEsDemo(!!res.demo)
      setEnviado(true)
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (enviado) {
    const primerNombre = datos.nombreCompleto.trim().split(' ')[0] || 'gracias'
    return (
      <div className="rise rounded-card border border-line bg-surface p-8 shadow-card">
        <div className="flex flex-col items-center py-6 text-center">
          <div className="rise flex size-20 items-center justify-center rounded-full bg-ok-soft text-ok shadow-[0_0_0_10px_rgba(47,158,68,0.08)]">
            <Check className="size-10" strokeWidth={2.5} />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">
            ¡Listo, {primerNombre}!
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Recibimos tus datos. Ahora RRHH los revisa, aprueba tu ingreso y te contacta
            con los próximos pasos. No tenés que hacer nada más.
          </p>
          {esDemo && (
            <p className="mt-5 rounded-lg bg-brand-soft px-3 py-2 text-xs font-bold text-brand-strong">
              Modo demo: el envío no se persiste.
            </p>
          )}
        </div>
      </div>
    )
  }

  const pasoActual = PASOS[paso]
  const enRevision = paso === REVISION

  const secciones: { titulo: string; paso: number; items: [string, string][] }[] = [
    {
      titulo: 'Identidad', paso: 0,
      items: [
        ['Nombre completo', datos.nombreCompleto],
        ['CUIL', datos.cuil],
        ['DNI', datos.dni],
        ['Nacimiento', datos.fechaNacimiento ? fmtFecha(datos.fechaNacimiento) : ''],
        ['Nacionalidad', datos.nacionalidad],
        ['Estado civil', datos.estadoCivil],
      ],
    },
    {
      titulo: 'Contacto', paso: 1,
      items: [
        ['Email', datos.email],
        ['Teléfono', datos.telefono],
        ['Dirección', [datos.direccion, datos.pisoDpto].filter(Boolean).join(', ')],
        ['Localidad', [datos.localidad, datos.cp ? `CP ${datos.cp}` : ''].filter(Boolean).join(' · ')],
      ],
    },
    {
      titulo: 'Emergencia', paso: 1,
      items: [
        ['Contacto', datos.emergenciaNombre],
        ['Teléfono', datos.emergenciaTelefono],
        ['Relación', datos.emergenciaRelacion],
      ],
    },
    {
      titulo: 'Bancarios y obra social', paso: 2,
      items: [
        ['CBU', datos.cbu],
        ['Obra social', datos.obraSocial],
      ],
    },
  ]

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line p-5 sm:px-7 sm:py-6">
        <Progreso paso={paso} />
      </div>

      <div className="p-5 sm:p-7">
        {/* Encabezado del paso */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              {enRevision
                ? <ClipboardCheck className="size-5" strokeWidth={2.25} />
                : pasoActual && <pasoActual.icon className="size-5" strokeWidth={2.25} />}
            </div>
            <div className="leading-tight">
              <h2 className="text-base font-extrabold tracking-tight text-ink">
                {enRevision ? 'Revisá y enviá' : pasoActual?.titulo}
              </h2>
              <p className="mt-0.5 text-xs text-ink-3">
                {enRevision ? 'Chequeá que esté todo bien antes de mandar' : pasoActual?.hint}
              </p>
            </div>
          </div>
          <span className="tnum shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-bold text-ink-2">
            {enRevision ? 'Revisión final' : `Paso ${paso + 1} de 3`}
          </span>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-xs font-bold text-bad">{error}</p>
        )}
        {serverError && (
          <p className="mb-4 rounded-lg bg-bad-soft px-3 py-2 text-xs font-bold text-bad">{serverError}</p>
        )}

        {/* Paso 1: Identidad */}
        {paso === 0 && (
          <div className="space-y-4">
            <Field label="Nombre completo *">
              <Input
                autoFocus
                value={datos.nombreCompleto}
                onChange={set('nombreCompleto')}
                placeholder="Como figura en tu DNI"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="CUIL">
                <Input value={datos.cuil} onChange={set('cuil')} placeholder="20-12345678-3" inputMode="numeric" />
              </Field>
              <Field label="DNI">
                <Input value={datos.dni} onChange={set('dni')} placeholder="Sin puntos" inputMode="numeric" />
              </Field>
              <Field label="Fecha de nacimiento">
                <Input type="date" value={datos.fechaNacimiento} onChange={set('fechaNacimiento')} />
              </Field>
              <Field label="Nacionalidad">
                <Input value={datos.nacionalidad} onChange={set('nacionalidad')} placeholder="Argentina" />
              </Field>
            </div>
            <Field label="Estado civil">
              <Select value={datos.estadoCivil} onChange={set('estadoCivil')}>
                <option value="">Elegir…</option>
                <option>Soltero/a</option>
                <option>Casado/a</option>
                <option>Unión convivencial</option>
                <option>Divorciado/a</option>
                <option>Viudo/a</option>
              </Select>
            </Field>
          </div>
        )}

        {/* Paso 2: Contacto y emergencia */}
        {paso === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input type="email" value={datos.email} onChange={set('email')} placeholder="tu@email.com" />
              </Field>
              <Field label="Teléfono">
                <Input value={datos.telefono} onChange={set('telefono')} placeholder="11 5555 5555" inputMode="tel" />
              </Field>
            </div>
            <Field label="Dirección">
              <Input value={datos.direccion} onChange={set('direccion')} placeholder="Calle y número" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Piso / Dpto">
                <Input value={datos.pisoDpto} onChange={set('pisoDpto')} placeholder="3° B" />
              </Field>
              <Field label="Localidad">
                <Input value={datos.localidad} onChange={set('localidad')} placeholder="CABA" />
              </Field>
              <Field label="Código postal">
                <Input value={datos.cp} onChange={set('cp')} placeholder="1414" inputMode="numeric" />
              </Field>
            </div>

            <div className="rounded-xl border border-line bg-paper/60 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-ink-2">
                <HeartPulse className="size-4 text-brand" strokeWidth={2.25} />
                Contacto de emergencia
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Nombre *">
                  <Input value={datos.emergenciaNombre} onChange={set('emergenciaNombre')} placeholder="Nombre y apellido" />
                </Field>
                <Field label="Teléfono *">
                  <Input value={datos.emergenciaTelefono} onChange={set('emergenciaTelefono')} placeholder="11 5555 5555" inputMode="tel" />
                </Field>
                <Field label="Relación">
                  <Input value={datos.emergenciaRelacion} onChange={set('emergenciaRelacion')} placeholder="Madre, pareja…" />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* Paso 3: Bancarios y obra social */}
        {paso === 2 && (
          <div className="space-y-4">
            <Field label="CBU">
              <Input
                value={datos.cbu}
                onChange={set('cbu')}
                placeholder="0000000000000000000000"
                inputMode="numeric"
                maxLength={22}
                className="font-mono"
              />
            </Field>
            <p className="-mt-2 text-[11px] text-ink-3">
              Los 22 dígitos de tu cuenta, sin espacios. Si todavía no tenés, dejalo vacío y lo
              resolvés después con RRHH.
            </p>
            <Field label="Obra social">
              <Input value={datos.obraSocial} onChange={set('obraSocial')} placeholder="OSDE, OSECAC…" />
            </Field>
          </div>
        )}

        {/* Revisión final */}
        {enRevision && (
          <div className="space-y-5">
            {secciones.map(sec => (
              <section key={sec.titulo} className="rounded-xl border border-line bg-paper/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-ink-2">{sec.titulo}</h3>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => irA(sec.paso)}>
                    Editar
                  </Button>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {sec.items.map(([label, value]) => (
                    <Item key={label} label={label} value={value} />
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}

        {/* Navegación */}
        <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
          {paso > 0 ? (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => irA(paso - 1)} disabled={pending}>
              Atrás
            </Button>
          ) : (
            <span />
          )}
          {enRevision ? (
            <Button size="lg" onClick={enviar} disabled={pending} icon={pending ? undefined : Send}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Enviar a RRHH
            </Button>
          ) : (
            <Button onClick={avanzar}>
              Continuar
              <ArrowRight className="size-4" strokeWidth={2.25} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
