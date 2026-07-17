'use client'

// Árbol jerárquico colapsable del organigrama. Client component: maneja
// expandir/colapsar, búsqueda con resaltado y auto-expansión de ancestros.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, FoldVertical, Search, UnfoldVertical, Users, X } from 'lucide-react'
import { Avatar, Badge, Button, Input, MarcaDot } from '@/components/ui/kit'
import type { OrgNode } from '@/lib/types'

const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(' ')

/** Minúsculas y sin tildes, para que "lopez" encuentre a "López" */
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// ── Métricas del árbol (una sola pasada, memoizada) ─────────────────────────

interface MetaArbol {
  descendientes: Map<number, number>
  total: number
  niveles: number
}

function medirArbol(root: OrgNode): MetaArbol {
  const descendientes = new Map<number, number>()
  let total = 0
  let niveles = 0
  const walk = (n: OrgNode, d: number): number => {
    total++
    niveles = Math.max(niveles, d + 1)
    const bajo = n.hijos.reduce((acc, h) => acc + 1 + walk(h, d + 1), 0)
    descendientes.set(n.id, bajo)
    return bajo
  }
  walk(root, 0)
  return { descendientes, total, niveles }
}

/** Ids colapsados para mostrar el árbol hasta `nivelesVisibles` niveles */
function colapsarHasta(root: OrgNode, nivelesVisibles: number): Set<number> {
  const ids = new Set<number>()
  const walk = (n: OrgNode, d: number) => {
    if (d >= nivelesVisibles - 1 && n.hijos.length > 0) ids.add(n.id)
    n.hijos.forEach(h => walk(h, d + 1))
  }
  walk(root, 0)
  return ids
}

// ── Conectores (patrón clásico de árbol CSS con ul/li y borders) ────────────

const liConector = [
  'relative',
  // línea horizontal hacia la tarjeta
  'before:absolute before:-left-4 before:top-[25px] before:w-4 before:border-t before:border-line-strong',
  // riel vertical que une a los hermanos (cubre el gap de space-y-2 con -top-2)
  'after:absolute after:-left-4 after:-top-2 after:bottom-0 after:border-l after:border-line-strong',
  // el último hermano corta el riel a la altura de su conector
  'last:after:bottom-auto last:after:h-[33px]',
].join(' ')

// ── Nodo ────────────────────────────────────────────────────────────────────

interface CtxArbol {
  abierto: (id: number) => boolean
  toggle: (id: number) => void
  matches: Set<number>
  buscando: boolean
  descendientes: Map<number, number>
}

function Rama({ node, depth, ctx }: { node: OrgNode; depth: number; ctx: CtxArbol }) {
  const tieneHijos = node.hijos.length > 0
  const abierto = ctx.abierto(node.id)
  const esMatch = ctx.matches.has(node.id)
  const reportes = ctx.descendientes.get(node.id) ?? 0

  return (
    <li className={depth > 0 ? liConector : undefined}>
      <div className="flex items-center gap-2">
        {/* Gutter fijo: chevron para ramas, punto para hojas (mantiene la alineación) */}
        {tieneHijos ? (
          <button
            type="button"
            onClick={() => ctx.toggle(node.id)}
            aria-expanded={abierto}
            aria-label={`${abierto ? 'Colapsar' : 'Expandir'} el equipo de ${node.nombreCompleto}`}
            className="flex size-5 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-3 shadow-sm hover:border-ink-3 hover:text-ink"
          >
            {abierto
              ? <ChevronDown className="size-3.5" strokeWidth={2.25} />
              : <ChevronRight className="size-3.5" strokeWidth={2.25} />}
          </button>
        ) : (
          <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
            <span className="size-1.5 rounded-full bg-line-strong" />
          </span>
        )}

        {/* Tarjeta del nodo */}
        <div
          className={cx(
            'flex items-center gap-2.5 rounded-xl border bg-surface py-2 pl-2.5 pr-3 shadow-card',
            node.vacante && 'border-dashed',
            esMatch
              ? 'border-brand/50 ring-2 ring-brand/70'
              : 'border-line hover:border-line-strong hover:shadow-pop',
            ctx.buscando && !esMatch && 'opacity-55',
          )}
        >
          <Avatar nombre={node.nombreCompleto} color={node.marcaColor} size="sm" />
          <div className="min-w-0">
            {node.vacante ? (
              <span className="block max-w-52 truncate text-[13px] font-bold leading-snug text-ink-3">
                {node.nombreCompleto}
              </span>
            ) : (
              <Link
                href={`/nomina/${node.id}`}
                className="block max-w-52 truncate text-[13px] font-bold leading-snug text-ink hover:text-brand"
              >
                {node.nombreCompleto}
              </Link>
            )}
            <div className="max-w-52 truncate text-[11px] leading-snug text-ink-3">
              {node.posicion ?? 'Sin posición'}
            </div>
          </div>

          {node.vacante && <Badge tone="warn">Vacante</Badge>}

          {node.locacion && (
            <span
              className="ml-1 hidden items-center gap-1.5 whitespace-nowrap border-l border-line pl-2.5 sm:flex"
              title={node.locacion}
            >
              <MarcaDot marca={node.marca} color={node.marcaColor} />
              <span className="max-w-36 truncate text-[11px] font-medium text-ink-3">{node.locacion}</span>
            </span>
          )}

          {tieneHijos && (
            <span title={`${reportes} ${reportes === 1 ? 'persona reporta' : 'personas reportan'} acá (directos e indirectos)`}>
              <Badge tone={abierto ? 'neutral' : 'brand'}>
                <Users className="size-3" strokeWidth={2.25} />
                <span className="tnum">{reportes}</span>
              </Badge>
            </span>
          )}
        </div>
      </div>

      {tieneHijos && abierto && (
        <ul className="rise mt-2 space-y-2 pl-[26px]">
          {node.hijos.map(h => (
            <Rama key={h.id} node={h} depth={depth + 1} ctx={ctx} />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Árbol completo con toolbar ──────────────────────────────────────────────

export function OrgTree({ root }: { root: OrgNode }) {
  const meta = useMemo(() => medirArbol(root), [root])
  // Por defecto, los primeros 3 niveles quedan expandidos
  const [colapsados, setColapsados] = useState<Set<number>>(() => colapsarHasta(root, 3))
  const [busqueda, setBusqueda] = useState('')
  const q = normalizar(busqueda.trim())

  // Matches por nombre/posición + ancestros que hay que forzar abiertos
  const { matches, forzados } = useMemo(() => {
    const matches = new Set<number>()
    const forzados = new Set<number>()
    if (!q) return { matches, forzados }
    const walk = (n: OrgNode, ancestros: number[]) => {
      if (normalizar(n.nombreCompleto).includes(q) || (n.posicion && normalizar(n.posicion).includes(q))) {
        matches.add(n.id)
        for (const a of ancestros) forzados.add(a)
      }
      n.hijos.forEach(h => walk(h, [...ancestros, n.id]))
    }
    walk(root, [])
    return { matches, forzados }
  }, [root, q])

  const ctx: CtxArbol = {
    abierto: id => (q !== '' && forzados.has(id)) || !colapsados.has(id),
    toggle: id => setColapsados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    }),
    matches,
    buscando: q !== '',
    descendientes: meta.descendientes,
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={UnfoldVertical} onClick={() => setColapsados(new Set())}>
            Expandir todo
          </Button>
          <Button variant="secondary" size="sm" icon={FoldVertical} onClick={() => setColapsados(colapsarHasta(root, 2))}>
            Colapsar a nivel 2
          </Button>
          <span className="tnum ml-1 hidden border-l border-line pl-3 text-xs font-semibold text-ink-3 md:inline">
            {meta.total} personas · {meta.niveles} {meta.niveles === 1 ? 'nivel' : 'niveles'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {q !== '' && (
            <span className={cx('tnum text-xs font-bold', matches.size > 0 ? 'text-brand-strong' : 'text-ink-3')}>
              {matches.size === 0
                ? 'Sin coincidencias'
                : `${matches.size} ${matches.size === 1 ? 'coincidencia' : 'coincidencias'}`}
            </span>
          )}
          <div className="relative w-60">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
              strokeWidth={2}
            />
            <Input
              type="search"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar nombre o puesto…"
              aria-label="Buscar en el organigrama por nombre o puesto"
              className="h-8 pl-8 pr-7 text-xs [&::-webkit-search-cancel-button]:hidden"
            />
            {busqueda !== '' && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
              >
                <X className="size-3.5" strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lienzo scrolleable con grilla de puntos */}
      <div className="overflow-x-auto rounded-b-card">
        <div className="min-w-max bg-[radial-gradient(circle,var(--color-line)_1px,transparent_1px)] bg-[length:18px_18px] p-6 md:p-8">
          <ul className="min-w-max">
            <Rama node={root} depth={0} ctx={ctx} />
          </ul>
        </div>
      </div>
    </div>
  )
}
