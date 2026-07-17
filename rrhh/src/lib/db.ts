import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * Cliente Prisma contra el proyecto Supabase "rrhh" (schema public).
 * Lazy: sin DATABASE_URL la app corre en MODO DEMO (ver lib/demo.ts) y este
 * cliente no se instancia nunca — permite buildear/deployar antes de que
 * exista la base.
 */
export function getPrisma(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no configurada: la app está en modo demo')
  }
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    globalForPrisma.prisma = new PrismaClient({ adapter })
  }
  return globalForPrisma.prisma
}

/** true cuando no hay base conectada y la app sirve datos de ejemplo */
export function isDemo(): boolean {
  return !process.env.DATABASE_URL
}
