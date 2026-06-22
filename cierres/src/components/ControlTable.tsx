import type { ControlRow } from '@/lib/control/buildControlRows'

export function ControlTable({ rows }: { rows: ControlRow[] }) {
  if (rows.length === 0) return <p className="text-gray-500">Sin canales de delivery para comparar.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-1">Plataforma</th><th>Declarado</th><th>App</th><th>Dif.</th><th>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const sem = Math.abs(r.diferencia) === 0 ? '🟢' : Math.abs(r.diferencia) <= 1000 ? '🟡' : '🔴'
          return (
            <tr key={r.plataforma} className="border-b">
              <td className="py-1">{r.plataforma}</td>
              <td>{r.declarado}</td><td>{r.app}</td>
              <td>{sem} {r.diferencia}</td>
              <td>{r.pct ?? '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
