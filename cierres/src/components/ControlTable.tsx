import type { ControlRow } from '@/lib/control/buildControlRows'
import { formatMoney } from '@/lib/money'
import { Scale } from 'lucide-react'

const money = formatMoney

function DiffPill({ diferencia }: { diferencia: number }) {
  const abs = Math.abs(diferencia)
  const style =
    abs === 0
      ? 'bg-emerald-50 text-emerald-700'
      : abs <= 1000
        ? 'bg-amber-50 text-amber-700'
        : 'bg-red-50 text-red-700'
  const dot = abs === 0 ? 'bg-emerald-500' : abs <= 1000 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${style}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      {money(diferencia)}
    </span>
  )
}

export function ControlTable({ rows }: { rows: ControlRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Scale size={20} />
        </span>
        <p className="font-medium text-slate-900">Sin canales de delivery para comparar.</p>
        <p className="mt-1 text-sm text-slate-500">Cargá un cierre e importá el reporte de apps.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-medium">Plataforma</th>
            <th className="py-2 px-3 text-right font-medium">Declarado</th>
            <th className="py-2 px-3 text-right font-medium">App</th>
            <th className="py-2 px-3 text-right font-medium">Dif.</th>
            <th className="py-2 pl-3 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.plataforma} className="border-b border-slate-100 last:border-0">
              <td className="py-2.5 pr-3 font-medium text-slate-900">{r.plataforma}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{money(r.declarado)}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{money(r.app)}</td>
              <td className="py-2.5 px-3 text-right">
                <DiffPill diferencia={r.diferencia} />
              </td>
              <td className="py-2.5 pl-3 text-right tabular-nums text-slate-500">
                {r.pct != null ? `${r.pct}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
