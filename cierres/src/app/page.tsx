import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { homeFor } from '@/lib/auth/rbac'

export default async function Home() {
  const session = await auth()
  redirect(session ? homeFor(session.user.rol) : '/login')
}
