import { defineConfig } from 'prisma/config'

// Solo para `prisma generate`. Las migraciones del schema compartido las corre
// la app de cierres — no hay carpeta migrations acá a propósito.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
