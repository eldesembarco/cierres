import { CalendarClock, FileWarning, FolderCheck, Inbox } from 'lucide-react'
import { DemoBanner, PageHeader, StatCard } from '@/components/ui/kit'
import { getDocumentos, isDemo } from '@/lib/data'
import { DocumentosTabs } from './_components/DocumentosTabs'

export const metadata = { title: 'Documentos' }

export default async function DocumentosPage() {
  const documentos = await getDocumentos()

  const pendientes = documentos.filter(d => d.estado === 'PENDIENTE' || d.estado === 'RECHAZADO').length
  const vencidos = documentos.filter(d => d.diasAlVencimiento !== null && d.diasAlVencimiento < 0).length
  const porVencer = documentos.filter(
    d => d.diasAlVencimiento !== null && d.diasAlVencimiento >= 0 && d.diasAlVencimiento <= 30,
  ).length

  return (
    <>
      {isDemo() && <DemoBanner />}
      <PageHeader
        icon={FolderCheck}
        title="Documentos"
        subtitle="Bandeja de validación y vencimientos del legajo digital"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Inbox}
          tone="warn"
          label="Pendientes de revisión"
          value={pendientes}
          sub="esperando validación de RRHH"
        />
        <StatCard
          icon={FileWarning}
          tone="bad"
          label="Vencidos"
          value={vencidos}
          sub="documentación a renovar ya"
        />
        <StatCard
          icon={CalendarClock}
          tone="warn"
          label="Por vencer"
          value={porVencer}
          sub="dentro de los próximos 30 días"
        />
      </div>

      <DocumentosTabs documentos={documentos} />
    </>
  )
}
