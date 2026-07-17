# RRHH · Grupo Desembarco

Sistema integral de RRHH (HRIS) del grupo: headcount, legajo digital 360°,
organigrama, documentos con vencimientos, onboarding self-service, vacaciones
y licencias.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma 7 + `@prisma/adapter-pg`
contra Postgres de Supabase (proyecto propio `rrhh`) · next-auth v5 (credentials).

## Modo demo

Sin `DATABASE_URL` la app corre con **datos de ejemplo determinísticos**
(`src/lib/demo.ts`): sirve para ver todo el front sin base. Login demo:
`demo@eldesembarco.com` / `demo`. Las mutaciones devuelven `demo: true` y no
persisten.

## Conectar la base (Supabase Pro)

1. Crear el proyecto `rrhh` en la org (región `sa-east-1`).
2. `.env`: `DATABASE_URL` (pooler transaction mode, puerto 6543, con
   `?pgbouncer=true`), `AUTH_SECRET`, `ADMIN_PASSWORD`.
3. `npx prisma db push` (aplica el esquema).
4. `npm run db:seed` (catálogos + usuario admin `polejavetzky@eldesembarco.com`).
5. Cargar las mismas env en Vercel y redeploy.

La importación de la nómina real desde el Sheet "Headcount 06.2026" es un
script aparte (pendiente, fase de conexión).

## Estructura

- `src/lib/data.ts` — capa de lectura (demo ↔ Prisma, mismo contrato)
- `src/lib/actions.ts` — server actions de mutación + audit log
- `src/components/ui/kit.tsx` — UI kit; `src/components/charts/` — gráficos
- `src/app/(app)/…` — dashboard, nomina, organigrama, documentos, onboarding,
  vacaciones, config
- `src/app/ingreso/[token]` — form público del ingresante (sin login)
