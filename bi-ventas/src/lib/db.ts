import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Base Neon compartida con la app de cierres: los datos viven en el schema
// "cierres" (locales, usuarios y los agregados venta_tango_*). Esta app solo
// lee/escribe esas tablas; las migraciones las corre cierres.
const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: 'cierres' },
)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
