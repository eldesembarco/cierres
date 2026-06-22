import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { authConfig } from '@/lib/auth/auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? '')
        const password = String(creds?.password ?? '')
        const user = await prisma.usuario.findUnique({ where: { email } })
        if (!user || !user.activo) return null
        if (!(await verifyPassword(password, user.passwordHash))) return null
        return {
          id: String(user.id),
          name: user.nombre,
          email: user.email,
          rol: user.rol,
          localId: user.localId,
        }
      },
    }),
  ],
})
