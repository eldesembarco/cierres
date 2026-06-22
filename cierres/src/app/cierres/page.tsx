import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { esCentral } from '@/lib/auth/rbac'
import { ScrollText, Plus, ChevronRight } from 'lucide-react'

function StatusBadge({ estado }: { estado: string }) {
  const cerrado = estado === 'cerrado'
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        cerrado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {cerrado ? 'Cerrado' : 'Borrador'}
    </span>
  )
}

function formatFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default async function CierresPage() {
  const session = await auth()
  if (!session) return null
  const { rol, localId } = session.user

  const where = esCentral(rol) ? {} : { localId: localId ?? -1 }
  const cierres = await prisma.cierre.findMany({
    where,
    orderBy: { fecha: 'desc' },
    take: 60,
    include: { local: true },
  })

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Cierres</h1>
        <Link
          href={`/cierres/${hoy}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">+ Cierre de hoy</span>
          <span className="sm:hidden">Cierre de hoy</span>
        </Link>
      </div>

      {cierres.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ScrollText size={22} />
          </span>
          <p className="font-medium text-slate-900">Sin cierres todavía.</p>
          <p className="mt-1 text-sm text-slate-500">Creá el primero con “+ Cierre de hoy”.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {cierres.map((c) => {
            const fecha = c.fecha.toISOString().slice(0, 10)
            return (
              <li key={c.id}>
                <Link
                  href={`/cierres/${fecha}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{formatFecha(fecha)}</p>
                    <p className="truncate text-sm text-slate-500">{c.local.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge estado={c.estado} />
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
