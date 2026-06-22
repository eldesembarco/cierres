import { auth } from '@/lib/auth/auth'
import { puedeSubirCsv } from '@/lib/auth/rbac'
import { subirCsv } from './actions'
import { Upload, FileText, Lock } from 'lucide-react'

export default async function ImportacionesPage() {
  const session = await auth()
  if (!session || !puedeSubirCsv(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para subir reportes.</p>
        </div>
      </main>
    )
  }

  async function action(formData: FormData) {
    'use server'
    const r = await subirCsv(formData)
    console.log('Resultado ingesta:', r)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Importaciones</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <Upload size={18} className="text-slate-500" />
          <h2 className="font-medium text-slate-900">Importar reporte PedidosYa</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Subí el CSV “endOfDay” de PedidosYa. Se procesa para comparar las ventas de apps
          contra lo declarado en el cierre.
        </p>

        <form action={action} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Fecha del reporte</span>
            <input
              name="fecha"
              type="date"
              defaultValue={hoy}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-56"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Archivo CSV</span>
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
              <FileText size={18} className="shrink-0 text-slate-400" />
              <input
                name="archivo"
                type="file"
                accept=".csv"
                required
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:font-medium file:text-white hover:file:bg-blue-700"
              />
            </div>
          </label>

          <button className="self-start rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Subir y procesar
          </button>
        </form>
      </section>
    </main>
  )
}
