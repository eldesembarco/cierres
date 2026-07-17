// Nómina: listado maestro de empleados con búsqueda, filtros por URL,
// export CSV y fila navegable al legajo.
import { CheckCircle2, ChevronRight, SearchX, UserPlus, Users } from 'lucide-react'
import {
  Avatar, Badge, ButtonLink, Card, DemoBanner, EmptyState, EstadoEmpleadoBadge,
  MarcaDot, PageHeader, TableShell, Td, Th,
} from '@/components/ui/kit'
import { getCatalogos, getEmpleados, isDemo } from '@/lib/data'
import { fmtAntiguedad, fmtFecha } from '@/lib/format'
import type { EmpleadoResumen, EstadoEmpleado } from '@/lib/types'
import { ExportCsvButton } from './_components/ExportCsvButton'
import { FiltrosNomina } from './_components/FiltrosNomina'
import { TrLink } from './_components/TrLink'

export const metadata = { title: 'Nómina' }

const ESTADOS_VALIDOS = ['ACTIVO', 'ONBOARDING', 'EGRESADO', 'TODOS'] as const
type EstadoFiltro = (typeof ESTADOS_VALIDOS)[number]

const ORDEN_ESTADO: Record<EstadoEmpleado, number> = { ACTIVO: 0, ONBOARDING: 1, EGRESADO: 2 }

function FilaEmpleado({ e }: { e: EmpleadoResumen }) {
  return (
    <TrLink href={`/nomina/${e.id}`}>
      <Td>
        <div className="flex items-center gap-3">
          <Avatar nombre={e.nombreCompleto} color={e.marcaColor} />
          <div className="min-w-0">
            <div className="truncate font-bold text-ink">{e.nombreCompleto}</div>
            {e.email && <div className="truncate text-xs text-ink-3">{e.email}</div>}
          </div>
        </div>
      </Td>
      <Td>
        {e.locacion ? (
          <>
            <div className="text-[13px] font-semibold text-ink">{e.locacion}</div>
            {e.marca && (
              <div className="mt-0.5">
                <MarcaDot marca={e.marca} color={e.marcaColor} />
              </div>
            )}
          </>
        ) : (
          <span className="text-ink-3">—</span>
        )}
      </Td>
      <Td>
        <div className="text-[13px] font-semibold text-ink">{e.posicion ?? '—'}</div>
        {e.departamento && <div className="mt-0.5 text-xs text-ink-3">{e.departamento}</div>}
      </Td>
      <Td>
        <div className="tnum text-[13px] text-ink-2">{fmtFecha(e.fechaIngreso)}</div>
        <div className="mt-0.5 text-xs text-ink-3">{fmtAntiguedad(e.antiguedadMeses)}</div>
      </Td>
      <Td right>
        <span className="tnum text-[13px] font-semibold text-ink-2">{e.legajo ?? '—'}</span>
      </Td>
      <Td>
        {e.docsPendientes > 0 || e.docsPorVencer > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {e.docsPendientes > 0 && <Badge tone="warn">{e.docsPendientes} pend.</Badge>}
            {e.docsPorVencer > 0 && <Badge tone="bad">{e.docsPorVencer} por vencer</Badge>}
          </div>
        ) : (
          <span title="Documentación al día">
            <CheckCircle2 className="size-4 text-ok" strokeWidth={2.25} />
          </span>
        )}
      </Td>
      <Td>
        <EstadoEmpleadoBadge estado={e.estado} />
      </Td>
      <Td className="w-10 pl-0">
        <ChevronRight
          className="ml-auto size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={2.25}
        />
      </Td>
    </TrLink>
  )
}

export default async function NominaPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const uno = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)
  const q = uno(sp.q)?.trim() || undefined
  const locacionId = Number(uno(sp.locacion)) || undefined
  const departamentoId = Number(uno(sp.departamento)) || undefined
  const estadoRaw = uno(sp.estado)
  const estado: EstadoFiltro = (ESTADOS_VALIDOS as readonly string[]).includes(estadoRaw ?? '')
    ? (estadoRaw as EstadoFiltro)
    : 'ACTIVO'

  const [empleados, catalogos] = await Promise.all([
    getEmpleados({ q, locacionId, departamentoId, estado }),
    getCatalogos(),
  ])

  // Activos primero, y adentro de cada estado orden alfabético
  const lista = [...empleados].sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'),
  )

  const hayFiltros = Boolean(q || locacionId || departamentoId || estado !== 'ACTIVO')
  const subtitle = hayFiltros
    ? `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'} con los filtros aplicados`
    : `${lista.length} ${lista.length === 1 ? 'persona activa' : 'personas activas'} en el grupo`

  return (
    <>
      {isDemo() && <DemoBanner />}
      <PageHeader
        title="Nómina"
        icon={Users}
        subtitle={subtitle}
        actions={
          <>
            <ExportCsvButton empleados={lista} />
            <ButtonLink href="/nomina/nuevo" icon={UserPlus}>Nuevo empleado</ButtonLink>
          </>
        }
      />

      <FiltrosNomina locaciones={catalogos.locaciones} departamentos={catalogos.departamentos} />

      {lista.length === 0 ? (
        <Card className="rise">
          <EmptyState
            icon={SearchX}
            title="Sin resultados"
            hint="Ningún empleado coincide con la búsqueda o los filtros aplicados. Probá con otros criterios."
          >
            <ButtonLink href="/nomina" variant="secondary" size="sm" className="mt-2">
              Limpiar filtros
            </ButtonLink>
          </EmptyState>
        </Card>
      ) : (
        <TableShell className="rise">
          <thead>
            <tr>
              <Th>Empleado</Th>
              <Th>Locación</Th>
              <Th>Posición</Th>
              <Th>Ingreso</Th>
              <Th right>Legajo</Th>
              <Th>Docs</Th>
              <Th>Estado</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lista.map(e => <FilaEmpleado key={e.id} e={e} />)}
          </tbody>
        </TableShell>
      )}
    </>
  )
}
