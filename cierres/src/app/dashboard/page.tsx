import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { getDashboardCached } from '@/lib/cachedData'
import { hoyAr, ayerAr } from '@/lib/fecha'
import { Dashboard } from '@/components/Dashboard'
import { Lock } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type SearchParams = Promise<{ fecha?: string }>

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session || !puedeVerFinanzas(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para ver el panel de administración.</p>
        </div>
      </main>
    )
  }
  const hoy = hoyAr()
  const sp = await searchParams
  const fecha = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : hoy
  const data = await getDashboardCached(fecha)
  return <Dashboard data={data} hoy={hoy} ayer={ayerAr()} />
}
