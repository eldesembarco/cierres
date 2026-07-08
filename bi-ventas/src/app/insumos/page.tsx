import Link from 'next/link'
import { prisma } from '@/lib/db'
import { BiTabs } from '@/components/BiTabs'
import { hoyAr, primerDiaDelMesAr } from '@/lib/fecha'
import { formatMoney } from '@/lib/money'
import { resumenInsumos, type InsumoBi, type DetalleInsumo } from '@/lib/biInsumos'
import { Package, Inbox, AlertTriangle, Search, X } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{
  desde?: string
  hasta?: string
  localId?: string
  rubro?: string
  q?: string
  insumo?: string
}>

const YMD = /^\d{4}-\d{2}-\d{2}$/

const formatCant = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })

export default async function InsumosPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const desde = sp.desde && YMD.test(sp.desde) ? sp.desde : primerDiaDelMesAr()
  const hasta = sp.hasta && YMD.test(sp.hasta) && sp.hasta >= desde ? sp.hasta : hoyAr()
  const localId = sp.localId && /^\d+$/.test(sp.localId) ? Number(sp.localId) : undefined
  const rubro = sp.rubro || undefined
  const q = sp.q?.trim() || undefined

  const [r, locales] = await Promise.all([
    resumenInsumos({ desde, hasta, localId, rubro, q }, sp.insumo || undefined),
    prisma.local.findMany({
      where: { activo: true, tangoSucursalId: { not: null } },
      select: { id: true, nombre: true, marca: { select: { nombre: true } } },
      orderBy: [{ marca: { nombre: 'asc' } }, { nombre: 'asc' }],
    }),
  ])

  // Query base para los links de drill-down (conserva los filtros activos).
  const qsBase = new URLSearchParams({
    desde,
    hasta,
    ...(localId != null ? { localId: String(localId) } : {}),
    ...(rubro ? { rubro } : {}),
    ...(q ? { q } : {}),
  })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <BiTabs actual="/insumos" />
      <div className="mb-1 flex items-center gap-2">
        <Package size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Insumos por local</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Cantidad de insumos (materia prima y empaque) que consume cada local según Tango. Elegí un insumo para ver el
        detalle por local, normalizado por facturación para comparar locales de distinto tamaño.
      </p>

      {/* Filtros */}
      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Desde</span>
          <input name="desde" type="date" defaultValue={desde} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Hasta</span>
          <input name="hasta" type="date" defaultValue={hasta} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Local</span>
          <select name="localId" defaultValue={localId ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos los locales</option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre} · {l.marca.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Rubro</span>
          <select name="rubro" defaultValue={rubro ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500">
            <option value="">Todos</option>
            {r.rubros.map((rb) => (
              <option key={rb} value={rb}>{rb}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Buscar insumo</span>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q ?? ''} placeholder="ej. cheddar" className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500" />
          </div>
        </label>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          Ver período
        </button>
      </form>

      {r.sinDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <Inbox size={32} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Todavía no hay consumo de insumos sincronizado.</p>
          <p className="max-w-xl text-sm text-slate-500">
            Falta crear la vista <code>vw_ConsumoInsumos</code> en el SQL de Tango y agregar el endpoint{' '}
            <code>/consumo-insumos</code> al bridge del server (el resto del BI ya funciona). Apenas estén, la
            sincronización diaria llena esta pantalla sola.
          </p>
        </div>
      ) : (
        <>
          {r.diasSinInsumos > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <b>Cobertura incompleta:</b> {r.diasSinInsumos} día(s) del rango sin datos de insumos
                {r.ultimaSyncInsumos ? ` (último día con datos: ${r.ultimaSyncInsumos})` : ''}. Los totales pueden
                quedar cortos.
              </div>
            </div>
          )}

          {/* Detalle de un insumo por local */}
          {r.detalle && <DetalleCard detalle={r.detalle} qsBase={qsBase} />}

          {/* Tabla de insumos */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Consumo por insumo {localId ? `· ${locales.find((l) => l.id === localId)?.nombre}` : '· todos los locales'}
              </h2>
              {r.costoTotal > 0 && (
                <span
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
                  title={`Valorizado al precio de reposición de Tango (${r.insumosConCosto} de ${r.insumos.length} insumos con costo cargado)`}
                >
                  costo reposición {formatMoney(r.costoTotal)}
                </span>
              )}
              <span className="ml-auto text-xs text-slate-400">período {desde} a {hasta}</span>
            </div>
            {r.insumos.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">Sin insumos para estos filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2 font-medium">Insumo</th>
                      <th className="py-2 font-medium">Rubro</th>
                      <th className="py-2 text-right font-medium">Cantidad</th>
                      <th className="py-2 pl-2 font-medium">Unidad</th>
                      <th className="py-2 text-right font-medium" title="Cantidad x precio de reposición de Tango">Costo repo.</th>
                      <th className="px-4 py-2 text-right font-medium">Por local</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.insumos.map((i) => (
                      <FilaInsumo key={i.codigo} i={i} qsBase={qsBase} activo={sp.insumo === i.codigo} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function FilaInsumo({ i, qsBase, activo }: { i: InsumoBi; qsBase: URLSearchParams; activo: boolean }) {
  const qs = new URLSearchParams(qsBase)
  qs.set('insumo', i.codigo)
  return (
    <tr className={`border-t border-slate-100 ${activo ? 'bg-indigo-50/60' : ''}`}>
      <td className="px-4 py-1.5 text-slate-800">{i.descripcion}</td>
      <td className="py-1.5">
        {i.rubro && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{i.rubro}</span>}
      </td>
      <td className="py-1.5 text-right font-semibold text-slate-800">{formatCant(i.cantidad)}</td>
      <td className="py-1.5 pl-2 text-slate-500">{i.unidad ?? '—'}</td>
      <td className="py-1.5 text-right text-slate-700">{i.costoTotal != null ? formatMoney(i.costoTotal) : '—'}</td>
      <td className="px-4 py-1.5 text-right">
        <Link href={`/insumos?${qs}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          ver por local →
        </Link>
      </td>
    </tr>
  )
}

function DetalleCard({ detalle, qsBase }: { detalle: DetalleInsumo; qsBase: URLSearchParams }) {
  const maxCant = Math.max(1, ...detalle.locales.map((l) => l.cantidad))
  const conVenta = detalle.locales.filter((l) => l.porMillon != null)
  const promedioPorMillon = conVenta.length > 0 ? conVenta.reduce((s, l) => s + (l.porMillon as number), 0) / conVenta.length : null

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {detalle.descripcion}
          <span className="ml-2 text-xs font-normal text-slate-500">
            total {formatCant(detalle.totalCantidad)} {detalle.unidad ?? ''}
            {detalle.totalCosto != null && ` · ${formatMoney(detalle.totalCosto)} a reposición`}
          </span>
        </h2>
        <Link href={`/insumos?${qsBase}`} className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
          <X size={13} /> cerrar
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="py-2 font-medium">Local</th>
              <th className="py-2 text-right font-medium">Cantidad</th>
              <th className="hidden py-2 pl-4 font-medium sm:table-cell"></th>
              <th className="py-2 text-right font-medium" title="Cantidad x precio de reposición de Tango">Costo repo.</th>
              <th className="py-2 text-right font-medium">Facturación</th>
              <th className="px-4 py-2 text-right font-medium" title="Cantidad por cada $1M facturado: sirve para comparar locales de distinto tamaño">
                x $1M venta
              </th>
            </tr>
          </thead>
          <tbody>
            {detalle.locales.map((l, idx) => {
              // Desvío vs promedio normalizado: >25% arriba = rojo (posible sobreconsumo/merma).
              const desvio = promedioPorMillon && l.porMillon != null ? l.porMillon / promedioPorMillon - 1 : null
              return (
                <tr key={l.localId} className="border-t border-slate-100">
                  <td className="px-4 py-1.5 text-slate-400">{idx + 1}</td>
                  <td className="py-1.5">
                    <span className="font-medium text-slate-800">{l.nombre}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{l.marca}</span>
                  </td>
                  <td className="py-1.5 text-right font-semibold text-slate-800">
                    {formatCant(l.cantidad)} {detalle.unidad ?? ''}
                  </td>
                  <td className="hidden py-1.5 pl-4 sm:table-cell">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round((l.cantidad / maxCant) * 100)}%` }} />
                    </div>
                  </td>
                  <td className="py-1.5 text-right text-slate-700">{l.costoTotal != null ? formatMoney(l.costoTotal) : '—'}</td>
                  <td className="py-1.5 text-right text-slate-600">{l.facturacion > 0 ? formatMoney(l.facturacion) : '—'}</td>
                  <td className={`px-4 py-1.5 text-right font-medium ${desvio != null && desvio > 0.25 ? 'text-red-600' : desvio != null && desvio < -0.25 ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {l.porMillon != null ? formatCant(l.porMillon) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {promedioPorMillon != null && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
          “x $1M venta” = cantidad consumida por cada $1.000.000 facturados. Rojo: más de 25% arriba del promedio
          (posible sobreconsumo o merma); verde: 25% abajo.
        </p>
      )}
    </section>
  )
}
