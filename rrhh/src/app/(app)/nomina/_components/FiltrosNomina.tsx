'use client'
// Barra de filtros de la nómina. Todo el estado vive en searchParams
// (router.replace) para que la vista sea compartible por URL.
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/kit'
import type { CatalogoItem, Locacion } from '@/lib/types'

const ESTADOS = [
  { value: 'ACTIVO', label: 'Activos' },
  { value: 'ONBOARDING', label: 'Onboarding' },
  { value: 'EGRESADO', label: 'Egresados' },
  { value: 'TODOS', label: 'Todos' },
] as const

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      title="Quitar filtro"
      className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-strong hover:border-brand/60"
    >
      {label}
      <X className="size-3 opacity-60" strokeWidth={2.5} />
    </button>
  )
}

export function FiltrosNomina({ locaciones, departamentos }: {
  locaciones: Locacion[]
  departamentos: CatalogoItem[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlQ = searchParams.get('q') ?? ''
  const locacion = searchParams.get('locacion') ?? ''
  const departamento = searchParams.get('departamento') ?? ''
  const estado = searchParams.get('estado') ?? 'ACTIVO'

  const [texto, setTexto] = useState(urlQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastQ = useRef(urlQ)

  // Si q cambia desde afuera (chip, "limpiar filtros" del empty state),
  // sincronizamos el input sin pisar lo que el usuario está tipeando.
  useEffect(() => {
    if (urlQ !== lastQ.current) {
      lastQ.current = urlQ
      setTexto(urlQ)
    }
  }, [urlQ])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const aplicar = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString())
    mut(p)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const setParam = (clave: string, valor: string) =>
    aplicar(p => {
      if (valor) p.set(clave, valor)
      else p.delete(clave)
    })

  const onBuscar = (valor: string) => {
    setTexto(valor)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      lastQ.current = valor.trim()
      setParam('q', valor.trim())
    }, 300)
  }

  const limpiarTodo = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    lastQ.current = ''
    setTexto('')
    router.replace(pathname, { scroll: false })
  }

  // Locaciones agrupadas por marca (las de estructura, al final)
  const grupos = new Map<string, Locacion[]>()
  for (const l of locaciones) {
    const clave = l.marca ?? 'Estructura'
    const lista = grupos.get(clave) ?? []
    lista.push(l)
    grupos.set(clave, lista)
  }

  const nombreLocacion = locaciones.find(l => String(l.id) === locacion)?.nombre
  const nombreDepartamento = departamentos.find(d => String(d.id) === departamento)?.nombre
  const labelEstado = ESTADOS.find(e => e.value === estado)?.label ?? estado

  const chips: { key: string; label: string; onClear: () => void }[] = []
  if (urlQ) chips.push({
    key: 'q', label: `“${urlQ}”`,
    onClear: () => { lastQ.current = ''; setTexto(''); setParam('q', '') },
  })
  if (nombreLocacion) chips.push({ key: 'locacion', label: nombreLocacion, onClear: () => setParam('locacion', '') })
  if (nombreDepartamento) chips.push({ key: 'departamento', label: nombreDepartamento, onClear: () => setParam('departamento', '') })
  if (estado !== 'ACTIVO') chips.push({ key: 'estado', label: labelEstado, onClear: () => setParam('estado', '') })

  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={2.25} />
          <Input
            type="search"
            value={texto}
            onChange={e => onBuscar(e.target.value)}
            placeholder="Buscar por nombre, CUIL, email o posición…"
            aria-label="Buscar empleados"
            className="pl-9"
          />
        </div>
        <div className="w-48">
          <Select value={locacion} onChange={e => setParam('locacion', e.target.value)} aria-label="Filtrar por locación">
            <option value="">Todas las locaciones</option>
            {[...grupos].map(([marca, ls]) => (
              <optgroup key={marca} label={marca}>
                {ls.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Select value={departamento} onChange={e => setParam('departamento', e.target.value)} aria-label="Filtrar por departamento">
            <option value="">Todos los departamentos</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </Select>
        </div>
        <div className="w-36">
          <Select
            value={estado}
            onChange={e => setParam('estado', e.target.value === 'ACTIVO' ? '' : e.target.value)}
            aria-label="Filtrar por estado"
          >
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </Select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Filtros</span>
          {chips.map(c => <Chip key={c.key} label={c.label} onClear={c.onClear} />)}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={limpiarTodo}
              className="ml-1 text-[11px] font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline"
            >
              Limpiar todo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
