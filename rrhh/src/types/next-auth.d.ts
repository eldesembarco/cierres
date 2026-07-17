import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    rol?: string
  }
  interface Session {
    user: {
      id: string
      rol: string
      name?: string | null
      email?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string
    rol: string
  }
}
