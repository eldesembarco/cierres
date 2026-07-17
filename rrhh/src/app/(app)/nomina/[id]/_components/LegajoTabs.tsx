'use client'
// Tabs del legajo: estado local puro (sin router). Los paneles llegan
// server-rendered como ReactNode; se montan todos y solo se muestra el activo,
// re-disparando la animación .rise al cambiar de solapa.
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CalendarClock, FileText, History, IdCard, TreePalm, UsersRound } from 'lucide-react'

export type TabId = 'ficha' | 'documentos' | 'historial' | 'vacaciones' | 'solicitudes' | 'equipo'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'ficha', label: 'Ficha', icon: IdCard },
  { id: 'documentos', label: 'Documentos', icon: FileText },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'vacaciones', label: 'Vacaciones', icon: TreePalm },
  { id: 'solicitudes', label: 'Solicitudes', icon: CalendarClock },
  { id: 'equipo', label: 'Equipo', icon: UsersRound },
]

export function LegajoTabs({ counts = {}, panels }: {
  counts?: Partial<Record<TabId, number>>
  panels: Record<TabId, React.ReactNode>
}) {
  const [active, setActive] = useState<TabId>('ficha')
  return (
    <div>
      <div role="tablist" aria-label="Secciones del legajo" className="mb-5 flex flex-wrap gap-x-1 overflow-x-auto border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          const count = counts[id]
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(id)}
              className={[
                '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold',
                isActive
                  ? 'border-brand text-brand-strong'
                  : 'border-transparent text-ink-2 hover:border-line-strong hover:text-ink',
              ].join(' ')}
            >
              <Icon className="size-4" strokeWidth={2.25} />
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={[
                    'tnum rounded-full px-1.5 py-px text-[10px] font-bold',
                    isActive ? 'bg-brand-soft text-brand-strong' : 'bg-black/5 text-ink-3',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {TABS.map(({ id }) => (
        <div key={id} role="tabpanel" className={active === id ? 'rise' : 'hidden'}>
          {panels[id]}
        </div>
      ))}
    </div>
  )
}
