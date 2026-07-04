import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'

// Chequeo de sesión sin arrastrar prisma/bcrypt (split-config de Auth.js v5).
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLogin = req.nextUrl.pathname.startsWith('/login')
  if (!isLoggedIn && !isLogin) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  // /api/sync queda fuera: lo llama el cron de Vercel y se autentica por Bearer
  // CRON_SECRET (GET) o x-sync-secret (POST) en el propio handler.
  matcher: ['/((?!api/auth|api/sync|_next/static|_next/image|favicon.ico).*)'],
}
