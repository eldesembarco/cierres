import { auth } from '@/lib/auth/auth'
import { puedeSubirCsv } from '@/lib/auth/rbac'
import { subirCsv } from './actions'

export default async function ImportacionesPage() {
  const session = await auth()
  if (!session || !puedeSubirCsv(session.user.rol)) {
    return <main className="p-4">No tenés permiso para subir reportes.</main>
  }

  async function action(formData: FormData) {
    'use server'
    const r = await subirCsv(formData)
    console.log('Resultado ingesta:', r)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-lg font-semibold">Importar reporte PedidosYa</h1>
      <form action={action} className="flex flex-col gap-3">
        <label className="text-sm">Fecha del reporte
          <input name="fecha" type="date" defaultValue={hoy} className="mt-1 w-full rounded border p-2" />
        </label>
        <input name="archivo" type="file" accept=".csv" required className="rounded border p-2" />
        <button className="rounded bg-black p-2 text-white">Subir y procesar</button>
      </form>
    </main>
  )
}
