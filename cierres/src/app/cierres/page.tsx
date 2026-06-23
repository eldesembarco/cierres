import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { esCentral } from '@/lib/auth/rbac'
import type { Turno } from '@/lib/cierre/types'
import { ScrollText, Plus, ChevronRight } from 'lucide-react'

function formatFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function estadoTexto(estado: string | undefined) {
  if (!estado) return '—'
  return estado === 'cerrado' ? 'cerrado' : 'borrador'
}

function TurnoChip({ label, estado }: { label: string; estado: string | undefined }) {
  const cls =
    estado === 'cerrado'
      ? 'bg-emerald-50 text-emerald-700'
      : estado === 'borrador'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-400'
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label} {estadoTexto(estado)}
    </span>
  )
}

export default async function CierresPage() {
  const session = await auth()
  if (!session) return null
  const { rol, localId } = session.user

  const where = esCentral(rol) ? {} : { localId: localId ?? -1 }
  const cierres = await prisma.cierre.findMany({
    where,
    orderBy: { fecha: 'desc' },
    take: 120,
    include: { local: true },
  })

  // Agrupar por (localId, fecha) → una fila por día.
  type Dia = {
    key: string
    localId: number
    localNombre: string
    fecha: string
    estados: Partial<Record<Turno, string>>
  }
  const diasMap = new Map<string, Dia>()
  for (const c of cierres) {
    const fecha = c.fecha.toISOString().slice(0, 10)
    const key = `${c.localId}|${fecha}`
    let dia = diasMap.get(key)
    if (!dia) {
      dia = { key, localId: c.localId, localNombre: c.local.nombre, fecha, estados: {} }
      diasMap.set(key, dia)
    }
    dia.estados[c.turno as Turno] = c.estado
  }
  const dias = [...diasMap.values()] // ya vienen ordenados por fecha desc

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

      {dias.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ScrollText size={22} />
          </span>
          <p className="font-medium text-slate-900">Sin cierres todavía.</p>
          <p className="mt-1 text-sm text-slate-500">Creá el primero con “+ Cierre de hoy”.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {dias.map((d) => (
            <li key={d.key}>
              <Link
                href={`/cierres/${d.fecha}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{formatFecha(d.fecha)}</p>
                  <p className="truncate text-sm text-slate-500">{d.localNombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <TurnoChip label="Mañana" estado={d.estados.manana} />
                    <TurnoChip label="Tarde" estado={d.estados.tarde} />
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
