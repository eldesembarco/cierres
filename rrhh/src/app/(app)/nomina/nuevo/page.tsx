import Link from 'next/link'
import { ChevronRight, UserPlus } from 'lucide-react'
import { getCatalogos, getEmpleados, isDemo } from '@/lib/data'
import { DemoBanner, PageHeader } from '@/components/ui/kit'
import { EmpleadoForm } from '../_form/EmpleadoForm'

export const metadata = { title: 'Nuevo empleado' }

export default async function NuevoEmpleadoPage() {
  const [catalogos, activos] = await Promise.all([
    getCatalogos(),
    getEmpleados({ estado: 'ACTIVO' }),
  ])
  const jefes = activos.map(e => ({ id: e.id, nombreCompleto: e.nombreCompleto, posicion: e.posicion }))

  return (
    <>
      {isDemo() && <DemoBanner />}
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs font-semibold text-ink-3">
        <Link href="/nomina" className="rounded px-1 py-0.5 hover:bg-black/5 hover:text-ink">Nómina</Link>
        <ChevronRight className="size-3.5" strokeWidth={2} />
        <span className="px-1 text-ink-2">Nuevo empleado</span>
      </nav>
      <PageHeader
        icon={UserPlus}
        title="Nuevo empleado"
        subtitle="Alta manual de un legajo. Para ingresos con carga de datos por el propio empleado, mandá una invitación de onboarding."
      />
      <EmpleadoForm modo="nuevo" catalogos={catalogos} initial={null} jefes={jefes} />
    </>
  )
}
