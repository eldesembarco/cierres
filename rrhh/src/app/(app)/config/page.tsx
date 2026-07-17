import { Info, Settings } from 'lucide-react'
import { getCatalogos, isDemo } from '@/lib/data'
import { DemoBanner, PageHeader } from '@/components/ui/kit'
import {
  DepartamentosCard, DocumentoTiposCard, EmpresasCard, LocacionesCard, MarcasCard, PosicionesCard,
} from './_components/catalogo-cards'

export const metadata = { title: 'Configuración' }

export default async function ConfigPage() {
  const catalogos = await getCatalogos()
  return (
    <>
      {isDemo() && <DemoBanner />}
      <PageHeader title="Configuración" subtitle="Catálogos maestros del sistema" icon={Settings} />

      <div className="rise mb-5 flex items-center gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3 text-[13px] text-info">
        <Info className="size-4.5 shrink-0" strokeWidth={2.25} />
        <p className="leading-relaxed">
          <span className="font-bold">Pantalla de consulta.</span>{' '}
          <span className="opacity-80">
            Por ahora los catálogos se editan directamente desde la base — acá tenés la referencia rápida
            de marcas, empresas, locaciones, posiciones y documentos que usa todo el sistema.
          </span>
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <div className="rise" style={{ animationDelay: '40ms' }}>
            <MarcasCard marcas={catalogos.marcas} locaciones={catalogos.locaciones} />
          </div>
          <div className="rise" style={{ animationDelay: '120ms' }}>
            <LocacionesCard locaciones={catalogos.locaciones} />
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rise" style={{ animationDelay: '80ms' }}>
            <EmpresasCard empresas={catalogos.empresas} />
          </div>
          <div className="rise" style={{ animationDelay: '160ms' }}>
            <DepartamentosCard departamentos={catalogos.departamentos} />
          </div>
          <div className="rise" style={{ animationDelay: '200ms' }}>
            <DocumentoTiposCard documentoTipos={catalogos.documentoTipos} />
          </div>
        </div>

        <div className="rise lg:col-span-2" style={{ animationDelay: '240ms' }}>
          <PosicionesCard posiciones={catalogos.posiciones} documentoTipos={catalogos.documentoTipos} />
        </div>
      </div>
    </>
  )
}
