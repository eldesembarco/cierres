import { auth } from '@/lib/auth/auth'
import { puedeVerControl } from '@/lib/auth/rbac'
import { getLocalActivoId } from '@/lib/auth/localActivo'
import { prisma } from '@/lib/db'
import { getControl } from '@/lib/control/getControl'
import { ControlTable } from '@/components/ControlTable'
import { Scale, AlertTriangle, Lock } from 'lucide-react'

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
  // Opera sobre el "local activo" elegido en la TopBar (cookie).
  const localId = await getLocalActivoId(session)
  const [local, control] = await Promise.all([
    prisma.local.findUnique({ where: { id: localId }, select: { nombre: true } }),
    getControl(localId, new Date(dia)),
  ])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Scale size={20} className="text-slate-500" />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Control declarado vs app</h1>
            {local && <p className="text-sm text-slate-500">{local.nombre}</p>}
          </div>
        </div>
        <form>
          <input
            name="fecha"
            type="date"
            defaultValue={dia}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-48"
          />
        </form>
      </div>

      {(control.faltaCierre || control.faltaImportacion) && (
        <div className="mb-4 flex flex-col gap-2">
          {control.faltaCierre && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle size={16} /> Falta el cierre de este día.
            </p>
          )}
          {control.faltaImportacion && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle size={16} /> Falta importar el reporte de apps.
            </p>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <ControlTable rows={control.rows} />
      </section>
    </main>
  )
}
