'use client'
// Form compartido de alta y edición de empleados. Uncontrolled (FormData) salvo
// departamento/convenio, que se autocompletan al elegir posición.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase, CircleAlert, CircleUser, HeartPulse, Info, LoaderCircle, MapPin, Save, StickyNote,
} from 'lucide-react'
import { actualizarEmpleado, crearEmpleado } from '@/lib/actions'
import type { Catalogos, EmpleadoDetalle, Locacion } from '@/lib/types'
import { Button, ButtonLink, Card, Input, Label, Select, inputCls } from '@/components/ui/kit'

export interface JefeOption {
  id: number
  nombreCompleto: string
  posicion: string | null
}

interface Props {
  catalogos: Catalogos
  initial: EmpleadoDetalle | null
  modo: 'nuevo' | 'editar'
  jefes: JefeOption[]
}

const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Concubinato', 'Divorciado/a', 'Viudo/a']
const RELACIONES = ['Madre', 'Padre', 'Pareja', 'Hermano/a', 'Otro']

/** Estructura que esperan crearEmpleado / actualizarEmpleado (empleadoSchema) */
type EmpleadoDatos = {
  nombreCompleto: string
  cuil?: string
  dni?: string
  email?: string
  telefono?: string
  fechaNacimiento?: string
  nacionalidad?: string
  estadoCivil?: string
  direccion?: string
  pisoDpto?: string
  localidad?: string
  cp?: string
  emergenciaNombre?: string
  emergenciaTelefono?: string
  emergenciaRelacion?: string
  empresaId?: number
  locacionId?: number
  departamentoId?: number
  posicionId?: number
  convenio?: string
  obraSocial?: string
  art?: string
  fechaIngreso?: string
  reportaAId?: number
  notas?: string
}

// ── Piezas chicas ────────────────────────────────────────────────────────────

/** Card de sección con entrada animada escalonada */
function FormCard({ delay, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <div className="rise" style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <Card>{children}</Card>
    </div>
  )
}

function SectionTitle({ icon: Icon, hint, children }: {
  icon: LucideIcon
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5 flex items-start gap-2.5 border-b border-line pb-3.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <Icon className="size-4" strokeWidth={2.25} />
      </div>
      <div>
        <h2 className="text-sm font-bold leading-7 tracking-tight text-ink">{children}</h2>
        {hint && <p className="-mt-1 text-xs text-ink-3">{hint}</p>}
      </div>
    </div>
  )
}

function F({ label, required, className, children }: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-brand" aria-hidden>*</span>}
      </Label>
      {children}
    </div>
  )
}

/** Agrupa locaciones por marca (las sin marca van a "Estructura") */
function agruparLocaciones(locaciones: Locacion[]): [string, Locacion[]][] {
  const grupos = new Map<string, Locacion[]>()
  for (const l of locaciones) {
    const clave = l.marca ?? 'Estructura'
    const lista = grupos.get(clave) ?? []
    lista.push(l)
    grupos.set(clave, lista)
  }
  return [...grupos.entries()]
}

// ── Form ─────────────────────────────────────────────────────────────────────

export function EmpleadoForm({ catalogos, initial, modo, jefes }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [demoAviso, setDemoAviso] = useState(false)

  // Autocompletado: al elegir posición se sugieren departamento y convenio
  const [departamentoId, setDepartamentoId] = useState(initial?.departamentoId ? String(initial.departamentoId) : '')
  const [convenio, setConvenio] = useState(initial?.convenio ?? '')

  const cancelHref = modo === 'editar' && initial ? `/nomina/${initial.id}` : '/nomina'
  const gruposLocacion = agruparLocaciones(catalogos.locaciones)

  function onPosicionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const pos = catalogos.posiciones.find(p => p.id === Number(e.target.value))
    if (pos?.departamentoId) setDepartamentoId(String(pos.departamentoId))
    if (pos?.convenio) setConvenio(pos.convenio)
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const str = (k: string): string | undefined => {
      const v = fd.get(k)
      return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
    }
    const num = (k: string): number | undefined => {
      const v = str(k)
      return v ? Number(v) : undefined
    }
    const datos: EmpleadoDatos = {
      nombreCompleto: str('nombreCompleto') ?? '',
      cuil: str('cuil'),
      dni: str('dni'),
      fechaNacimiento: str('fechaNacimiento'),
      nacionalidad: str('nacionalidad'),
      estadoCivil: str('estadoCivil'),
      email: str('email'),
      telefono: str('telefono'),
      direccion: str('direccion'),
      pisoDpto: str('pisoDpto'),
      localidad: str('localidad'),
      cp: str('cp'),
      emergenciaNombre: str('emergenciaNombre'),
      emergenciaTelefono: str('emergenciaTelefono'),
      emergenciaRelacion: str('emergenciaRelacion'),
      empresaId: num('empresaId'),
      locacionId: num('locacionId'),
      departamentoId: num('departamentoId'),
      posicionId: num('posicionId'),
      convenio: str('convenio'),
      obraSocial: str('obraSocial'),
      art: str('art'),
      fechaIngreso: str('fechaIngreso'),
      reportaAId: num('reportaAId'),
      notas: str('notas'),
    }
    setError(null)
    setDemoAviso(false)
    startTransition(async () => {
      const res = modo === 'editar' && initial
        ? await actualizarEmpleado(initial.id, datos)
        : await crearEmpleado(datos)
      if (!res.ok) {
        setError(res.error ?? 'No se pudo guardar. Probá de nuevo.')
        return
      }
      if (res.demo) {
        setDemoAviso(true)
        return
      }
      if (modo === 'editar' && initial) router.push(`/nomina/${initial.id}`)
      else router.push(res.id ? `/nomina/${res.id}` : '/nomina')
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* ── Identidad ── */}
      <FormCard>
        <SectionTitle icon={CircleUser} hint="Datos personales del legajo">Identidad</SectionTitle>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Nombre completo" required>
            <Input name="nombreCompleto" defaultValue={initial?.nombreCompleto ?? ''} required minLength={3} placeholder="Apellido y nombre" autoFocus={modo === 'nuevo'} />
          </F>
          <F label="CUIL">
            <Input name="cuil" defaultValue={initial?.cuil ?? ''} placeholder="20-12345678-3" className="tnum" />
          </F>
          <F label="DNI">
            <Input name="dni" defaultValue={initial?.dni ?? ''} placeholder="12345678" inputMode="numeric" className="tnum" />
          </F>
          <F label="Fecha de nacimiento">
            <Input name="fechaNacimiento" type="date" defaultValue={initial?.fechaNacimiento ?? ''} className="tnum" />
          </F>
          <F label="Nacionalidad">
            <Input name="nacionalidad" defaultValue={initial?.nacionalidad ?? ''} placeholder="Argentina" />
          </F>
          <F label="Estado civil">
            <Select name="estadoCivil" defaultValue={initial?.estadoCivil ?? ''}>
              <option value="">Sin especificar</option>
              {ESTADOS_CIVILES.map(ec => <option key={ec} value={ec}>{ec}</option>)}
            </Select>
          </F>
        </div>
      </FormCard>

      {/* ── Contacto ── */}
      <FormCard delay={40}>
        <SectionTitle icon={MapPin} hint="Cómo ubicarlo y dónde vive">Contacto</SectionTitle>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-6">
          <F label="Email" className="lg:col-span-3">
            <Input name="email" type="email" defaultValue={initial?.email ?? ''} placeholder="nombre@eldesembarco.com" />
          </F>
          <F label="Teléfono" className="lg:col-span-3">
            <Input name="telefono" type="tel" defaultValue={initial?.telefono ?? ''} placeholder="11 5555-5555" className="tnum" />
          </F>
          <F label="Dirección" className="lg:col-span-2">
            <Input name="direccion" defaultValue={initial?.direccion ?? ''} placeholder="Calle y número" />
          </F>
          <F label="Piso / Dpto">
            <Input name="pisoDpto" defaultValue={initial?.pisoDpto ?? ''} placeholder="3° B" />
          </F>
          <F label="Localidad" className="lg:col-span-2">
            <Input name="localidad" defaultValue={initial?.localidad ?? ''} placeholder="CABA" />
          </F>
          <F label="Código postal">
            <Input name="cp" defaultValue={initial?.cp ?? ''} placeholder="1414" className="tnum" />
          </F>
        </div>
      </FormCard>

      {/* ── Emergencia ── */}
      <FormCard delay={80}>
        <SectionTitle icon={HeartPulse} hint="A quién llamar si pasa algo">Contacto de emergencia</SectionTitle>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Nombre">
            <Input name="emergenciaNombre" defaultValue={initial?.emergenciaNombre ?? ''} placeholder="Nombre y apellido" />
          </F>
          <F label="Teléfono">
            <Input name="emergenciaTelefono" type="tel" defaultValue={initial?.emergenciaTelefono ?? ''} placeholder="11 5555-5555" className="tnum" />
          </F>
          <F label="Relación">
            <Select name="emergenciaRelacion" defaultValue={initial?.emergenciaRelacion ?? ''}>
              <option value="">Sin especificar</option>
              {RELACIONES.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </F>
        </div>
      </FormCard>

      {/* ── Laboral ── */}
      <FormCard delay={120}>
        <SectionTitle icon={Briefcase} hint="Al elegir la posición se sugieren departamento y convenio">
          Datos laborales
        </SectionTitle>
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <F label="Empresa">
            <Select name="empresaId" defaultValue={initial?.empresaId ? String(initial.empresaId) : ''}>
              <option value="">Sin asignar</option>
              {catalogos.empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </F>
          <F label="Locación">
            <Select name="locacionId" defaultValue={initial?.locacionId ? String(initial.locacionId) : ''}>
              <option value="">Sin asignar</option>
              {gruposLocacion.map(([marca, locs]) => (
                <optgroup key={marca} label={marca}>
                  {locs.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                </optgroup>
              ))}
            </Select>
          </F>
          <F label="Fecha de ingreso">
            <Input name="fechaIngreso" type="date" defaultValue={initial?.fechaIngreso ?? ''} className="tnum" />
          </F>
          <F label="Posición">
            <Select name="posicionId" defaultValue={initial?.posicionId ? String(initial.posicionId) : ''} onChange={onPosicionChange}>
              <option value="">Sin asignar</option>
              {catalogos.posiciones.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.departamento ? ` · ${p.departamento}` : ''}
                </option>
              ))}
            </Select>
          </F>
          <F label="Departamento">
            <Select name="departamentoId" value={departamentoId} onChange={e => setDepartamentoId(e.target.value)}>
              <option value="">Sin asignar</option>
              {catalogos.departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </Select>
          </F>
          <F label="Convenio">
            <Input name="convenio" value={convenio} onChange={e => setConvenio(e.target.value)} placeholder="Ej: UTHGRA gastronómicos" />
          </F>
          <F label="Reporta a">
            <Select name="reportaAId" defaultValue={initial?.reportaAId ? String(initial.reportaAId) : ''}>
              <option value="">Sin jefe directo</option>
              {jefes.map(j => (
                <option key={j.id} value={j.id}>
                  {j.nombreCompleto}{j.posicion ? ` — ${j.posicion}` : ''}
                </option>
              ))}
            </Select>
          </F>
          <F label="Obra social">
            <Input name="obraSocial" defaultValue={initial?.obraSocial ?? ''} placeholder="Ej: OSUTHGRA" />
          </F>
          <F label="ART">
            <Input name="art" defaultValue={initial?.art ?? ''} placeholder="Ej: Provincia ART" />
          </F>
        </div>
      </FormCard>

      {/* ── Notas ── */}
      <FormCard delay={160}>
        <SectionTitle icon={StickyNote} hint="Observaciones internas de RRHH, no las ve el empleado">Notas</SectionTitle>
        <textarea
          name="notas"
          rows={3}
          defaultValue={initial?.notas ?? ''}
          placeholder="Acuerdos particulares, contexto del ingreso, temas a seguir…"
          className={`${inputCls} h-auto min-h-20 resize-y py-2 leading-relaxed`}
        />
      </FormCard>

      {/* ── Avisos + acciones ── */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          {error}
        </div>
      )}
      {demoAviso && (
        <div className="flex items-start gap-2.5 rounded-xl border border-dashed border-brand/40 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-strong">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
          Modo demo: el cambio no se persiste.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <p className="text-xs text-ink-3">
          Los campos con <span className="font-bold text-brand">*</span> son obligatorios.
        </p>
        <div className="flex items-center gap-2">
          <ButtonLink href={cancelHref} variant="secondary">Cancelar</ButtonLink>
          <Button type="submit" icon={pending ? undefined : Save} disabled={pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" strokeWidth={2.25} />}
            {pending ? 'Guardando…' : modo === 'nuevo' ? 'Crear empleado' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </form>
  )
}
