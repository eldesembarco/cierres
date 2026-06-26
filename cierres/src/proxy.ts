import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'

// Next.js 16 renombró `middleware.ts` a `proxy.ts` (el viejo nombre quedó
// deprecado). El proxy corre en el runtime Node.js por defecto. Usamos una
// instancia de Auth.js construida SOLO con `authConfig` (sin el provider de
// Credentials que arrastra prisma/bcrypt) para el chequeo de sesión.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLogin = req.nextUrl.pathname.startsWith('/login')
  if (!isLoggedIn && !isLogin) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  // api/tango/ingest y api/mp/ingest quedan fuera del chequeo de sesión: los llama
  // n8n sin sesión y se autentican por su propio header x-ingest-secret (ver routes).
  matcher: ['/((?!api/auth|api/tango/ingest|api/mp/ingest|_next/static|_next/image|favicon.ico).*)'],
}
