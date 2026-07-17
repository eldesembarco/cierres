import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'

// Next.js 16: `proxy.ts` (ex middleware). Instancia de Auth.js construida solo
// con authConfig (sin Credentials/prisma) para el chequeo de sesión.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/ingreso')
  if (!isLoggedIn && !isPublic) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  // /ingreso/[token] es el form público de onboarding (el ingresante no tiene
  // usuario todavía); se autentica por su token de invitación.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
}
