'use client'
// Tabs de la central de documentos. El estado optimista de la bandeja vive
// acá arriba para que el contador del tab acompañe cada aprobación/rechazo.
import { useMemo, useState } from 'react'
import type { Documento } from '@/lib/types'
import { BandejaRevision } from './BandejaRevision'
import { TablaTodos } from './TablaTodos'
import { TablaVencimientos } from './TablaVencimientos'

type TabId = 'bandeja' | 'vencimientos' | 'todos'

export function DocumentosTabs({ documentos }: { documentos: Documento[] }) {
  const [tab, setTab] = useState<TabId>('bandeja')
  const [resueltos, setResueltos] = useState<number[]>([])

  // Bandeja: pendientes y rechazados, los más viejos primero (cola FIFO)
  const bandeja = useMemo(
    () =>
      documentos
        .filter(d => (d.estado === 'PENDIENTE' || d.estado === 'RECHAZADO') && !resueltos.includes(d.id))
        .sort((a, b) => a.subidoEn.localeCompare(b.subidoEn)),
    [documentos, resueltos],
  )

  // Vencimientos: todo lo que vence, lo más urgente primero
  const vencimientos = useMemo(
    () =>
      documentos
        .filter(d => d.vencimiento !== null)
        .sort((a, b) => (a.diasAlVencimiento ?? 0) - (b.diasAlVencimiento ?? 0)),
    [documentos],
  )

  const tabs: { id: TabId; label: string; count: number; alerta?: boolean }[] = [
    { id: 'bandeja', label: 'Bandeja de revisión', count: bandeja.length, alerta: bandeja.length > 0 },
    { id: 'vencimientos', label: 'Vencimientos', count: vencimientos.length },
    { id: 'todos', label: 'Todos', count: documentos.length },
  ]

  return (
    <div>
      <div
        role="tablist"
        aria-label="Vistas de documentos"
        className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-card"
      >
        {tabs.map(t => {
          const activo = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={activo}
              onClick={() => setTab(t.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors ${
                activo ? 'bg-coal text-white shadow-sm' : 'text-ink-2 hover:bg-black/5 hover:text-ink'
              }`}
            >
              {t.label}
              <span
                className={`tnum rounded-full px-1.5 py-px text-[10px] font-bold ${
                  activo
                    ? 'bg-white/20 text-white'
                    : t.alerta
                      ? 'bg-warn-soft text-warn'
                      : 'bg-black/[0.06] text-ink-3'
                }`}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {tab === 'bandeja' && (
        <BandejaRevision documentos={bandeja} onResuelto={id => setResueltos(prev => [...prev, id])} />
      )}
      {tab === 'vencimientos' && <TablaVencimientos documentos={vencimientos} />}
      {tab === 'todos' && <TablaTodos documentos={documentos} />}
    </div>
  )
}
