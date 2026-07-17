// Cards de consulta de catálogos maestros (server components, solo lectura).
import { Briefcase, Building2, FileText, Layers, MapPin, Palette } from 'lucide-react'
import { Badge, Card, CardTitle, EmptyState, MarcaDot, Td, Th } from '@/components/ui/kit'
import { MARCA_COLOR } from '@/lib/palette'
import type { CatalogoItem, DocumentoTipo, Locacion, Marca, Posicion } from '@/lib/types'

const cant = (n: number, sing: string, plu: string) => `${n} ${n === 1 ? sing : plu}`

const TIPO_LOCACION: Record<Locacion['tipo'], string> = {
  LOCAL: 'Local',
  OFICINA: 'Oficina',
  PLANTA: 'Planta',
}

// ── Marcas ──────────────────────────────────────────────────────────────────

export function MarcasCard({ marcas, locaciones }: { marcas: Marca[]; locaciones: Locacion[] }) {
  return (
    <Card>
      <CardTitle hint={cant(marcas.length, 'marca del grupo', 'marcas del grupo')}>Marcas</CardTitle>
      {marcas.length === 0 ? (
        <EmptyState icon={Palette} title="Sin marcas cargadas" hint="Las marcas se dan de alta desde la base." />
      ) : (
        <ul className="-mx-2">
          {marcas.map(m => {
            const locs = locaciones.filter(l => l.marcaId === m.id).length
            return (
              <li key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-paper">
                <span
                  className="size-4 shrink-0 rounded-md ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: m.color }}
                  aria-hidden
                />
                <span className={`flex-1 truncate text-sm font-semibold ${m.activo === false ? 'text-ink-3' : 'text-ink'}`}>
                  {m.nombre}
                </span>
                {m.activo === false && <Badge tone="neutral">Inactiva</Badge>}
                <span className="tnum shrink-0 text-xs font-semibold text-ink-3">
                  {cant(locs, 'locación', 'locaciones')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ── Empresas ────────────────────────────────────────────────────────────────

export function EmpresasCard({ empresas }: { empresas: CatalogoItem[] }) {
  return (
    <Card>
      <CardTitle hint={cant(empresas.length, 'razón social', 'razones sociales')}>Empresas</CardTitle>
      {empresas.length === 0 ? (
        <EmptyState icon={Building2} title="Sin empresas cargadas" hint="Las razones sociales se dan de alta desde la base." />
      ) : (
        <ul className="-mx-2">
          {empresas.map(e => (
            <li key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-paper">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-ink-2">
                <Building2 className="size-4" strokeWidth={2} />
              </span>
              <span className={`flex-1 truncate text-sm font-semibold ${e.activo === false ? 'text-ink-3' : 'text-ink'}`}>
                {e.nombre}
              </span>
              {e.activo === false && <Badge tone="neutral">Inactiva</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── Locaciones ──────────────────────────────────────────────────────────────

type GrupoLocacion = { marca: string; color: string; items: Locacion[] }

function agruparPorMarca(locaciones: Locacion[]): GrupoLocacion[] {
  const orden = [...locaciones].sort(
    (a, b) => (a.marca ?? '￿').localeCompare(b.marca ?? '￿') || a.nombre.localeCompare(b.nombre),
  )
  const grupos: GrupoLocacion[] = []
  for (const l of orden) {
    const marca = l.marca ?? 'Estructura'
    const color = l.marcaColor ?? MARCA_COLOR['Estructura'] ?? '#1971c2'
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.marca === marca) ultimo.items.push(l)
    else grupos.push({ marca, color, items: [l] })
  }
  return grupos
}

export function LocacionesCard({ locaciones }: { locaciones: Locacion[] }) {
  const grupos = agruparPorMarca(locaciones)
  return (
    <Card pad={false}>
      <div className="px-5 pt-5">
        <CardTitle hint={cant(locaciones.length, 'locación agrupada por marca', 'locaciones agrupadas por marca')}>
          Locaciones
        </CardTitle>
      </div>
      {locaciones.length === 0 ? (
        <div className="pb-4">
          <EmptyState icon={MapPin} title="Sin locaciones cargadas" hint="Los locales y oficinas se dan de alta desde la base." />
        </div>
      ) : (
        <div className="overflow-x-auto [&_tbody_tr:last-child>td]:border-b-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th className="pl-5">Locación</Th>
                <Th>Marca</Th>
                <Th className="pr-5">Tipo</Th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, gi) =>
                g.items.map((l, i) => (
                  <tr key={l.id} className="transition-colors hover:bg-paper/70">
                    <Td className="pl-5 font-semibold text-ink">
                      {l.nombre}
                      {l.direccion && <div className="mt-0.5 text-[11px] font-normal text-ink-3">{l.direccion}</div>}
                    </Td>
                    {i === 0 && (
                      // td crudo (mismas clases que el Td del kit) porque Td no expone rowSpan
                      <td
                        rowSpan={g.items.length}
                        className={`px-4 py-2.5 align-middle whitespace-nowrap ${gi < grupos.length - 1 ? 'border-b border-line' : ''}`}
                      >
                        <MarcaDot marca={g.marca} color={g.color} />
                      </td>
                    )}
                    <Td className="pr-5">
                      <Badge tone="neutral">{TIPO_LOCACION[l.tipo]}</Badge>
                    </Td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Departamentos ───────────────────────────────────────────────────────────

export function DepartamentosCard({ departamentos }: { departamentos: CatalogoItem[] }) {
  return (
    <Card>
      <CardTitle hint={cant(departamentos.length, 'área de la estructura', 'áreas de la estructura')}>
        Departamentos
      </CardTitle>
      {departamentos.length === 0 ? (
        <EmptyState icon={Layers} title="Sin departamentos cargados" hint="Las áreas se dan de alta desde la base." />
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {departamentos.map(d => (
            <span
              key={d.id}
              className={`inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-line-strong ${d.activo === false ? 'opacity-60' : ''}`}
            >
              <span className="flex size-6 items-center justify-center rounded-md bg-brand-soft text-brand">
                <Layers className="size-3.5" strokeWidth={2.25} />
              </span>
              {d.nombre}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Posiciones ──────────────────────────────────────────────────────────────

export function PosicionesCard({ posiciones, documentoTipos }: { posiciones: Posicion[]; documentoTipos: DocumentoTipo[] }) {
  const nombreDoc = new Map(documentoTipos.map(t => [t.id, t.nombre]))
  const orden = [...posiciones].sort(
    (a, b) => (a.departamento ?? '￿').localeCompare(b.departamento ?? '￿') || a.nombre.localeCompare(b.nombre),
  )
  return (
    <Card pad={false}>
      <div className="px-5 pt-5">
        <CardTitle hint="Los documentos requeridos se piden en el onboarding de cada posición">Posiciones</CardTitle>
      </div>
      {posiciones.length === 0 ? (
        <div className="pb-4">
          <EmptyState icon={Briefcase} title="Sin posiciones cargadas" hint="Los puestos se dan de alta desde la base." />
        </div>
      ) : (
        <div className="overflow-x-auto [&_tbody_tr:last-child>td]:border-b-0">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th className="pl-5">Posición</Th>
                <Th>Departamento</Th>
                <Th>Convenio</Th>
                <Th className="pr-5">Docs requeridos</Th>
              </tr>
            </thead>
            <tbody>
              {orden.map(p => {
                const docs = p.documentosRequeridos
                  .map(id => nombreDoc.get(id))
                  .filter((n): n is string => !!n)
                return (
                  <tr key={p.id} className="transition-colors hover:bg-paper/70">
                    <Td className="pl-5 font-semibold text-ink">{p.nombre}</Td>
                    <Td className="whitespace-nowrap text-ink-2">{p.departamento ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-xs font-semibold text-ink-2">{p.convenio ?? '—'}</Td>
                    <Td className="pr-5">
                      {docs.length === 0 ? (
                        <span className="text-xs text-ink-3">—</span>
                      ) : (
                        <div className="flex max-w-md flex-wrap gap-1">
                          {docs.map(d => (
                            <Badge key={d} tone="neutral">{d}</Badge>
                          ))}
                        </div>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Tipos de documento ──────────────────────────────────────────────────────

export function DocumentoTiposCard({ documentoTipos }: { documentoTipos: DocumentoTipo[] }) {
  return (
    <Card>
      <CardTitle hint={cant(documentoTipos.length, 'tipo en el legajo digital', 'tipos en el legajo digital')}>
        Tipos de documento
      </CardTitle>
      {documentoTipos.length === 0 ? (
        <EmptyState icon={FileText} title="Sin tipos de documento" hint="Los tipos de documento se dan de alta desde la base." />
      ) : (
        <ul className="-mx-2">
          {documentoTipos.map(t => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-paper">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-ink-2">
                <FileText className="size-4" strokeWidth={2} />
              </span>
              <span className={`flex-1 truncate text-sm font-semibold ${t.activo === false ? 'text-ink-3' : 'text-ink'}`}>
                {t.nombre}
              </span>
              {t.activo === false && <Badge tone="neutral">Inactivo</Badge>}
              {t.requiereVencimiento && <Badge tone="warn">Vence</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
