import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { isDemo } from '@/lib/db'
import { Sidebar } from '@/components/shell/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  return (
    <div className="min-h-dvh">
      <Sidebar userName={session.user.name ?? session.user.email ?? 'Usuario'} demo={isDemo()} />
      <main className="ml-60 min-h-dvh px-8 py-7">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
