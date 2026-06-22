import { signIn } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'
import { ScrollText, AlertCircle } from 'lucide-react'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  async function login(formData: FormData) {
    'use server'
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      })
    } catch {
      redirect('/login?error=1')
    }
    redirect('/cierres')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <ScrollText size={24} strokeWidth={2.2} />
          </span>
          <h1 className="text-xl font-semibold text-slate-900">Cierres</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresá a tu panel</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
