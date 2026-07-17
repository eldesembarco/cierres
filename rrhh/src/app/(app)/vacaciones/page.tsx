import Link from 'next/link'
import { CalendarCheck, Hourglass, Info, Palmtree, Plane, Users } from 'lucide-react'
import { Avatar, Card, DemoBanner, EmptyState, PageHeader, StatCard, TableShell, Td, Th } from '@/components/ui/kit'
import { getEmpleados, getSolicitudes, isDemo } from '@/lib/data'
import { fmtFecha, hoyIso } from '@/lib/format'
import { NuevaSolicitudButton } from './_components/NuevaSolicitudButton'
import { SolicitudesTable } from './_components/SolicitudesTable'

export const metadata = { title: 'Vacaciones y licencias' }

export default async function VacacionesPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const enSaldos = tab === 'saldos'

  const [solicitudes, empleados] = await Promise.all([
    getSolicitudes(),
    getEmpleados({ estado: 'ACTIVO' }),
  ])

  const hoy = hoyIso()
  const anio = Number(hoy.slice(0, 4))

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const pendientes = solicitudes.filter(s => s.estado === 'PENDIENTE')

  const deVacacionesHoy = [...new Map(
    solicitudes
      .filter(s => s.estado === 'APROBADA' && s.tipo === 'VACACIONES' && s.desde <= hoy && hoy <= s.hasta)
      .map(s => [s.empleadoId, s.empleado] as const),
  ).values()]
  const nombresHoy = deVacacionesHoy.map(n => n.split(' ')[0]).slice(0, 2).join(', ')
  const subHoy = deVacacionesHoy.length === 0
    ? 'Nadie ausente por vacaciones'
    : deVacacionesHoy.length > 2
      ? `${nombresHoy} y ${deVacacionesHoy.length - 2} más`
      : nombresHoy

  const aprobadasAnio = solicitudes.filter(
    s => s.estado === 'APROBADA' && s.tipo === 'VACACIONES' && s.desde.startsWith(`${anio}-`),
  )
  const diasTomadosAnio = aprobadasAnio.reduce((acc, s) => acc + s.dias, 0)

  // ── Datos para las tabs ───────────────────────────────────────────────────
  const colores: Record<number, string | null> = {}
  for (const e of empleados) colores[e.id] = e.marcaColor

  const ordenadas = [...solicitudes].sort((a, b) => {
    if ((a.estado === 'PENDIENTE') !== (b.estado === 'PENDIENTE')) {
      return a.estado === 'PENDIENTE' ? -1 : 1
    }
    return b.desde.localeCompare(a.desde)
  })

  const saldos = empleados
    .map(e => {
      const propias = solicitudes.filter(s => s.empleadoId === e.id)
      return {
        empleado: e,
        dias: propias
          .filter(s => s.estado === 'APROBADA' && s.tipo === 'VACACIONES' && s.desde.startsWith(`${anio}-`))
          .reduce((acc, s) => acc + s.dias, 0),
        ultima: propias.reduce<string | null>(
          (max, s) => (!max || s.creadaEn > max ? s.creadaEn : max),
          null,
        ),
      }
    })
    .sort((a, b) => b.dias - a.dias || a.empleado.nombreCompleto.localeCompare(b.empleado.nombreCompleto))

  return (
    <>
      {isDemo() && <DemoBanner />}
      <PageHeader
        title="Vacaciones y licencias"
        subtitle="Solicitudes, saldos y novedades del equipo"
        icon={Palmtree}
        actions={
          <NuevaSolicitudButton
            empleados={empleados.map(e => ({ id: e.id, nombre: e.nombreCompleto, locacion: e.locacion }))}
          />
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pendientes de aprobar"
          value={pendientes.length}
          sub={pendientes.length ? 'Esperando revisión de RRHH' : 'Nada pendiente, todo al día'}
          icon={Hourglass}
          tone="warn"
        />
        <StatCard
          label="De vacaciones hoy"
          value={deVacacionesHoy.length}
          sub={subHoy}
          icon={Plane}
          tone="info"
        />
        <StatCard
          label={`Días tomados en ${anio}`}
          value={diasTomadosAnio}
          sub={`${aprobadasAnio.length} ${aprobadasAnio.length === 1 ? 'solicitud aprobada' : 'solicitudes aprobadas'} de vacaciones`}
          icon={CalendarCheck}
          tone="brand"
        />
      </div>

      <div className="mb-5 inline-flex items-center gap-1 rounded-xl bg-black/5 p-1">
        <TabLink href="/vacaciones" activo={!enSaldos} n={solicitudes.length}>
          Solicitudes
        </TabLink>
        <TabLink href="/vacaciones?tab=saldos" activo={enSaldos} n={empleados.length}>
          Saldos por empleado
        </TabLink>
      </div>

      {enSaldos ? (
        <div className="rise">
          {!saldos.length ? (
            <Card>
              <EmptyState
                icon={Users}
                title="Sin empleados activos"
                hint="Cuando haya gente activa en la nómina, acá vas a ver sus días de vacaciones."
              />
            </Card>
          ) : (
            <>
              <TableShell>
                <thead>
                  <tr>
                    <Th>Empleado</Th>
                    <Th>Locación</Th>
                    <Th right>Vacaciones aprobadas {anio}</Th>
                    <Th right>Última solicitud</Th>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {saldos.map(({ empleado, dias, ultima }) => (
                    <tr key={empleado.id} className="hover:bg-paper/50">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar nombre={empleado.nombreCompleto} color={empleado.marcaColor} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-ink">{empleado.nombreCompleto}</div>
                            {empleado.posicion && (
                              <div className="truncate text-[11px] text-ink-3">{empleado.posicion}</div>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-ink-2">{empleado.locacion ?? '—'}</span>
                      </Td>
                      <Td right>
                        <span className={`tnum font-bold ${dias ? 'text-ink' : 'text-ink-3'}`}>{dias}</span>
                        <span className="ml-1 text-[11px] text-ink-3">{dias === 1 ? 'día' : 'días'}</span>
                      </Td>
                      <Td right>
                        <span className="tnum whitespace-nowrap text-ink-2">{fmtFecha(ultima)}</span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-3">
                <Info className="mt-px size-3.5 shrink-0" strokeWidth={2} />
                El saldo formal (días correspondientes por antigüedad) se carga al conectar la base;
                acá ves los días de vacaciones ya aprobados en {anio}.
              </p>
            </>
          )}
        </div>
      ) : (
        <SolicitudesTable solicitudes={ordenadas} colores={colores} />
      )}
    </>
  )
}

function TabLink({ href, activo, n, children }: {
  href: string
  activo: boolean
  n: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold ${
        activo ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
      }`}
    >
      {children}
      <span
        className={`tnum rounded-full px-1.5 py-px text-[11px] font-bold ${
          activo ? 'bg-brand-soft text-brand-strong' : 'bg-black/5 text-ink-3'
        }`}
      >
        {n}
      </span>
    </Link>
  )
}
