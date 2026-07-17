// Dashboard ejecutivo: el estado de la dotación del grupo de un vistazo.
import {
  CalendarClock, CalendarDays, ClipboardCheck, FileClock, LayoutDashboard,
  Plane, Repeat, UserMinus, UserPlus, Users,
} from 'lucide-react'
import { CumpleanosCard } from './_components/CumpleanosCard'
import { VencimientosCard } from './_components/VencimientosCard'
import { BarList, Donut, GroupedBars } from '@/components/charts/charts'
import { Card, CardTitle, DemoBanner, PageHeader, StatCard } from '@/components/ui/kit'
import { getDashboard, isDemo } from '@/lib/data'
import { CHART_NEUTRAL, CHART_SEQUENTIAL } from '@/lib/palette'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const { kpis, dotacionPorLocacion, dotacionPorMarca, dotacionPorDepartamento, altasBajasPorMes, proximosVencimientos, antiguedadDistribucion, cumpleanosDelMes } = await getDashboard()

  const hoy = new Date()
  const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(hoy)
  const hoyLargo = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(hoy)

  const hayCriticos = proximosVencimientos.some(d => d.diasAlVencimiento !== null && d.diasAlVencimiento <= 7)
  const topLocaciones = dotacionPorLocacion.slice(0, 12)
  const restoLocaciones = dotacionPorLocacion.length - topLocaciones.length
  const topDepartamentos = dotacionPorDepartamento.slice(0, 6)

  return (
    <>
      {isDemo() && <DemoBanner />}
      <PageHeader
        title="Dashboard"
        subtitle="El pulso de la gente del grupo, hoy."
        icon={LayoutDashboard}
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3">
            <CalendarDays className="size-3.5" strokeWidth={2} />
            <span className="capitalize">{hoyLargo}</span>
          </span>
        }
      />

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Activos"
          value={kpis.activos}
          sub={`En ${dotacionPorLocacion.length} locaciones del grupo`}
          icon={Users}
          tone="brand"
          href="/nomina"
        />
        <StatCard
          label="Altas del mes"
          value={kpis.altasMes}
          sub={`Ingresos en ${mesNombre}`}
          icon={UserPlus}
          tone="ok"
        />
        <StatCard
          label="Bajas del mes"
          value={kpis.bajasMes}
          sub={`Egresos en ${mesNombre}`}
          icon={UserMinus}
          tone="neutral"
        />
        <StatCard
          label="Rotación anual"
          value={`${kpis.rotacionAnualPct}%`}
          sub="Bajas de los últimos 12 meses sobre activos"
          icon={Repeat}
          tone="info"
        />
      </div>

      {/* KPIs operativos, todos linkeados */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Docs pendientes"
          value={kpis.docsPendientes}
          sub={kpis.docsPendientes > 0 ? 'Esperan revisión de RRHH' : 'Todo revisado, nada en cola'}
          icon={FileClock}
          tone={kpis.docsPendientes > 0 ? 'warn' : 'ok'}
          href="/documentos"
        />
        <StatCard
          label="Docs por vencer"
          value={kpis.docsPorVencer}
          sub={hayCriticos ? 'Hay vencimientos críticos' : 'Dentro de los próximos 30 días'}
          icon={CalendarClock}
          tone={hayCriticos ? 'bad' : kpis.docsPorVencer > 0 ? 'warn' : 'ok'}
          href="/documentos"
        />
        <StatCard
          label="Onboarding en curso"
          value={kpis.onboardingEnCurso}
          sub="Invitaciones abiertas o por aprobar"
          icon={ClipboardCheck}
          tone="info"
          href="/onboarding"
        />
        <StatCard
          label="Solicitudes pendientes"
          value={kpis.solicitudesPendientes}
          sub="Vacaciones y licencias por resolver"
          icon={Plane}
          tone={kpis.solicitudesPendientes > 0 ? 'warn' : 'neutral'}
          href="/vacaciones"
        />
      </div>

      {/* Dotación: por local + por marca / departamento */}
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <Card className="rise [animation-delay:60ms]">
          <CardTitle hint="Personas activas por punto de venta u oficina">
            Dotación por local
          </CardTitle>
          <BarList
            items={topLocaciones.map(l => ({
              label: l.locacion,
              sub: l.marca,
              value: l.count,
              color: l.color,
            }))}
          />
          {restoLocaciones > 0 && (
            <p className="mt-3 text-[11px] font-semibold text-ink-3">
              + {restoLocaciones} {restoLocaciones === 1 ? 'locación más' : 'locaciones más'}
            </p>
          )}
        </Card>

        <Card className="rise [animation-delay:120ms]">
          <CardTitle hint="Cómo se reparte la gente entre las marcas del grupo">
            Dotación por marca
          </CardTitle>
          <Donut
            items={dotacionPorMarca.map(m => ({ label: m.marca, value: m.count, color: m.color }))}
            centerLabel="personas"
          />
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-ink-3">Por departamento</p>
            <BarList
              items={topDepartamentos.map(d => ({
                label: d.departamento,
                value: d.count,
                color: CHART_NEUTRAL,
              }))}
            />
          </div>
        </Card>
      </div>

      {/* Movimientos de dotación */}
      <Card className="rise mt-5 [animation-delay:150ms]">
        <CardTitle hint="Ingresos y egresos mes a mes en todo el grupo">
          Altas y bajas · últimos 12 meses
        </CardTitle>
        <GroupedBars
          data={altasBajasPorMes.map(m => ({ label: m.mes, values: [m.altas, m.bajas] }))}
          series={[
            { name: 'Altas', color: '#2f9e44' },
            { name: 'Bajas', color: '#e8590c' },
          ]}
        />
      </Card>

      {/* Vencimientos + cumpleaños + antigüedad */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <VencimientosCard items={proximosVencimientos} />
        <div className="space-y-5">
          <CumpleanosCard items={cumpleanosDelMes} />
          <Card className="rise [animation-delay:300ms]">
            <CardTitle hint="Distribución de la dotación activa por tiempo en el grupo">
              Antigüedad del equipo
            </CardTitle>
            <BarList
              items={antiguedadDistribucion.map(r => ({
                label: r.rango,
                value: r.count,
                color: CHART_SEQUENTIAL[3],
              }))}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
