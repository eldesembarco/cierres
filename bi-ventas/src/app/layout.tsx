import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { auth, signOut } from '@/lib/auth/auth'
import { TrendingUp, LogOut } from 'lucide-react'
import { Nav } from '@/components/Nav'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BI Ventas · Grupo Desembarco',
  description: 'Ventas de los locales — facturación, horas y artículos (Tango)',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()

  async function logout() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {session && (
          <header className="border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <TrendingUp size={18} strokeWidth={2.2} />
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight text-slate-900">BI Ventas</div>
                <div className="text-xs leading-tight text-slate-500">Grupo Desembarco</div>
              </div>
              <div className="ml-3">
                <Nav />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden text-sm text-slate-500 sm:block">{session.user.name}</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <LogOut size={14} />
                    Salir
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  )
}
