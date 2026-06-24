import Link from 'next/link'
import { auth } from '@/lib/auth/auth'
import { esCentral } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import {
  construirInforme,
  buildWhere,
  primerDiaDelMes,
  hoyYmd,
  normalizarFecha,
  type CierreParaInforme,
  type FilaDiferencia,
} from '@/lib/informes/report'
import {
  BarChart3,
  Lock,
  Download,
  TrendingUp,
  Wallet,
  Scale,
  ListChecks,
  Inbox,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ desde?: string; hasta?: string; localId?: string }>

export default async function InformesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !esCentral(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver informes.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const desde = normalizarFecha(sp.desde, primerDiaDelMes())
  const hasta = normalizarFecha(sp.hasta, hoyYmd())
  // El filtro de local arranca por defecto en el "local activo" (el de la TopBar).
  // Si el usuario eligió explícitamente "Todos los locales" el query param viene
  // presente y vacío (""), y lo respetamos. Sólo cuando el param NO viene (primera
  // carga) caemos al local activo.
  const localActivoId = await getLocalActivoId(session)
  const localIdRaw = sp.localId === undefined ? String(localActivoId) : sp.localId
  const localId = localIdRaw && /^\d+$/.test(localIdRaw) ? Number(localIdRaw) : null

  const [locales, cierres] = await Promise.all([
    prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.cierre.findMany({
      where: buildWhere(desde, hasta, localId),
      include: { local: true, ventas: true, gastos: true },
      orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
    }),
  ])

  const informe = construirInforme(cierres as unknown as CierreParaInforme[])
  const { kpis, ventaPorTipo, gastosPorLocal, diferencias } = informe

  const exportHref = `/api/informes/export?desde=${desde}&hasta=${hasta}&localId=${localIdRaw}`

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Encabezado */}
      <div className="mb-5 flex items-center gap-2">
        <BarChart3 size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Informes</h1>
      </div>

      {/* Filtros */}
      <form
        method="GET"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Desde</span>
          <input
            name="desde"
            type="date"
            defaultValue={desde}
            className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Hasta</span>
          <input
            name="hasta"
            type="date"
            defaultValue={hasta}
            className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Local</span>
          <select
            name="localId"
            defaultValue={localIdRaw}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-56"
          >
            <option value="">Todos los locales</option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 sm:ml-auto">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Aplicar
          </button>
          <a
            href={exportHref}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            <Download size={15} />
            Descargar Excel
          </a>
        </div>
      </form>

      {cierres.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">
            No hay cierres en el período seleccionado.
          </p>
          <p className="text-xs text-slate-400">
            Probá ampliar el rango de fechas o cambiar el local.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<TrendingUp size={16} />}
              titulo="Venta total"
              valor={formatMoney(kpis.ventaTotal)}
              tono="blue"
            />
            <KpiCard
              icon={<Wallet size={16} />}
              titulo="Gastos totales"
              valor={formatMoney(kpis.gastosTotal)}
              tono="slate"
            />
            <KpiCard
              icon={<Scale size={16} />}
              titulo="Diferencia de caja"
              valor={formatMoney(kpis.diferenciaTotal)}
              tono={kpis.diferenciaTotal === 0 ? 'green' : kpis.diferenciaTotal < 0 ? 'red' : 'amber'}
            />
            <KpiCard
              icon={<ListChecks size={16} />}
              titulo="Cierres"
              valor={String(kpis.cantidadCierres)}
              tono="slate"
            />
          </section>

          {/* A) Venta por tipo de venta */}
          <ReportCard titulo="Venta por tipo de venta">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Tipo de venta</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {ventaPorTipo.filas.map((f) => (
                    <tr key={f.canal} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-slate-700">{f.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                        {formatMoney(f.total)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {f.porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatMoney(ventaPorTipo.total)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </ReportCard>

          {/* B) Gastos por local */}
          <ReportCard titulo="Gastos por local">
            <div className="flex flex-col gap-5">
              {gastosPorLocal.locales.map((loc) => (
                <div key={loc.localId}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{loc.local}</h3>
                    <span className="tabular-nums text-sm font-semibold text-slate-900">
                      {formatMoney(loc.total)}
                    </span>
                  </div>
                  {loc.rubros.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin gastos en el período.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {loc.rubros.map((r) => (
                          <tr key={r.tipo} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1.5 text-slate-600">{r.tipo}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">
                              {formatMoney(r.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between border-t-2 border-slate-200 px-3 pt-3 font-semibold text-slate-900">
                <span>Total gastos</span>
                <span className="tabular-nums">{formatMoney(gastosPorLocal.total)}</span>
              </div>
            </div>
          </ReportCard>

          {/* C) Diferencias de caja */}
          <ReportCard titulo="Diferencias de caja">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Turno</th>
                    <th className="px-3 py-2 font-medium">Local</th>
                    <th className="px-3 py-2 text-right font-medium">Efectivo depositado</th>
                    <th className="px-3 py-2 text-right font-medium">Venta efectivo</th>
                    <th className="px-3 py-2 text-right font-medium">Gastos efectivo</th>
                    <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {diferencias.filas.map((f) => (
                    <tr key={f.cierreId} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 tabular-nums text-slate-600">{fechaCorta(f.fecha)}</td>
                      <td className="px-3 py-2 text-slate-600">{f.turnoLabel}</td>
                      <td className="px-3 py-2 text-slate-700">{f.local}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatMoney(f.efectivoDepositado)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatMoney(f.ventaEfectivo)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {formatMoney(f.gastosEfectivo)}
                      </td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${difColor(f)}`}>
                        {formatMoney(f.diferencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                    <td className="px-3 py-2" colSpan={6}>
                      Diferencia total
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        diferencias.total === 0
                          ? 'text-emerald-700'
                          : diferencias.total < 0
                            ? 'text-red-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {formatMoney(diferencias.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {diferencias.porLocal.length > 1 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Diferencia por local
                </p>
                <table className="w-full max-w-md text-sm">
                  <tbody>
                    {diferencias.porLocal.map((l) => (
                      <tr key={l.localId} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-1.5 text-slate-600">{l.local}</td>
                        <td
                          className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                            l.total === 0
                              ? 'text-emerald-700'
                              : l.total < 0
                                ? 'text-red-600'
                                : 'text-amber-600'
                          }`}
                        >
                          {formatMoney(l.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCard>
        </>
      )}
    </main>
  )
}

function difColor(f: FilaDiferencia): string {
  if (f.diferencia === 0) return 'text-emerald-700'
  return f.diferencia < 0 ? 'text-red-600' : 'text-amber-600'
}

function fechaCorta(d: Date): string {
  // La columna es @db.Date; se materializa a medianoche UTC. Formateamos en UTC
  // para no correr el día por zona horaria.
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(d)
}

const TONOS: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
}

function KpiCard({
  icon,
  titulo,
  valor,
  tono,
}: {
  icon: React.ReactNode
  titulo: string
  valor: string
  tono: keyof typeof TONOS | string
}) {
  const cls = TONOS[tono] ?? TONOS.slate
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg border ${cls}`}>
          {icon}
        </span>
        <span className="text-xs font-medium text-slate-500">{titulo}</span>
      </div>
      <p className="tabular-nums text-lg font-semibold text-slate-900">{valor}</p>
    </div>
  )
}

function ReportCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{titulo}</h2>
      {children}
    </section>
  )
}
