'use client'
// Fila de tabla navegable: toda la fila lleva al legajo. Los <Td> llegan
// server-rendered como children — acá solo vive la interactividad.
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export function TrLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter()
  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          router.push(href)
        }
      }}
      onMouseEnter={() => router.prefetch(href)}
      className="group cursor-pointer outline-none transition-colors hover:bg-paper/60 focus-visible:bg-brand-soft/40 [&:last-child>td]:border-b-0"
    >
      {children}
    </tr>
  )
}
