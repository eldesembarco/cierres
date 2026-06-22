import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { esCentral } from '@/lib/auth/rbac'

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
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cierres</h1>
        <Link href={`/cierres/${hoy}`} className="rounded bg-black px-3 py-2 text-white">
          + Cierre de hoy
        </Link>
      </div>
      <ul className="divide-y">
        {cierres.map((c) => (
          <li key={c.id} className="flex justify-between py-2">
            <Link
              href={`/cierres/${c.fecha.toISOString().slice(0, 10)}`}
              className="underline"
            >
              {c.fecha.toISOString().slice(0, 10)} · {c.local.nombre}
            </Link>
            <span className={c.estado === 'cerrado' ? 'text-green-600' : 'text-amber-600'}>
              {c.estado}
            </span>
          </li>
        ))}
        {cierres.length === 0 && (
          <li className="py-2 text-gray-500">Sin cierres todavía.</li>
        )}
      </ul>
    </main>
  )
}
