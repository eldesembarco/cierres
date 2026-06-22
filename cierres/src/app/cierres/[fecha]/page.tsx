import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { CierreForm } from '@/components/CierreForm'
import { esCentral } from '@/lib/auth/rbac'

export default async function CierreDiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params
  const session = await auth()
  if (!session) return null
  const localId = esCentral(session.user.rol) ? 1 : session.user.localId ?? 1
  const local = await prisma.local.findUniqueOrThrow({ where: { id: localId } })

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-lg font-semibold">{local.nombre} · {fecha}</h1>
      <CierreForm fecha={fecha} fondoFijoDefault={Number(local.fondoFijoDefault)} />
    </main>
  )
}
