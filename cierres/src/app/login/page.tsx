import { signIn } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { homeFor } from '@/lib/auth/rbac'
import { ScrollText, AlertCircle } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  async function login(formData: FormData) {
    'use server'
    const email = String(formData.get('email') ?? '')
    try {
      await signIn('credentials', {
        email,
        password: formData.get('password'),
        redirect: false,
      })
    } catch {
      redirect('/login?error=1')
    }
    // Pantalla de inicio según rol (contable → /reportes, resto → /cierres).
    const u = await prisma.usuario.findUnique({ where: { email }, select: { rol: true } })
    redirect(u ? homeFor(u.rol) : '/cierres')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
            <ScrollText size={26} strokeWidth={2.2} />
          </span>
          <h1 className="text-2xl font-semibold text-slate-900">Cierres</h1>
          <p className="mt-0.5 text-sm font-medium text-slate-600">Grupo Desembarco</p>
          <p className="mt-1 text-xs text-slate-400">Ingresá con tu email y contraseña</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6">
          <form action={login} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={16} />
                <span>Email o contraseña incorrectos.</span>
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                placeholder="vos@eldesembarco.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Contraseña</span>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <button className="mt-1 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              Entrar
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
