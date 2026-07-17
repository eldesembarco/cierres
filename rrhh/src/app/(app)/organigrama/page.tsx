import { Network } from 'lucide-react'
import { getOrganigrama, isDemo } from '@/lib/data'
import { Card, DemoBanner, EmptyState, MarcaDot, PageHeader } from '@/components/ui/kit'
import type { OrgNode } from '@/lib/types'
import { OrgTree } from './_components/OrgTree'

export const metadata = { title: 'Organigrama' }

/** Marcas presentes en el árbol, en orden de aparición (para la leyenda) */
function marcasPresentes(root: OrgNode): { marca: string; color: string | null }[] {
  const vistas = new Map<string, string | null>()
  const walk = (n: OrgNode) => {
    if (n.marca && !vistas.has(n.marca)) vistas.set(n.marca, n.marcaColor)
    n.hijos.forEach(walk)
  }
  walk(root)
  return [...vistas.entries()].map(([marca, color]) => ({ marca, color }))
}

export default async function OrganigramaPage() {
  const root = await getOrganigrama()
  const marcas = root ? marcasPresentes(root) : []

  return (
    <>
      {isDemo() && <DemoBanner />}
      <PageHeader
        title="Organigrama"
        icon={Network}
        subtitle="La estructura del grupo, en vivo desde reporta_a."
        actions={
          marcas.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 shadow-card">
              {marcas.map(m => (
                <MarcaDot key={m.marca} marca={m.marca} color={m.color} />
              ))}
            </div>
          ) : undefined
        }
      />

      {root ? (
        <Card pad={false} className="rise">
          <OrgTree root={root} />
        </Card>
      ) : (
        <Card className="rise">
          <EmptyState
            icon={Network}
            title="Todavía no hay organigrama"
            hint="Cargá empleados en la nómina y definí quién reporta a quién: el árbol se arma solo desde ese dato."
          />
        </Card>
      )}
    </>
  )
}
