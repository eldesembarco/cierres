import { auth } from '@/lib/auth/auth'
import { puedeVerControl } from '@/lib/auth/rbac'
import { getControl } from '@/lib/control/getControl'
import { ControlTable } from '@/components/ControlTable'

export default async function ControlPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await auth()
  if (!session || !puedeVerControl(session.user.rol)) {
    return <main className="p-4">No tenés permiso para ver el control.</main>
  }
  const { fecha } = await searchParams
  const dia = fecha ?? new Date().toISOString().slice(0, 10)
  const control = await getControl(1, new Date(dia)) // piloto: San Telmo (local 1)

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-1 text-lg font-semibold">Control declarado vs app</h1>
      <form className="mb-3"><input name="fecha" type="date" defaultValue={dia} className="rounded border p-1" /></form>
      {control.faltaCierre && <p className="mb-2 text-amber-600">⚠️ Falta el cierre de este día.</p>}
      {control.faltaImportacion && <p className="mb-2 text-amber-600">⚠️ Falta importar el reporte de apps.</p>}
      <ControlTable rows={control.rows} />
    </main>
  )
}
