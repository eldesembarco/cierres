import { auth } from '@/lib/auth/auth'
import { puedeVerControl } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
import { prisma } from '@/lib/db'
import { getTablero } from '@/lib/control/getTablero'
import { Tablero } from '@/components/Tablero'
import { CalendarDays, AlertTriangle, Lock } from 'lucide-react'

export default async function ControlPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await auth()
  if (!session || !puedeVerControl(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver el control.</p>
        </div>
      </main>
    )
  }
  const { fecha } = await searchParams
  const dia = fecha ?? new Date().toISOString().slice(0, 10)
  const localId = await getLocalActivoId(session)
  const [local, tablero] = await Promise.all([
    prisma.local.findUnique({ where: { id: localId }, select: { nombre: true } }),
    getTablero(localId, new Date(dia)),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-end">
        <form className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
          <CalendarDays size={16} className="text-slate-400" />
          <input
            name="fecha"
            type="date"
            defaultValue={dia}
            className="tabular-nums text-sm text-slate-700 outline-none"
          />
        </form>
      </div>

      {(tablero.faltaCierre || tablero.faltaImportacion) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tablero.faltaCierre && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle size={16} /> Falta el cierre de este día.
            </p>
          )}
          {tablero.faltaImportacion && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle size={16} /> Falta importar el reporte de apps (Mercado Pago / PedidosYa).
            </p>
          )}
        </div>
      )}

      <Tablero result={tablero} localNombre={local?.nombre ?? 'Local'} />
    </main>
  )
}
