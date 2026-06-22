import type { NextAuthConfig } from 'next-auth'

/**
 * Config sin provider: solo callbacks + pages.
 *
 * Esta parte no toca prisma/bcrypt/pg (que son Node-only) por lo que es segura
 * de importar desde `proxy.ts` (el ex-`middleware.ts`). En Next.js 16 el proxy
 * corre en Node.js por defecto, pero mantenemos el split-config recomendado por
 * Auth.js v5 para no arrastrar el provider con prisma al chequeo de sesión.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string
        token.rol = user.rol
        token.localId = user.localId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.uid
      session.user.rol = token.rol
      session.user.localId = token.localId
      return session
    },
  },
} satisfies NextAuthConfig
