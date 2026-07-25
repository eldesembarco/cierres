'use client'

import Link from 'next/link'
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { User } from 'lucide-react'

export function NavAuth() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <Link href="/sign-in" className="btn-ghost">
          <User size={14} /> Ingresar
        </Link>
      </SignedOut>
      <SignedIn>
        <Link href="/cuenta" className="btn-ghost">Mi cuenta</Link>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  )
}
