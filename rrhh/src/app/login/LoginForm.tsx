'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, Lock, Mail } from 'lucide-react'

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState(demo ? 'demo@eldesembarco.com' : '')
  const [password, setPassword] = useState(demo ? 'demo' : '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Email o contraseña incorrectos')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-bold text-ink-2">Email</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@eldesembarco.com"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-3 text-sm"
            autoComplete="email"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-ink-2">Contraseña</label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-3 text-sm"
            autoComplete="current-password"
          />
        </div>
      </div>
      {error && (
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-xs font-bold text-bad">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-extrabold text-white shadow-sm hover:bg-brand-strong disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        Ingresar
      </button>
      {demo && (
        <p className="text-center text-[11px] font-semibold text-ink-3">
          Modo demo · <span className="font-mono">demo@eldesembarco.com</span> / <span className="font-mono">demo</span>
        </p>
      )}
    </form>
  )
}
