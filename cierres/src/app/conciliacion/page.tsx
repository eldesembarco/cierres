import { auth } from '@/lib/auth/auth'
import { esCentral } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
import { prisma } from '@/lib/db'
import { formatMoney } from '@/lib/money'
import { conciliarLocalDia } from '@/lib/mp/conciliarLocalDia'
import { ayerAr } from '@/lib/fecha'
import type { ConciliacionCanal } from '@/lib/mp/conciliacionMp'
import { GitCompareArrows, Lock, CheckCircle2, AlertTriangle, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SearchParams = Promise<{ localId?: string; fecha?: string }>

const CANAL_LABEL: Record<string, string> = {
  mercado_pedidos: 'Mercado Delivery',
  mercadopago: 'Mercado Pago / QR',
}

export default async function ConciliacionPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !esCentral(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver la conciliación.</p>
        </div>
      </main>
    )
  }

  const sp = await searchParams
  const localActivoId = await getLocalActivoId(session)
  const localIdSel = sp.localId && /^\d+$/.test(sp.localId) ? Number(sp.localId) : localActivoId
  const fechaSel = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : ayerAr()
  const correr = Boolean(sp.localId && sp.fecha)

  const locales = await prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } })
  const conc = correr ? await conciliarLocalDia(localIdSel, fechaSel) : null

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-1 flex items-center gap-2">
        <GitCompareArrows size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Conciliación Mercado Pago</h1>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        Choca cada cobro que registró Mercado Pago contra cada ingreso que cargó el encargado, por canal.
      </p>

      <form method="GET" className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Local</span>
          <select name="localId" defaultValue={String(localIdSel)} className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-56">
            {locales.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Fecha</span>
          <input name="fecha" type="date" defaultValue={fechaSel} className="rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:ml-auto">
          Conciliar
        </button>
      </form>

      {!conc ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
          <GitCompareArrows size={32} className="text-slate-300" />
          <p className="text-sm text-slate-600">Elegí un local y una fecha, y tocá “Conciliar”.</p>
          <p className="text-xs text-slate-400">Lee los reportes de MP del día (puede tardar unos segundos).</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <span>Operaciones MP: <b className="text-slate-800">{conc.operacionesMp}</b></span>
            <span>Líneas del encargado: <b className="text-slate-800">{conc.lineasEncargado}</b></span>
            <span>Archivos leídos: <b className="text-slate-800">{conc.archivosLeidos}</b></span>
            {!conc.hayCierre && (
              <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={13} /> El encargado todavía no cargó este día</span>
            )}
            {conc.nombresMp.length === 0 && (
              <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={13} /> Este local no tiene nombre de MP mapeado</span>
            )}
          </div>

          {conc.resultado.porCanal.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center shadow-sm">
              <Inbox size={32} className="text-slate-300" />
              <p className="text-sm text-slate-600">No hay movimientos de MP ni del encargado para este local y día.</p>
            </div>
          ) : (
            conc.resultado.porCanal.map((c) => <CanalCard key={c.canal} c={c} />)
          )}
        </>
      )}
    </main>
  )
}

function CanalCard({ c }: { c: ConciliacionCanal }) {
  const estado = c.cuadra ? 'ok' : c.totalCuadra ? 'total' : 'mal'
  const cfg =
    estado === 'ok'
      ? { bg: 'bg-emerald-50', text: 'text-emerald-800', dif: 'text-emerald-700', label: 'cuadra', icon: <CheckCircle2 size={18} className="text-emerald-600" /> }
      : estado === 'total'
        ? { bg: 'bg-amber-50', text: 'text-amber-800', dif: 'text-amber-700', label: 'el total cierra, revisá el detalle', icon: <AlertTriangle size={18} className="text-amber-600" /> }
        : { bg: 'bg-red-50', text: 'text-red-800', dif: 'text-red-600', label: 'con diferencias', icon: <AlertTriangle size={18} className="text-red-600" /> }
  const totalCargadoMonto = [...c.soloEncargado].sort((a, b) => b.monto - a.monto)[0]?.monto ?? c.totalEncargado
  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-center justify-between gap-3 px-4 py-3 ${cfg.bg}`}>
        <div className="flex items-center gap-2">
          {cfg.icon}
          <h2 className={`text-sm font-semibold ${cfg.text}`}>
            {CANAL_LABEL[c.canal] ?? c.canal} — {cfg.label}
          </h2>
        </div>
        <div className="text-right text-xs">
          <div className="text-slate-500">MP {formatMoney(c.totalMp)} · Encargado {formatMoney(c.totalEncargado)}</div>
          <div className={`font-semibold tabular-nums ${c.diferencia === 0 ? 'text-emerald-700' : cfg.dif}`}>
            Diferencia {formatMoney(c.diferencia)}
          </div>
        </div>
      </div>
      {c.probableTotalCargado && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
          <span>
            Parece que el encargado cargó <b>el total del día ({formatMoney(totalCargadoMonto)})</b> en una sola línea, en vez de cada venta.
            El total coincide, pero hay que cargarlo <b>venta por venta</b>.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <Columna titulo="Coinciden" tono="emerald" filas={c.coincidencias} vacio="—" />
        <Columna titulo="MP cobró, no se cargó" tono="red" filas={c.soloMp} vacio="Nada pendiente" />
        <Columna titulo="Se cargó, MP no lo tiene" tono="amber" filas={c.soloEncargado} vacio="Nada de más" />
      </div>
    </section>
  )
}

const TONO: Record<string, string> = {
  emerald: 'text-emerald-700',
  red: 'text-red-700',
  amber: 'text-amber-700',
}

function Columna({ titulo, tono, filas, vacio }: { titulo: string; tono: string; filas: { monto: number; cantidad: number }[]; vacio: string }) {
  const Icon = tono === 'emerald' ? CheckCircle2 : AlertTriangle
  return (
    <div>
      <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold ${TONO[tono]}`}>
        <Icon size={14} />
        {titulo}
      </p>
      {filas.length === 0 ? (
        <p className="text-xs text-slate-400">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {filas.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-sm tabular-nums">
              <span className="text-slate-800">{formatMoney(f.monto)}</span>
              {f.cantidad > 1 && <span className="text-xs text-slate-400">×{f.cantidad}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
