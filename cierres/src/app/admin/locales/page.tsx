import { auth } from '@/lib/auth/auth'
import { puedeAdministrarLocales } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { Lock, Store } from 'lucide-react'
import { LocalesAdmin, type LocalRow } from './LocalesAdmin'

export default async function AdminLocalesPage() {
  const session = await auth()
  if (!session || !puedeAdministrarLocales(session.user.rol)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
          <Lock size={18} className="text-slate-400" />
          <p>No tenés permiso para administrar locales.</p>
        </div>
      </main>
    )
  }

  const [localesRaw, marcas] = await Promise.all([
    prisma.local.findMany({
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        marcaId: true,
        marca: { select: { nombre: true } },
        direccion: true,
        ciudad: true,
        fondoFijoDefault: true,
        tangoSucursalId: true,
        activo: true,
      },
    }),
    prisma.marca.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true },
    }),
  ])

  // El adapter pg de Prisma serializa Decimal como string en algunos paths;
  // convertimos acá para que el componente cliente reciba siempre un number.
  const locales: LocalRow[] = localesRaw.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    marcaId: l.marcaId,
    marcaNombre: l.marca.nombre,
    direccion: l.direccion,
    ciudad: l.ciudad,
    fondoFijoDefault: Number(l.fondoFijoDefault),
    tangoSucursalId: l.tangoSucursalId,
    activo: l.activo,
  }))

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <Store size={20} className="text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-900">Locales</h1>
      </div>
      <p className="-mt-2 text-sm text-slate-500">
        Alta y edición de sucursales. Un local nuevo queda disponible de inmediato en todos los
        selectores (cierres, importaciones, conciliación, etc.).
      </p>
      <LocalesAdmin locales={locales} marcas={marcas} />
    </main>
  )
}
