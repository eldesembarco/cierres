// Legajo 360: hero con identidad + datos rápidos, y solapas con toda la vida
// del empleado en el grupo (ficha, documentos, historial, vacaciones,
// solicitudes y equipo).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, LogOut, Pencil } from 'lucide-react'
import { getEmpleado, isDemo } from '@/lib/data'
import { fmtAntiguedad, fmtFecha } from '@/lib/format'
import { Avatar, ButtonLink, Card, DemoBanner, EstadoEmpleadoBadge, MarcaDot } from '@/components/ui/kit'
import { BajaPanel } from './_components/BajaPanel'
import { DocumentosTab } from './_components/DocumentosTab'
import { EquipoTab } from './_components/EquipoTab'
import { FichaTab } from './_components/FichaTab'
import { HistorialTab } from './_components/HistorialTab'
import { LegajoTabs } from './_components/LegajoTabs'
import { SolicitudesTab } from './_components/SolicitudesTab'
import { VacacionesTab } from './_components/VacacionesTab'

export const metadata = { title: 'Legajo' }

const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ')

function QuickDato({ label, value, sub, mono }: {
  label: string
  value: React.ReactNode
  sub?: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">{label}</p>
      <p className={cx('mt-1 truncate text-sm font-bold text-ink', mono && 'tnum font-mono text-[13px]')}>
        {value}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-ink-3">{sub}</p>}
    </div>
  )
}

export default async function LegajoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idNum = Number(id)
  if (!Number.isInteger(idNum) || idNum <= 0) notFound()
  const e = await getEmpleado(idNum)
  if (!e) notFound()

  return (
    <>
      {isDemo() && <DemoBanner />}

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-ink-3">
        <Link href="/nomina" className="hover:text-ink">Nómina</Link>
        <ChevronRight className="size-3.5" strokeWidth={2} />
        <span className="truncate text-ink-2">{e.nombreCompleto}</span>
      </nav>

      {/* Hero */}
      <Card pad={false} className="rise overflow-visible">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar nombre={e.nombreCompleto} color={e.marcaColor} size="xl" className="ring-4 ring-paper" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink">
                  {e.nombreCompleto}
                </h1>
                <EstadoEmpleadoBadge estado={e.estado} />
                {e.legajo !== null && (
                  <span className="tnum text-xs font-bold text-ink-3">Legajo #{e.legajo}</span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                <span className="font-semibold text-ink-2">{e.posicion ?? 'Sin posición'}</span>
                {e.locacion && (
                  <>
                    <span aria-hidden className="text-ink-3">·</span>
                    <MarcaDot marca={e.locacion} color={e.marcaColor} />
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <ButtonLink href={`/nomina/${e.id}/editar`} variant="secondary" size="sm" icon={Pencil}>
                  Editar
                </ButtonLink>
                {e.estado === 'ACTIVO' && <BajaPanel empleadoId={e.id} nombre={e.nombreCompleto} />}
              </div>
            </div>
          </div>

          {/* Columna derecha: datos rápidos */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-line pt-5 sm:grid-cols-3 lg:w-60 lg:shrink-0 lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <QuickDato label="CUIL" value={e.cuil ?? '—'} mono />
            <QuickDato
              label="Ingreso"
              value={fmtFecha(e.fechaIngreso)}
              sub={e.antiguedadMeses !== null ? `${fmtAntiguedad(e.antiguedadMeses)} de antigüedad` : undefined}
            />
            <QuickDato label="Convenio" value={e.convenio ?? '—'} />
          </div>
        </div>

        {e.estado === 'EGRESADO' && e.fechaEgreso && (
          <div className="flex flex-wrap items-center gap-2 rounded-b-card border-t border-line bg-paper/60 px-6 py-3 text-xs font-semibold text-ink-2">
            <LogOut className="size-4 text-ink-3" strokeWidth={2} />
            Egresó el {fmtFecha(e.fechaEgreso)}
            {e.motivoEgreso && <span className="font-normal text-ink-3">— {e.motivoEgreso}</span>}
          </div>
        )}
      </Card>

      {/* Solapas */}
      <div className="mt-6">
        <LegajoTabs
          counts={{
            documentos: e.documentos.length,
            solicitudes: e.solicitudes.length,
            equipo: e.reportes.length,
          }}
          panels={{
            ficha: <FichaTab e={e} />,
            documentos: <DocumentosTab documentos={e.documentos} />,
            historial: <HistorialTab historial={e.historial} />,
            vacaciones: <VacacionesTab saldos={e.saldos} />,
            solicitudes: <SolicitudesTab solicitudes={e.solicitudes} />,
            equipo: <EquipoTab reportes={e.reportes} />,
          }}
        />
      </div>
    </>
  )
}
