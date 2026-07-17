import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, Eye, Pencil } from 'lucide-react'
import { getCatalogos, getEmpleado, getEmpleados, isDemo } from '@/lib/data'
import { ButtonLink, DemoBanner, PageHeader } from '@/components/ui/kit'
import { EmpleadoForm } from '../../_form/EmpleadoForm'

export const metadata = { title: 'Editar legajo' }

export default async function EditarEmpleadoPage({ params }: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const empleadoId = Number(id)
  if (!Number.isInteger(empleadoId) || empleadoId <= 0) notFound()

  const [empleado, catalogos, activos] = await Promise.all([
    getEmpleado(empleadoId),
    getCatalogos(),
    getEmpleados({ estado: 'ACTIVO' }),
  ])
  if (!empleado) notFound()

  // Para "reporta a": activos, sin el propio empleado (nadie se reporta a sí mismo)
  const jefes = activos
    .filter(e => e.id !== empleado.id)
    .map(e => ({ id: e.id, nombreCompleto: e.nombreCompleto, posicion: e.posicion }))

  const subtitulo = [empleado.posicion, empleado.locacion].filter(Boolean).join(' · ')

  return (
    <>
      {isDemo() && <DemoBanner />}
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs font-semibold text-ink-3">
        <Link href="/nomina" className="rounded px-1 py-0.5 hover:bg-black/5 hover:text-ink">Nómina</Link>
        <ChevronRight className="size-3.5" strokeWidth={2} />
        <Link href={`/nomina/${empleado.id}`} className="max-w-48 truncate rounded px-1 py-0.5 hover:bg-black/5 hover:text-ink">
          {empleado.nombreCompleto}
        </Link>
        <ChevronRight className="size-3.5" strokeWidth={2} />
        <span className="px-1 text-ink-2">Editar</span>
      </nav>
      <PageHeader
        icon={Pencil}
        title="Editar legajo"
        subtitle={subtitulo ? `${empleado.nombreCompleto} — ${subtitulo}` : empleado.nombreCompleto}
        actions={
          <ButtonLink href={`/nomina/${empleado.id}`} variant="secondary" icon={Eye}>
            Ver legajo
          </ButtonLink>
        }
      />
      <EmpleadoForm modo="editar" catalogos={catalogos} initial={empleado} jefes={jefes} />
    </>
  )
}
