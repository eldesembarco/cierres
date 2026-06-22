import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// La base Neon es compartida con otros proyectos (panel LucIA usa el schema
// "public"). Esta app vive en su propio schema "cierres" para no colisionar.
const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: 'cierres' },
)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
