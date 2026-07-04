import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { authConfig } from '@/lib/auth/auth.config'

// Mismos usuarios que la app de cierres (tabla compartida), pero acá SOLO puede
// entrar administración: central/admin/contable. Los encargados no ven el BI.
const ROLES_BI = ['central', 'admin', 'contable']

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? '')
        const password = String(creds?.password ?? '')
        const user = await prisma.usuario.findUnique({ where: { email } })
        if (!user || !user.activo || !ROLES_BI.includes(user.rol)) return null
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
