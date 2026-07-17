'use client'
import { LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      title="Cerrar sesión"
      className="rounded-md p-1.5 text-coal-muted hover:bg-white/10 hover:text-white"
    >
      <LogOut className="size-4" strokeWidth={2.25} />
    </button>
  )
}
