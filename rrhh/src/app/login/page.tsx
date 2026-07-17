import { redirect } from 'next/navigation'
import { Flame } from 'lucide-react'
import { auth } from '@/lib/auth/auth'
import { isDemo } from '@/lib/db'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Ingresar' }

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/')
  return (
    <div className="flex min-h-dvh">
      {/* Panel de marca */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-coal p-10 lg:flex">
        <div
          className="pointer-events-none absolute -right-32 -top-32 size-[480px] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #e8590c 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full opacity-15 blur-3xl"
          style={{ background: 'radial-gradient(circle, #e0a100 0%, transparent 70%)' }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-white shadow-[0_0_32px_rgba(232,89,12,0.5)]">
            <Flame className="size-5.5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight text-white">RRHH</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-coal-muted">Grupo Desembarco</div>
          </div>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight text-white">
            Toda la gente del grupo, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-coal-muted">
            Legajos digitales, organigrama, documentación al día y onboarding sin papeles
            para todos los locales de Desembarco, Mr.&nbsp;Tasty y Mila&nbsp;&amp;&nbsp;Go.
          </p>
        </div>
        <p className="relative text-[11px] font-semibold text-coal-muted">
          © {new Date().getFullYear()} Grupo Desembarco
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center bg-paper px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-6 flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-white">
                <Flame className="size-5" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-ink">RRHH · Grupo Desembarco</span>
            </div>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Ingresar</h2>
          <p className="mb-7 mt-1 text-sm text-ink-2">Accedé con tu usuario de RRHH.</p>
          <LoginForm demo={isDemo()} />
        </div>
      </div>
    </div>
  )
}
