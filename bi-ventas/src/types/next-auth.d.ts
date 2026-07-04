import type { Rol } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    rol: Rol
    localId: number | null
  }
  interface Session {
    user: {
      id: string
      rol: Rol
      localId: number | null
    } & DefaultSession['user']
  }
}

// En next-auth v5 los callbacks usan el `JWT` de `@auth/core/jwt`. El módulo
// `next-auth/jwt` solo re-exporta (`export *`) ese tipo, así que augmentar
// `next-auth/jwt` NO mergea sobre el interface real y `token.uid` quedaría como
// `unknown`. Por eso augmentamos `@auth/core/jwt` directamente.
declare module '@auth/core/jwt' {
  interface JWT {
    rol: Rol
    localId: number | null
    uid: string
  }
}
