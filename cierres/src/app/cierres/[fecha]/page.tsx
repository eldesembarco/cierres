import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { CierreForm } from '@/components/CierreForm'
import { esCentral } from '@/lib/auth/rbac'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

function formatFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function CierreDiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params
  const session = await auth()
  if (!session) return null
  const localId = esCentral(session.user.rol) ? 1 : session.user.localId ?? 1
  const local = await prisma.local.findUniqueOrThrow({ where: { id: localId } })

  // Solo para mostrar el badge de estado en el header (lectura, no cambia el form).
  const existente = await prisma.cierre.findUnique({
    where: { localId_fecha: { localId, fecha: new Date(fecha) } },
    select: { estado: true },
  })
  const cerrado = existente?.estado === 'cerrado'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-5">
        <Link
          href="/cierres"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} /> Cierres
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{local.nombre}</h1>
            <p className="text-sm text-slate-500">Cierre del {formatFecha(fecha)}</p>
          </div>
          {existente && (
            <span
              className={`mt-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                cerrado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {cerrado ? 'Cerrado' : 'Borrador'}
            </span>
          )}
        </div>
      </div>
      <CierreForm fecha={fecha} fondoFijoDefault={Number(local.fondoFijoDefault)} />
    </main>
  )
}
