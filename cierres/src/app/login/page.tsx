import { signIn } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'

export default function LoginPage() {
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
    <main className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-6 text-xl font-semibold">Cierres · Ingresar</h1>
      <form action={login} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="email"
          required
          className="rounded border p-2"
        />
        <input
          name="password"
          type="password"
          placeholder="contraseña"
          required
          className="rounded border p-2"
        />
        <button className="rounded bg-black p-2 text-white">Entrar</button>
      </form>
    </main>
  )
}
