import type { NextAuthConfig } from 'next-auth'

/**
 * Config sin provider: solo callbacks + pages. No toca prisma/bcrypt/pg
 * (Node-only), así que es segura de importar desde `proxy.ts`.
 * Mismo patrón que cierres.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string
        token.rol = user.rol ?? 'RRHH'
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.uid
      session.user.rol = token.rol
      return session
    },
  },
} satisfies NextAuthConfig
