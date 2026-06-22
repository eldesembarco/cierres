# Cierres de Caja

App interna para reemplazar el Excel de cierres de caja de los locales de Grupo
Desembarco. Cada encargado carga el cierre diario de su local (cierre Z por turno,
gastos, ventas por canal) y la central controla lo declarado contra lo que reportan
las plataformas de delivery (PedidosYa, etc.) vía CSV.

Stack: **Next.js 16** (App Router, Server Actions) · **Prisma 7** (driver adapter `pg`)
· **Auth.js v5** (credenciales) · **Postgres en Neon** · **Vitest** + **Playwright**.

> Nota: esta versión de Next.js tiene cambios de API respecto a versiones previas.
> Ver `AGENTS.md` y los docs embebidos en `node_modules/next/dist/docs/` antes de tocar
> código de framework.

---

## Setup local

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Configurar `.env`** (copiar de `.env.example`). Necesitás dos variables:

   ```env
   # Para dev/migraciones usar el host DIRECTO de Neon (SIN -pooler).
   # IMPORTANTE: tiene que terminar en &schema=cierres (ver "Base compartida" abajo).
   DATABASE_URL="postgresql://user:password@host.sa-east-1.aws.neon.tech/neondb?sslmode=require&schema=cierres"
   AUTH_SECRET=""
   ```

   Generar el secret de Auth.js:

   ```bash
   npx auth secret
   ```

   (escribe `AUTH_SECRET` en `.env`).

3. **Migrar la base** (crea el schema `cierres` y sus tablas):

   ```bash
   npx prisma migrate dev
   ```

4. **Cargar datos semilla** (marcas, plataformas, local piloto San Telmo, mapeo PY
   `517621` → San Telmo, y los usuarios):

   ```bash
   npm run db:seed
   ```

5. **Levantar el server**

   ```bash
   npm run dev
   ```

   Abrir [http://localhost:3000](http://localhost:3000) → redirige a `/login`.

### Usuarios semilla

| Email                      | Contraseña     | Rol       | Local             |
| -------------------------- | -------------- | --------- | ----------------- |
| `admin@eldesembarco.com`   | `admin1234`    | admin     | — (ve todos)      |
| `santelmo@eldesembarco.com`| `santelmo1234` | encargado | San Telmo (id 1)  |

> Son credenciales de piloto. Cambialas antes de producción real.

---

## Tests

```bash
npm test         # unit (Vitest): cálculos, parser CSV, mapeo, control, schema, password
npm run test:e2e # end-to-end (Playwright): login → abrir cierre de hoy → cargar → cerrar
```

El E2E levanta `npm run dev` automáticamente (ver `playwright.config.ts`,
`reuseExistingServer: true`) y corre contra la base real, así que requiere `.env`
configurado. El cierre que crea es idempotente por `(localId, fecha)`, así que se puede
re-correr el mismo día sin chocar con la constraint única.

Antes de correr el E2E por primera vez instalá el browser:

```bash
npx playwright install chromium
```

---

## Deploy en Vercel

- **Root directory**: `cierres/` (el repo es un monorepo informal; esta app vive en su
  subcarpeta).
- **Variables de entorno** en el proyecto de Vercel:
  - `DATABASE_URL` → usar el host **POOLED** de Neon (el que tiene `-pooler` en el
    hostname) para el runtime serverless. **Siempre con `&schema=cierres`.**
  - `AUTH_SECRET` → el mismo formato que genera `npx auth secret`.
- **Migraciones en deploy**: las migraciones deben correr contra el host **DIRECTO**
  (sin `-pooler`), no contra el pooled. Aplicalas con:

  ```bash
  npx prisma migrate deploy
  ```

  (típicamente en un build/release step o manualmente con el `DATABASE_URL` directo).

| Uso                | Host Neon          | Comando                     |
| ------------------ | ------------------ | --------------------------- |
| Runtime (Vercel)   | POOLED (`-pooler`) | —                           |
| Migraciones/dev    | DIRECTO (sin pooler)| `prisma migrate deploy/dev` |

---

## ⚠️ Base compartida con LucIA — leer antes de migrar

Esta base Neon está **compartida con el proyecto Desembarco LucIA**. LucIA usa el schema
`public`; **Cierres vive en su propio schema `cierres`** para no colisionar.

El aislamiento depende de **dos** cosas, que tienen que coincidir siempre:

1. El sufijo `&schema=cierres` en `DATABASE_URL`.
2. La opción `{ schema: 'cierres' }` que pasa el adapter `pg` en
   `src/lib/db.ts` y `prisma/seed.ts`.

**Nunca** corras una migración, un `prisma db push`, ni un `prisma migrate reset` contra
un `DATABASE_URL` que **no** tenga `schema=cierres` — podrías tocar/borrar las tablas de
LucIA en `public`. Si dudás, verificá la URL antes de ejecutar cualquier comando
destructivo de Prisma.

---

## Calibración del piloto

Dos parámetros son **provisionales** y se ajustan contra el Excel real durante el piloto:

- **Fórmula de diferencia de caja** — en `src/lib/cierre/calculations.ts`:

  ```ts
  // Fórmula PROVISIONAL: se calibra contra el Excel en el piloto.
  const diferenciaCaja = round2(totalZ - ventaTotal)
  ```

  Es decir, diferencia = (suma de cierres Z de los turnos) − (suma de ventas por canal).
  Cuando se valide la lógica real del Excel (descontar gastos, nota de crédito, fondo
  fijo, etc.) hay que actualizar esta fórmula.

- **Umbral de diferencia** — `UMBRAL_DIFERENCIA` en `src/app/cierres/actions.ts`
  (hoy `1000`). Si al cerrar la diferencia supera el umbral en valor absoluto, la app
  exige una nota justificatoria para poder cerrar. Calibrar el monto según lo que se
  considere tolerable en el piloto.

El semáforo del form (`CierreForm.tsx`) usa los mismos cortes: 🟢 = 0, 🟡 ≤ 1000,
🔴 > 1000.
