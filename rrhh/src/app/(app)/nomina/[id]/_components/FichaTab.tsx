// Solapa Ficha: grid de cards con los datos del legajo. Server Component.
import Link from 'next/link'
import { Briefcase, ChevronRight, Network, Phone, StickyNote, UserRound } from 'lucide-react'
import { Avatar, Card, CardTitle } from '@/components/ui/kit'
import { fmtFecha } from '@/lib/format'
import type { EmpleadoDetalle } from '@/lib/types'
import { CopyButton } from './CopyButton'

const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ')

/** Texto no vacío o null (para caer al "—" del Dato) */
const v = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)

function edad(isoNacimiento: string): number | null {
  const [y, m, d] = isoNacimiento.split('-').map(Number)
  if (!y || !m || !d) return null
  const hoy = new Date()
  let e = hoy.getFullYear() - y
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) e--
  return e
}

function Dato({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="shrink-0 text-xs font-semibold text-ink-3">{label}</dt>
      <dd className={cx('min-w-0 break-words text-right text-sm font-semibold text-ink', mono && 'tnum font-mono text-[13px]')}>
        {value ?? <span className="font-normal text-ink-3">—</span>}
      </dd>
    </div>
  )
}

function Titulo({ icon: Icon, children }: { icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <CardTitle>
      <span className="flex items-center gap-2">
        <Icon className="size-4 text-brand" strokeWidth={2.25} />
        {children}
      </span>
    </CardTitle>
  )
}

function PersonaLink({ id, nombre, detalle }: { id: number; nombre: string; detalle: string | null }) {
  return (
    <Link
      href={`/nomina/${id}`}
      className="group flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:border-line-strong hover:bg-paper"
    >
      <Avatar nombre={nombre} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink group-hover:text-brand-strong">{nombre}</span>
        <span className="block truncate text-xs text-ink-2">{detalle ?? '—'}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
    </Link>
  )
}

export function FichaTab({ e }: { e: EmpleadoDetalle }) {
  const anios = e.fechaNacimiento ? edad(e.fechaNacimiento) : null
  const direccion = [v(e.direccion), v(e.pisoDpto)].filter(Boolean).join(', ')
  const localidad = v(e.localidad) ? `${v(e.localidad)}${v(e.cp) ? ` (CP ${v(e.cp)})` : ''}` : null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rise">
        <Titulo icon={UserRound}>Datos personales</Titulo>
        <dl className="-my-2.5 divide-y divide-line/70">
          <Dato
            label="Nacimiento"
            value={e.fechaNacimiento && (
              <>
                {fmtFecha(e.fechaNacimiento)}
                {anios !== null && <span className="tnum ml-1.5 font-normal text-ink-3">· {anios} años</span>}
              </>
            )}
          />
          <Dato label="Nacionalidad" value={v(e.nacionalidad)} />
          <Dato label="Estado civil" value={v(e.estadoCivil)} />
          <Dato label="DNI" value={v(e.dni)} mono />
          <Dato label="Dirección" value={direccion || null} />
          <Dato label="Localidad" value={localidad} />
        </dl>
      </Card>

      <Card className="rise">
        <Titulo icon={Phone}>Contacto</Titulo>
        <dl className="-my-2.5 divide-y divide-line/70">
          <Dato
            label="Email"
            value={v(e.email) && (
              <a href={`mailto:${e.email}`} className="hover:text-brand-strong hover:underline">{e.email}</a>
            )}
          />
          <Dato
            label="Teléfono"
            value={v(e.telefono) && (
              <a href={`tel:${e.telefono}`} className="tnum hover:text-brand-strong hover:underline">{e.telefono}</a>
            )}
          />
          <Dato
            label="Contacto de emergencia"
            value={v(e.emergenciaNombre) && (
              <span className="block">
                {e.emergenciaNombre}
                {(v(e.emergenciaRelacion) || v(e.emergenciaTelefono)) && (
                  <span className="tnum block text-xs font-normal text-ink-3">
                    {[v(e.emergenciaRelacion), v(e.emergenciaTelefono)].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
            )}
          />
        </dl>
      </Card>

      <Card className="rise">
        <Titulo icon={Briefcase}>Datos laborales</Titulo>
        <dl className="-my-2.5 divide-y divide-line/70">
          <Dato label="Empresa" value={v(e.empresa)} />
          <Dato label="Departamento" value={v(e.departamento)} />
          <Dato label="Obra social" value={v(e.obraSocial)} />
          <Dato label="ART" value={v(e.art)} />
          <Dato
            label="CBU"
            value={v(e.cbu) && (
              <span className="inline-flex max-w-full items-center gap-1">
                <span className="tnum break-all font-mono text-[12px]">{e.cbu}</span>
                <CopyButton value={e.cbu!} label="CBU" />
              </span>
            )}
          />
        </dl>
      </Card>

      <Card className="rise">
        <Titulo icon={Network}>Estructura</Titulo>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-3">Reporta a</p>
            {e.reportaA ? (
              <PersonaLink id={e.reportaA.id} nombre={e.reportaA.nombreCompleto} detalle={e.reportaA.posicion} />
            ) : (
              <p className="text-sm text-ink-3">Sin reporte directo — tope del organigrama.</p>
            )}
          </div>
          {e.reportes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-3">
                Reportes directos <span className="tnum">({e.reportes.length})</span>
              </p>
              <ul className="space-y-1.5">
                {e.reportes.map(r => (
                  <li key={r.id}>
                    <PersonaLink id={r.id} nombre={r.nombreCompleto} detalle={[r.posicion, r.locacion].filter(Boolean).join(' · ') || null} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {v(e.notas) && (
        <Card className="rise lg:col-span-2">
          <Titulo icon={StickyNote}>Notas internas</Titulo>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{e.notas}</p>
        </Card>
      )}
    </div>
  )
}
