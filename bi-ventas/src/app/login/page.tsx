import { signIn } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'
import { TrendingUp, AlertCircle } from 'lucide-react'

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
    redirect('/')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
            <TrendingUp size={26} strokeWidth={2.2} />
          </span>
          <h1 className="text-2xl font-semibold text-slate-900">BI Ventas</h1>
          <p className="mt-0.5 text-sm font-medium text-slate-600">Grupo Desembarco</p>
          <p className="mt-1 text-xs text-slate-400">Acceso de administración (usuario de cierres)</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6">
          <form action={login} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={16} />
                <span>Email o contraseña incorrectos, o sin acceso al BI.</span>
              </div>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Contraseña</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button
              type="submit"
              className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
