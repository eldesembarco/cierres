# Cierres de Caja — Fase 1 (MVP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el Excel de cierres de caja con una app web (carga mobile-first + ingesta de reportes de delivery + vista de control declarado-vs-app), corriendo el piloto con el local San Telmo.

**Architecture:** Next.js (App Router) + PostgreSQL como única fuente de verdad. La lógica de negocio (cálculo de totales, parsing de CSV, mapeo de tiendas) vive en funciones **puras y testeadas** bajo `src/lib`; las páginas/Server Actions son una capa fina encima. Auth propia (Auth.js Credentials) con roles `encargado/central/admin`.

**Tech Stack:** Next.js 15 + React 19 + TypeScript · PostgreSQL (Neon) · Prisma ORM · Auth.js v5 (`next-auth@beta`) + bcryptjs · Zod · papaparse · Tailwind CSS · Vitest (unit) · Playwright (E2E).

**Working directory convention:**
- Repo root: `C:\Users\ferra\Servicios` (acá ya viven `docs/`). Git se inicializa acá.
- La app Next.js vive en `cierres/`. **Todos los comandos `npm`/`npx` se corren dentro de `cierres/`.**
- Los `git` se corren desde la raíz; por eso los paths en los commits incluyen el prefijo `cierres/`.

**Spec de referencia:** `docs/superpowers/specs/2026-06-20-cierres-automatizacion-fase1-design.md`

---

## File Structure

```
cierres/
  prisma/
    schema.prisma                 # todas las tablas (sección 4 del spec)
    seed.ts                       # marcas, plataformas, San Telmo + mapeo, usuarios
  src/
    lib/
      db.ts                       # singleton PrismaClient
      money.ts                    # parseMoney, round2, sumMoney
      cierre/
        types.ts                  # Canal, CierreInput, CierreTotales
        calculations.ts           # calcularTotales (totales + diferencia de caja)
        schema.ts                 # Zod schema de la carga del cierre
      ingest/
        parsePedidosYa.ts         # CSV string -> ParsedRow[]
        mapRows.ts                # planIngest: ParsedRow[] + Mapping[] -> IngestPlan
        ingestService.ts          # orquesta parse+plan+escritura en DB (transacción)
      control/
        buildControlRows.ts       # declarado vs app -> ControlRow[]
        getControl.ts             # wrapper que lee de DB y arma las filas
      auth/
        password.ts               # hashPassword / verifyPassword
        auth.ts                   # config Auth.js (Credentials)
        rbac.ts                   # helpers de permisos por rol
    app/
      login/page.tsx
      api/auth/[...nextauth]/route.ts
      cierres/page.tsx            # lista de cierres del local
      cierres/[fecha]/page.tsx    # formulario de carga (un día)
      cierres/actions.ts          # Server Actions: guardarBorrador, cerrarCierre
      importaciones/page.tsx      # subida del CSV + resultado
      importaciones/actions.ts    # Server Action: subirCsv
      control/page.tsx            # vista declarado-vs-app
    components/
      CierreForm.tsx              # formulario client + resumen en vivo
      ControlTable.tsx            # tabla de control
  middleware.ts                   # protección de rutas por sesión/rol
  tests/
    unit/                         # vitest
    e2e/                          # playwright
  .env                            # DATABASE_URL, AUTH_SECRET
  vitest.config.ts
  playwright.config.ts
```

---

## Task 0: Inicializar proyecto y herramientas

**Files:**
- Create: `cierres/` (Next.js app), `cierres/vitest.config.ts`, `.gitignore` (raíz)

- [ ] **Step 1: Inicializar git en la raíz**

Run (desde `C:\Users\ferra\Servicios`):
```bash
git init
git add docs
git commit -m "chore: spec y plan de cierres fase 1"
```

- [ ] **Step 2: Crear la app Next.js**

Run (desde la raíz):
```bash
npx create-next-app@latest cierres --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```
Expected: crea `cierres/` con la estructura base de Next.js.

- [ ] **Step 3: Instalar dependencias**

Run (desde `cierres/`):
```bash
npm install @prisma/client next-auth@beta bcryptjs papaparse zod
npm install -D prisma vitest @vitejs/plugin-react @types/bcryptjs @types/papaparse @playwright/test tsx
```

- [ ] **Step 4: Configurar Vitest**

Create `cierres/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
```

Add to `cierres/package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"db:seed": "tsx prisma/seed.ts"
```

- [ ] **Step 5: Verificar que el scaffold corre**

Run (desde `cierres/`): `npm run build`
Expected: build OK (sin errores de TypeScript).

- [ ] **Step 6: Commit**

```bash
git add cierres .gitignore
git commit -m "chore: scaffold Next.js app + tooling (vitest, prisma, auth deps)"
```

---

## Task 1: Esquema Prisma + migración inicial

**Files:**
- Create: `cierres/prisma/schema.prisma`, `cierres/.env`
- Create: `cierres/src/lib/db.ts`

- [ ] **Step 1: Definir el datasource y `.env`**

Create `cierres/.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
AUTH_SECRET="genera-uno-con: npx auth secret"
```
(Usar una base Neon gratis para dev; ver README en Task 18.)

- [ ] **Step 2: Escribir el schema completo**

Create `cierres/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Marca {
  id      Int     @id @default(autoincrement())
  nombre  String  @unique
  activo  Boolean @default(true)
  locales Local[]
  @@map("marcas")
}

model Local {
  id               Int               @id @default(autoincrement())
  nombre           String
  marca            Marca             @relation(fields: [marcaId], references: [id])
  marcaId          Int               @map("marca_id")
  direccion        String?
  ciudad           String?
  pais             String            @default("AR")
  moneda           String            @default("ARS")
  fondoFijoDefault Decimal           @default(0) @map("fondo_fijo_default") @db.Decimal(14, 2)
  activo           Boolean           @default(true)
  mapeos           LocalPlataforma[]
  cierres          Cierre[]
  ventasApp        VentaApp[]
  usuarios         Usuario[]
  @@map("locales")
}

model Plataforma {
  id            Int               @id @default(autoincrement())
  nombre        String            @unique
  codigo        String            @unique
  activo        Boolean           @default(true)
  mapeos        LocalPlataforma[]
  ventasApp     VentaApp[]
  importaciones Importacion[]
  @@map("plataformas")
}

model LocalPlataforma {
  id                  Int        @id @default(autoincrement())
  local               Local      @relation(fields: [localId], references: [id])
  localId             Int        @map("local_id")
  plataforma          Plataforma @relation(fields: [plataformaId], references: [id])
  plataformaId        Int        @map("plataforma_id")
  restaurantIdExterno String     @map("restaurant_id_externo")
  nombreExterno       String?    @map("nombre_externo")
  activo              Boolean    @default(true)
  @@unique([plataformaId, restaurantIdExterno])
  @@map("local_plataforma")
}

enum Rol {
  encargado
  central
  admin
}

model Usuario {
  id           Int     @id @default(autoincrement())
  nombre       String
  email        String  @unique
  passwordHash String  @map("password_hash")
  rol          Rol
  local        Local?  @relation(fields: [localId], references: [id])
  localId      Int?    @map("local_id")
  activo       Boolean @default(true)
  @@map("usuarios")
}

enum EstadoCierre {
  borrador
  cerrado
}

model Cierre {
  id              Int           @id @default(autoincrement())
  local           Local         @relation(fields: [localId], references: [id])
  localId         Int           @map("local_id")
  fecha           DateTime      @db.Date
  fondoFijo       Decimal       @default(0) @map("fondo_fijo") @db.Decimal(14, 2)
  gastosTotal     Decimal       @default(0) @map("gastos_total") @db.Decimal(14, 2)
  notaCredito     Decimal       @default(0) @map("nota_credito") @db.Decimal(14, 2)
  cantidadTickets Int?          @map("cantidad_tickets")
  estado          EstadoCierre  @default(borrador)
  nota            String?
  creadoPor       Int           @map("creado_por")
  creadoEn        DateTime      @default(now()) @map("creado_en")
  actualizadoEn   DateTime      @updatedAt @map("actualizado_en")
  cerradoPor      Int?          @map("cerrado_por")
  cerradoEn       DateTime?     @map("cerrado_en")
  turnos          CierreTurno[]
  ventas          CierreVenta[]
  @@unique([localId, fecha])
  @@map("cierres")
}

enum Turno {
  T1
  T2
}

model CierreTurno {
  id       Int     @id @default(autoincrement())
  cierre   Cierre  @relation(fields: [cierreId], references: [id], onDelete: Cascade)
  cierreId Int     @map("cierre_id")
  turno    Turno
  montoZ   Decimal @default(0) @map("monto_z") @db.Decimal(14, 2)
  @@unique([cierreId, turno])
  @@map("cierre_turnos")
}

enum Canal {
  efectivo
  tarjetas
  rappi
  pedidosya
  mercadopago
  uber
  delivery_propio
  varios
}

model CierreVenta {
  id       Int     @id @default(autoincrement())
  cierre   Cierre  @relation(fields: [cierreId], references: [id], onDelete: Cascade)
  cierreId Int     @map("cierre_id")
  canal    Canal
  monto    Decimal @default(0) @db.Decimal(14, 2)
  @@unique([cierreId, canal])
  @@map("cierre_ventas")
}

model VentaApp {
  id              Int         @id @default(autoincrement())
  local           Local       @relation(fields: [localId], references: [id])
  localId         Int         @map("local_id")
  plataforma      Plataforma  @relation(fields: [plataformaId], references: [id])
  plataformaId    Int         @map("plataforma_id")
  fecha           DateTime    @db.Date
  pedidosEfectivo Int         @default(0) @map("pedidos_efectivo")
  pedidosOnline   Int         @default(0) @map("pedidos_online")
  ventaEfectivo   Decimal     @default(0) @map("venta_efectivo") @db.Decimal(14, 2)
  ventaOnline     Decimal     @default(0) @map("venta_online") @db.Decimal(14, 2)
  importacion     Importacion @relation(fields: [importacionId], references: [id])
  importacionId   Int         @map("importacion_id")
  creadoEn        DateTime    @default(now()) @map("creado_en")
  actualizadoEn   DateTime    @updatedAt @map("actualizado_en")
  @@unique([localId, plataformaId, fecha])
  @@map("ventas_app")
}

model Importacion {
  id             Int                    @id @default(autoincrement())
  plataforma     Plataforma             @relation(fields: [plataformaId], references: [id])
  plataformaId   Int                    @map("plataforma_id")
  fechaReporte   DateTime               @db.Date @map("fecha_reporte")
  archivoNombre  String                 @map("archivo_nombre")
  filasTotal     Int                    @map("filas_total")
  filasMapeadas  Int                    @map("filas_mapeadas")
  filasSinMapear Int                    @map("filas_sin_mapear")
  subidoPor      Int                    @map("subido_por")
  creadoEn       DateTime               @default(now()) @map("creado_en")
  ventasApp      VentaApp[]
  sinMapear      ImportacionSinMapear[]
  @@map("importaciones")
}

model ImportacionSinMapear {
  id                  Int         @id @default(autoincrement())
  importacion         Importacion @relation(fields: [importacionId], references: [id], onDelete: Cascade)
  importacionId       Int         @map("importacion_id")
  plataformaId        Int         @map("plataforma_id")
  restaurantIdExterno String      @map("restaurant_id_externo")
  nombreExterno       String?     @map("nombre_externo")
  ventaEfectivo       Decimal     @default(0) @map("venta_efectivo") @db.Decimal(14, 2)
  ventaOnline         Decimal     @default(0) @map("venta_online") @db.Decimal(14, 2)
  @@map("importacion_sin_mapear")
}
```

> Nota de diseño: el spec hablaba de `filas_ignoradas_red` además de `filas_sin_mapear`. En la práctica, desde el CSV no se puede distinguir "tienda de la red ajena" de "local propio con ID nuevo" sin un flag de propiedad. Por eso se unifica todo lo no mapeado en `filas_sin_mapear` + tabla `importacion_sin_mapear`, que central revisa (mapea si es propio, ignora si es de la red).

- [ ] **Step 3: Crear la migración**

Run (desde `cierres/`):
```bash
npx prisma migrate dev --name init
```
Expected: crea `prisma/migrations/.../migration.sql` y aplica el esquema a la base.

- [ ] **Step 4: Crear el cliente Prisma singleton**

Create `cierres/src/lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: Commit**

```bash
git add cierres/prisma cierres/src/lib/db.ts
git commit -m "feat: esquema Prisma de cierres + migración inicial"
```

---

## Task 2: Seed (catálogos + San Telmo + usuarios)

**Files:**
- Create: `cierres/prisma/seed.ts`

- [ ] **Step 1: Escribir el seed**

Create `cierres/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Marcas
  const desembarco = await prisma.marca.upsert({
    where: { nombre: 'Desembarco' }, update: {}, create: { nombre: 'Desembarco' },
  })
  await prisma.marca.upsert({ where: { nombre: 'Mila & Go' }, update: {}, create: { nombre: 'Mila & Go' } })
  await prisma.marca.upsert({ where: { nombre: 'Mr Tasty' }, update: {}, create: { nombre: 'Mr Tasty' } })

  // Plataformas
  const plataformas = [
    { nombre: 'PedidosYa', codigo: 'PY' },
    { nombre: 'Rappi', codigo: 'RA' },
    { nombre: 'Mercado Pago', codigo: 'MP' },
    { nombre: 'Uber', codigo: 'UE' },
  ]
  for (const p of plataformas) {
    await prisma.plataforma.upsert({ where: { codigo: p.codigo }, update: {}, create: p })
  }
  const py = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: 'PY' } })

  // Local piloto: Desembarco San Telmo
  const sanTelmo = await prisma.local.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: 'Desembarco San Telmo',
      marcaId: desembarco.id,
      ciudad: 'CABA',
      fondoFijoDefault: 500000,
    },
  })

  // Mapeo PedidosYa: Restaurant ID 517621 = Desembarco San Telmo
  await prisma.localPlataforma.upsert({
    where: { plataformaId_restaurantIdExterno: { plataformaId: py.id, restaurantIdExterno: '517621' } },
    update: {},
    create: {
      localId: sanTelmo.id,
      plataformaId: py.id,
      restaurantIdExterno: '517621',
      nombreExterno: 'El Desembarco San Telmo',
    },
  })

  // Usuarios
  const adminHash = await bcrypt.hash('admin1234', 10)
  const encHash = await bcrypt.hash('santelmo1234', 10)
  await prisma.usuario.upsert({
    where: { email: 'admin@eldesembarco.com' },
    update: {},
    create: { nombre: 'Admin', email: 'admin@eldesembarco.com', passwordHash: adminHash, rol: 'admin' },
  })
  await prisma.usuario.upsert({
    where: { email: 'santelmo@eldesembarco.com' },
    update: {},
    create: { nombre: 'Encargado San Telmo', email: 'santelmo@eldesembarco.com', passwordHash: encHash, rol: 'encargado', localId: sanTelmo.id },
  })

  console.log('Seed OK')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Correr el seed**

Run (desde `cierres/`): `npm run db:seed`
Expected: imprime "Seed OK" sin errores.

- [ ] **Step 3: Commit**

```bash
git add cierres/prisma/seed.ts cierres/package.json
git commit -m "feat: seed con marcas, plataformas, San Telmo y usuarios"
```

---

## Task 3: `money.ts` — parseo y redondeo de montos (TDD)

**Files:**
- Test: `cierres/tests/unit/money.test.ts`
- Create: `cierres/src/lib/money.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/money.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseMoney, round2, sumMoney } from '@/lib/money'

describe('parseMoney', () => {
  it('parsea formato en-US con coma de miles y punto decimal', () => {
    expect(parseMoney('102,883.50')).toBe(102883.5)
  })
  it('parsea cero', () => {
    expect(parseMoney('0.00')).toBe(0)
  })
  it('acepta números directamente', () => {
    expect(parseMoney(1726362.6)).toBe(1726362.6)
  })
  it('tira error con texto inválido', () => {
    expect(() => parseMoney('N/A')).toThrow()
  })
})

describe('round2', () => {
  it('redondea a 2 decimales', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('sumMoney', () => {
  it('suma y redondea', () => {
    expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6)
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run (desde `cierres/`): `npx vitest run tests/unit/money.test.ts`
Expected: FAIL — "Cannot find module '@/lib/money'".

- [ ] **Step 3: Implementar**

Create `cierres/src/lib/money.ts`:
```ts
/** El reporte endOfDay usa formato en-US: coma = separador de miles, punto = decimal. */
export function parseMoney(raw: string | number): number {
  if (typeof raw === 'number') return round2(raw)
  const cleaned = raw.trim().replace(/,/g, '')
  const n = Number(cleaned)
  if (cleaned === '' || Number.isNaN(n)) {
    throw new Error(`Monto inválido: "${raw}"`)
  }
  return round2(n)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sumMoney(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0))
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npx vitest run tests/unit/money.test.ts`
Expected: PASS (3 describes, todos verdes).

- [ ] **Step 5: Commit**

```bash
git add cierres/src/lib/money.ts cierres/tests/unit/money.test.ts
git commit -m "feat: helpers de dinero (parseMoney/round2/sumMoney) con tests"
```

---

## Task 4: Cálculo de totales del cierre (TDD)

**Files:**
- Create: `cierres/src/lib/cierre/types.ts`
- Test: `cierres/tests/unit/calculations.test.ts`
- Create: `cierres/src/lib/cierre/calculations.ts`

- [ ] **Step 1: Definir los tipos compartidos**

Create `cierres/src/lib/cierre/types.ts`:
```ts
export type Canal =
  | 'efectivo' | 'tarjetas' | 'rappi' | 'pedidosya'
  | 'mercadopago' | 'uber' | 'delivery_propio' | 'varios'

export type Turno = 'T1' | 'T2'

export interface CierreInput {
  fondoFijo: number
  gastosTotal: number
  notaCredito: number
  cantidadTickets?: number | null
  turnos: { turno: Turno; montoZ: number }[]
  ventas: { canal: Canal; monto: number }[]
}

export interface CierreTotales {
  ventaTotal: number
  ventaNeta: number
  ventaEfectivo: number
  totalZ: number
  saldoEfectivo: number
  diferenciaCaja: number
  ticketPromedio: number | null
}
```

- [ ] **Step 2: Escribir el test que falla**

Create `cierres/tests/unit/calculations.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { CierreInput } from '@/lib/cierre/types'

const base: CierreInput = {
  fondoFijo: 500000,
  gastosTotal: 10000,
  notaCredito: 0,
  cantidadTickets: 100,
  turnos: [{ turno: 'T1', montoZ: 183150 }, { turno: 'T2', montoZ: 920590 }],
  ventas: [
    { canal: 'efectivo', monto: 46200 },
    { canal: 'tarjetas', monto: 541700 },
    { canal: 'pedidosya', monto: 347250 },
    { canal: 'mercadopago', monto: 168590 },
  ],
}

describe('calcularTotales', () => {
  it('suma ventas por canal', () => {
    expect(calcularTotales(base).ventaTotal).toBe(1103740)
  })
  it('venta neta resta nota de crédito', () => {
    expect(calcularTotales({ ...base, notaCredito: 3740 }).ventaNeta).toBe(1100000)
  })
  it('totalZ suma los turnos', () => {
    expect(calcularTotales(base).totalZ).toBe(1103740)
  })
  it('diferencia de caja = totalZ - ventaTotal', () => {
    const r = calcularTotales({ ...base, ventas: [{ canal: 'efectivo', monto: 1103000 }] })
    expect(r.diferenciaCaja).toBe(740)
  })
  it('saldoEfectivo = ventaEfectivo - gastos', () => {
    expect(calcularTotales(base).saldoEfectivo).toBe(36200)
  })
  it('ticketPromedio es null cuando no hay tickets (no #DIV/0)', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 0 }).ticketPromedio).toBeNull()
    expect(calcularTotales({ ...base, cantidadTickets: null }).ticketPromedio).toBeNull()
  })
  it('ticketPromedio = ventaNeta / cantidadTickets', () => {
    expect(calcularTotales({ ...base, cantidadTickets: 2 }).ticketPromedio).toBe(551870)
  })
})
```

- [ ] **Step 3: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/calculations.test.ts`
Expected: FAIL — "Cannot find module '@/lib/cierre/calculations'".

- [ ] **Step 4: Implementar**

Create `cierres/src/lib/cierre/calculations.ts`:
```ts
import { round2, sumMoney } from '@/lib/money'
import type { CierreInput, CierreTotales } from '@/lib/cierre/types'

export function calcularTotales(input: CierreInput): CierreTotales {
  const ventaTotal = sumMoney(input.ventas.map((v) => v.monto))
  const ventaNeta = round2(ventaTotal - input.notaCredito)
  const ventaEfectivo = sumMoney(
    input.ventas.filter((v) => v.canal === 'efectivo').map((v) => v.monto),
  )
  const totalZ = sumMoney(input.turnos.map((t) => t.montoZ))
  const saldoEfectivo = round2(ventaEfectivo - input.gastosTotal)
  // Fórmula PROVISIONAL: se calibra contra el Excel en el piloto (spec sección 8).
  const diferenciaCaja = round2(totalZ - ventaTotal)
  const ticketPromedio =
    input.cantidadTickets && input.cantidadTickets > 0
      ? round2(ventaNeta / input.cantidadTickets)
      : null

  return { ventaTotal, ventaNeta, ventaEfectivo, totalZ, saldoEfectivo, diferenciaCaja, ticketPromedio }
}
```

- [ ] **Step 5: Correr el test (debe pasar)** y **commit**

Run: `npx vitest run tests/unit/calculations.test.ts` → Expected: PASS
```bash
git add cierres/src/lib/cierre
git commit -m "feat: cálculo de totales del cierre (diferencia de caja, ticket prom) con tests"
```

---

## Task 5: Schema Zod de la carga del cierre (TDD)

**Files:**
- Test: `cierres/tests/unit/cierreSchema.test.ts`
- Create: `cierres/src/lib/cierre/schema.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/cierreSchema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cierreInputSchema } from '@/lib/cierre/schema'

const valido = {
  fondoFijo: 500000, gastosTotal: 0, notaCredito: 0, cantidadTickets: 10,
  turnos: [{ turno: 'T1', montoZ: 100 }],
  ventas: [{ canal: 'efectivo', monto: 100 }],
}

describe('cierreInputSchema', () => {
  it('acepta una carga válida', () => {
    expect(cierreInputSchema.parse(valido).ventas[0].canal).toBe('efectivo')
  })
  it('rechaza montos negativos', () => {
    expect(() => cierreInputSchema.parse({ ...valido, gastosTotal: -1 })).toThrow()
  })
  it('rechaza un canal inválido', () => {
    expect(() => cierreInputSchema.parse({ ...valido, ventas: [{ canal: 'cripto', monto: 1 }] })).toThrow()
  })
  it('rechaza turnos duplicados', () => {
    expect(() => cierreInputSchema.parse({ ...valido, turnos: [{ turno: 'T1', montoZ: 1 }, { turno: 'T1', montoZ: 2 }] })).toThrow()
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/cierreSchema.test.ts` → Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

Create `cierres/src/lib/cierre/schema.ts`:
```ts
import { z } from 'zod'

const canal = z.enum(['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercadopago', 'uber', 'delivery_propio', 'varios'])
const turno = z.enum(['T1', 'T2'])
const monto = z.number().nonnegative()

export const cierreInputSchema = z.object({
  fondoFijo: monto,
  gastosTotal: monto,
  notaCredito: monto,
  cantidadTickets: z.number().int().nonnegative().nullable().optional(),
  turnos: z.array(z.object({ turno, montoZ: monto }))
    .refine((ts) => new Set(ts.map((t) => t.turno)).size === ts.length, 'Turnos duplicados'),
  ventas: z.array(z.object({ canal, monto }))
    .refine((vs) => new Set(vs.map((v) => v.canal)).size === vs.length, 'Canales duplicados'),
})

export type CierreInputParsed = z.infer<typeof cierreInputSchema>
```

- [ ] **Step 4: Correr el test (debe pasar)** y **commit**

Run: `npx vitest run tests/unit/cierreSchema.test.ts` → Expected: PASS
```bash
git add cierres/src/lib/cierre/schema.ts cierres/tests/unit/cierreSchema.test.ts
git commit -m "feat: validación Zod de la carga del cierre con tests"
```

---

## Task 6: Parser del CSV de PedidosYa (TDD)

**Files:**
- Test: `cierres/tests/unit/parsePedidosYa.test.ts`
- Create: `cierres/src/lib/ingest/parsePedidosYa.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/parsePedidosYa.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parsePedidosYa } from '@/lib/ingest/parsePedidosYa'

const csv = `Delivery platform,Store name,Restaurant ID,Orders paid with cash,Orders paid online,Cash sales,Online sales 
PY_AR,El Desembarco San Telmo,517621,1,21,"55,095.50","684,534.50"
PY_AR,El Desembarco - Pilar,393033,0,0,0.00,0.00
Total,,,357,2046,"8,205,335.60","52,378,541.50"`

describe('parsePedidosYa', () => {
  it('parsea las filas de tiendas y descarta la fila Total', () => {
    const rows = parsePedidosYa(csv)
    expect(rows).toHaveLength(2)
  })
  it('normaliza montos y tipos', () => {
    const row = parsePedidosYa(csv).find((r) => r.restaurantId === '517621')!
    expect(row.cashSales).toBe(55095.5)
    expect(row.onlineSales).toBe(684534.5)
    expect(row.ordersOnline).toBe(21)
    expect(row.plataformaCodigo).toBe('PY')
  })
  it('conserva tiendas en 0 (para distinguir 0 vendido de no reportado)', () => {
    const row = parsePedidosYa(csv).find((r) => r.restaurantId === '393033')!
    expect(row.cashSales).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/parsePedidosYa.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `cierres/src/lib/ingest/parsePedidosYa.ts`:
```ts
import Papa from 'papaparse'
import { parseMoney } from '@/lib/money'

export interface ParsedRow {
  plataformaCodigo: 'PY'
  restaurantId: string
  storeName: string
  deliveryPlatform: string
  ordersCash: number
  ordersOnline: number
  cashSales: number
  onlineSales: number
}

export function parsePedidosYa(csv: string): ParsedRow[] {
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const rows: ParsedRow[] = []
  for (const r of data) {
    const platform = (r['Delivery platform'] ?? '').trim()
    const restaurantId = (r['Restaurant ID'] ?? '').trim()
    // Descarta la fila de totales y filas sin ID.
    if (platform === 'Total' || restaurantId === '') continue
    rows.push({
      plataformaCodigo: 'PY',
      restaurantId,
      storeName: (r['Store name'] ?? '').trim(),
      deliveryPlatform: platform,
      ordersCash: Number(r['Orders paid with cash'] ?? 0),
      ordersOnline: Number(r['Orders paid online'] ?? 0),
      cashSales: parseMoney(r['Cash sales'] ?? '0'),
      onlineSales: parseMoney(r['Online sales'] ?? '0'),
    })
  }
  return rows
}
```

- [ ] **Step 4: Correr el test (debe pasar)** y **commit**

Run: `npx vitest run tests/unit/parsePedidosYa.test.ts` → Expected: PASS
```bash
git add cierres/src/lib/ingest/parsePedidosYa.ts cierres/tests/unit/parsePedidosYa.test.ts
git commit -m "feat: parser del CSV endOfDay de PedidosYa con tests"
```

---

## Task 7: Mapeo de filas a locales — `planIngest` (TDD)

**Files:**
- Test: `cierres/tests/unit/mapRows.test.ts`
- Create: `cierres/src/lib/ingest/mapRows.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/mapRows.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { planIngest } from '@/lib/ingest/mapRows'
import type { ParsedRow } from '@/lib/ingest/parsePedidosYa'

const rows: ParsedRow[] = [
  { plataformaCodigo: 'PY', restaurantId: '517621', storeName: 'San Telmo', deliveryPlatform: 'PY_AR', ordersCash: 1, ordersOnline: 21, cashSales: 55095.5, onlineSales: 684534.5 },
  { plataformaCodigo: 'PY', restaurantId: '999999', storeName: 'Ajena', deliveryPlatform: 'PY_AR', ordersCash: 0, ordersOnline: 5, cashSales: 0, onlineSales: 1000 },
]
const mappings = [{ plataformaId: 1, restaurantId: '517621', localId: 7 }]

describe('planIngest', () => {
  it('mapea filas conocidas a ventas_app', () => {
    const plan = planIngest(rows, mappings, 1)
    expect(plan.ventasApp).toHaveLength(1)
    expect(plan.ventasApp[0]).toMatchObject({ localId: 7, plataformaId: 1, ventaOnline: 684534.5, ventaEfectivo: 55095.5 })
  })
  it('manda las no mapeadas a sinMapear', () => {
    const plan = planIngest(rows, mappings, 1)
    expect(plan.sinMapear).toHaveLength(1)
    expect(plan.sinMapear[0].restaurantId).toBe('999999')
  })
  it('reporta los conteos', () => {
    const plan = planIngest(rows, mappings, 1)
    expect(plan).toMatchObject({ filasTotal: 2, filasMapeadas: 1, filasSinMapear: 1 })
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/mapRows.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `cierres/src/lib/ingest/mapRows.ts`:
```ts
import type { ParsedRow } from '@/lib/ingest/parsePedidosYa'

export interface Mapping { plataformaId: number; restaurantId: string; localId: number }

export interface PlannedVentaApp {
  localId: number
  plataformaId: number
  pedidosEfectivo: number
  pedidosOnline: number
  ventaEfectivo: number
  ventaOnline: number
}

export interface PlannedSinMapear {
  plataformaId: number
  restaurantId: string
  nombreExterno: string
  ventaEfectivo: number
  ventaOnline: number
}

export interface IngestPlan {
  ventasApp: PlannedVentaApp[]
  sinMapear: PlannedSinMapear[]
  filasTotal: number
  filasMapeadas: number
  filasSinMapear: number
}

export function planIngest(rows: ParsedRow[], mappings: Mapping[], plataformaId: number): IngestPlan {
  const byId = new Map(mappings.filter((m) => m.plataformaId === plataformaId).map((m) => [m.restaurantId, m.localId]))
  const ventasApp: PlannedVentaApp[] = []
  const sinMapear: PlannedSinMapear[] = []

  for (const r of rows) {
    const localId = byId.get(r.restaurantId)
    if (localId !== undefined) {
      ventasApp.push({
        localId,
        plataformaId,
        pedidosEfectivo: r.ordersCash,
        pedidosOnline: r.ordersOnline,
        ventaEfectivo: r.cashSales,
        ventaOnline: r.onlineSales,
      })
    } else {
      sinMapear.push({
        plataformaId,
        restaurantId: r.restaurantId,
        nombreExterno: r.storeName,
        ventaEfectivo: r.cashSales,
        ventaOnline: r.onlineSales,
      })
    }
  }

  return {
    ventasApp,
    sinMapear,
    filasTotal: rows.length,
    filasMapeadas: ventasApp.length,
    filasSinMapear: sinMapear.length,
  }
}
```

- [ ] **Step 4: Correr el test (debe pasar)** y **commit**

Run: `npx vitest run tests/unit/mapRows.test.ts` → Expected: PASS
```bash
git add cierres/src/lib/ingest/mapRows.ts cierres/tests/unit/mapRows.test.ts
git commit -m "feat: planIngest (mapeo de tiendas a locales) con tests"
```

---

## Task 8: Servicio de ingesta (escritura en DB, transacción)

**Files:**
- Create: `cierres/src/lib/ingest/ingestService.ts`

> El núcleo lógico ya está testeado (Tasks 6–7). Esta task agrega la capa fina de DB. La idempotencia se garantiza por el `UNIQUE(localId, plataformaId, fecha)` + `upsert`.

- [ ] **Step 1: Implementar el servicio**

Create `cierres/src/lib/ingest/ingestService.ts`:
```ts
import { prisma } from '@/lib/db'
import { parsePedidosYa } from '@/lib/ingest/parsePedidosYa'
import { planIngest, type Mapping } from '@/lib/ingest/mapRows'

export interface IngestArgs {
  csv: string
  plataformaCodigo: string
  fechaReporte: Date
  archivoNombre: string
  subidoPor: number
}

export interface IngestResult {
  importacionId: number
  filasTotal: number
  filasMapeadas: number
  filasSinMapear: number
}

export async function ingestCsv(args: IngestArgs): Promise<IngestResult> {
  const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: args.plataformaCodigo } })
  if (args.plataformaCodigo !== 'PY') {
    throw new Error(`Parser no implementado para la plataforma ${args.plataformaCodigo}`)
  }

  const rows = parsePedidosYa(args.csv)
  const mapeos = await prisma.localPlataforma.findMany({ where: { plataformaId: plataforma.id, activo: true } })
  const mappings: Mapping[] = mapeos.map((m) => ({ plataformaId: m.plataformaId, restaurantId: m.restaurantIdExterno, localId: m.localId }))
  const plan = planIngest(rows, mappings, plataforma.id)

  return prisma.$transaction(async (tx) => {
    const imp = await tx.importacion.create({
      data: {
        plataformaId: plataforma.id,
        fechaReporte: args.fechaReporte,
        archivoNombre: args.archivoNombre,
        filasTotal: plan.filasTotal,
        filasMapeadas: plan.filasMapeadas,
        filasSinMapear: plan.filasSinMapear,
        subidoPor: args.subidoPor,
      },
    })

    for (const v of plan.ventasApp) {
      await tx.ventaApp.upsert({
        where: { localId_plataformaId_fecha: { localId: v.localId, plataformaId: v.plataformaId, fecha: args.fechaReporte } },
        update: { pedidosEfectivo: v.pedidosEfectivo, pedidosOnline: v.pedidosOnline, ventaEfectivo: v.ventaEfectivo, ventaOnline: v.ventaOnline, importacionId: imp.id },
        create: { localId: v.localId, plataformaId: v.plataformaId, fecha: args.fechaReporte, pedidosEfectivo: v.pedidosEfectivo, pedidosOnline: v.pedidosOnline, ventaEfectivo: v.ventaEfectivo, ventaOnline: v.ventaOnline, importacionId: imp.id },
      })
    }

    if (plan.sinMapear.length > 0) {
      await tx.importacionSinMapear.createMany({
        data: plan.sinMapear.map((s) => ({ importacionId: imp.id, plataformaId: s.plataformaId, restaurantIdExterno: s.restaurantId, nombreExterno: s.nombreExterno, ventaEfectivo: s.ventaEfectivo, ventaOnline: s.ventaOnline })),
      })
    }

    return { importacionId: imp.id, filasTotal: plan.filasTotal, filasMapeadas: plan.filasMapeadas, filasSinMapear: plan.filasSinMapear }
  })
}
```

- [ ] **Step 2: Verificar compilación**

Run (desde `cierres/`): `npx tsc --noEmit`
Expected: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add cierres/src/lib/ingest/ingestService.ts
git commit -m "feat: servicio de ingesta de CSV (transacción + upsert idempotente)"
```

---

## Task 9: Control declarado-vs-app (TDD para la lógica + wrapper de DB)

**Files:**
- Test: `cierres/tests/unit/buildControlRows.test.ts`
- Create: `cierres/src/lib/control/buildControlRows.ts`
- Create: `cierres/src/lib/control/getControl.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/buildControlRows.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildControlRows } from '@/lib/control/buildControlRows'

describe('buildControlRows', () => {
  it('compara declarado vs app por plataforma de delivery', () => {
    const rows = buildControlRows(
      [{ canal: 'pedidosya', monto: 347250 }, { canal: 'efectivo', monto: 46200 }],
      [{ plataformaNombre: 'PedidosYa', ventaTotal: 350000 }],
    )
    const py = rows.find((r) => r.plataforma === 'PedidosYa')!
    expect(py.declarado).toBe(347250)
    expect(py.app).toBe(350000)
    expect(py.diferencia).toBe(-2750)
  })
  it('marca pct null cuando la app reporta 0', () => {
    const rows = buildControlRows([{ canal: 'rappi', monto: 1000 }], [{ plataformaNombre: 'Rappi', ventaTotal: 0 }])
    expect(rows.find((r) => r.plataforma === 'Rappi')!.pct).toBeNull()
  })
  it('ignora canales que no son de delivery', () => {
    const rows = buildControlRows([{ canal: 'efectivo', monto: 100 }], [])
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/buildControlRows.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar la lógica pura**

Create `cierres/src/lib/control/buildControlRows.ts`:
```ts
import { round2 } from '@/lib/money'
import type { Canal } from '@/lib/cierre/types'

const CANAL_A_PLATAFORMA: Partial<Record<Canal, string>> = {
  pedidosya: 'PedidosYa',
  rappi: 'Rappi',
  mercadopago: 'Mercado Pago',
  uber: 'Uber',
}

export interface DeclaredVenta { canal: Canal; monto: number }
export interface AppVenta { plataformaNombre: string; ventaTotal: number }

export interface ControlRow {
  plataforma: string
  declarado: number
  app: number
  diferencia: number
  pct: number | null
}

export function buildControlRows(declared: DeclaredVenta[], app: AppVenta[]): ControlRow[] {
  const appByPlataforma = new Map(app.map((a) => [a.plataformaNombre, a.ventaTotal]))
  const declaredByPlataforma = new Map<string, number>()
  for (const d of declared) {
    const plataforma = CANAL_A_PLATAFORMA[d.canal]
    if (plataforma) declaredByPlataforma.set(plataforma, (declaredByPlataforma.get(plataforma) ?? 0) + d.monto)
  }

  const plataformas = new Set<string>([...declaredByPlataforma.keys(), ...appByPlataforma.keys()])
  const result: ControlRow[] = []
  for (const plataforma of plataformas) {
    const declaradoMonto = round2(declaredByPlataforma.get(plataforma) ?? 0)
    const appMonto = round2(appByPlataforma.get(plataforma) ?? 0)
    const diferencia = round2(declaradoMonto - appMonto)
    const pct = appMonto !== 0 ? round2((diferencia / appMonto) * 100) : null
    result.push({ plataforma, declarado: declaradoMonto, app: appMonto, diferencia, pct })
  }
  return result.sort((a, b) => a.plataforma.localeCompare(b.plataforma))
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npx vitest run tests/unit/buildControlRows.test.ts` → Expected: PASS.

- [ ] **Step 5: Wrapper de DB**

Create `cierres/src/lib/control/getControl.ts`:
```ts
import { prisma } from '@/lib/db'
import { buildControlRows, type ControlRow } from '@/lib/control/buildControlRows'
import type { Canal } from '@/lib/cierre/types'

export interface ControlResult {
  localId: number
  fecha: Date
  rows: ControlRow[]
  faltaCierre: boolean
  faltaImportacion: boolean
}

export async function getControl(localId: number, fecha: Date): Promise<ControlResult> {
  const cierre = await prisma.cierre.findUnique({
    where: { localId_fecha: { localId, fecha } },
    include: { ventas: true },
  })
  const ventasApp = await prisma.ventaApp.findMany({ where: { localId, fecha }, include: { plataforma: true } })

  const declared = (cierre?.ventas ?? []).map((v) => ({ canal: v.canal as Canal, monto: Number(v.monto) }))
  const app = ventasApp.map((v) => ({ plataformaNombre: v.plataforma.nombre, ventaTotal: Number(v.ventaEfectivo) + Number(v.ventaOnline) }))

  return {
    localId,
    fecha,
    rows: buildControlRows(declared, app),
    faltaCierre: cierre === null,
    faltaImportacion: ventasApp.length === 0,
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add cierres/src/lib/control cierres/tests/unit/buildControlRows.test.ts
git commit -m "feat: control declarado-vs-app (lógica pura testeada + wrapper de DB)"
```

---

## Task 10: Password hashing (TDD)

**Files:**
- Test: `cierres/tests/unit/password.test.ts`
- Create: `cierres/src/lib/auth/password.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/password.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password', () => {
  it('verifica un hash válido', async () => {
    const hash = await hashPassword('secreto123')
    expect(await verifyPassword('secreto123', hash)).toBe(true)
  })
  it('rechaza una password incorrecta', async () => {
    const hash = await hashPassword('secreto123')
    expect(await verifyPassword('otra', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/password.test.ts` → Expected: FAIL.

- [ ] **Step 3: Implementar**

Create `cierres/src/lib/auth/password.ts`:
```ts
import bcrypt from 'bcryptjs'

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Correr el test (debe pasar)** y **commit**

Run: `npx vitest run tests/unit/password.test.ts` → Expected: PASS
```bash
git add cierres/src/lib/auth/password.ts cierres/tests/unit/password.test.ts
git commit -m "feat: hashing de passwords con tests"
```

---

## Task 11: Auth.js (Credentials) + RBAC + middleware

**Files:**
- Create: `cierres/src/lib/auth/auth.ts`, `cierres/src/lib/auth/rbac.ts`
- Create: `cierres/src/app/api/auth/[...nextauth]/route.ts`
- Create: `cierres/middleware.ts`
- Create: `cierres/src/types/next-auth.d.ts`

- [ ] **Step 1: Extender los tipos de sesión**

Create `cierres/src/types/next-auth.d.ts`:
```ts
import type { Rol } from '@prisma/client'

declare module 'next-auth' {
  interface User { rol: Rol; localId: number | null }
  interface Session { user: { id: string; nombre: string; email: string; rol: Rol; localId: number | null } }
}
declare module 'next-auth/jwt' {
  interface JWT { rol: Rol; localId: number | null; uid: string }
}
```

- [ ] **Step 2: Config de Auth.js**

Create `cierres/src/lib/auth/auth.ts`:
```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? '')
        const password = String(creds?.password ?? '')
        const user = await prisma.usuario.findUnique({ where: { email } })
        if (!user || !user.activo) return null
        if (!(await verifyPassword(password, user.passwordHash))) return null
        return { id: String(user.id), name: user.nombre, email: user.email, rol: user.rol, localId: user.localId }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.uid = user.id as string; token.rol = user.rol; token.localId = user.localId }
      return token
    },
    session({ session, token }) {
      session.user.id = token.uid
      session.user.rol = token.rol
      session.user.localId = token.localId
      return session
    },
  },
})
```

- [ ] **Step 3: Route handler + RBAC helpers**

Create `cierres/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth/auth'
export const { GET, POST } = handlers
```

Create `cierres/src/lib/auth/rbac.ts`:
```ts
import type { Rol } from '@prisma/client'

export const esCentral = (rol: Rol) => rol === 'central' || rol === 'admin'
export const puedeSubirCsv = (rol: Rol) => esCentral(rol)
export const puedeVerControl = (rol: Rol) => esCentral(rol)
export const puedeReabrir = (rol: Rol) => esCentral(rol)
export const esAdmin = (rol: Rol) => rol === 'admin'
```

- [ ] **Step 4: Middleware de protección**

Create `cierres/middleware.ts`:
```ts
import { auth } from '@/lib/auth/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLogin = req.nextUrl.pathname.startsWith('/login')
  if (!isLoggedIn && !isLogin) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = { matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'] }
```

- [ ] **Step 5: Verificar build**

Run (desde `cierres/`): `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add cierres/src/lib/auth cierres/src/app/api/auth cierres/middleware.ts cierres/src/types
git commit -m "feat: auth con roles (Auth.js Credentials) + RBAC + middleware"
```

---

## Task 12: Página de login

**Files:**
- Create: `cierres/src/app/login/page.tsx`

- [ ] **Step 1: Implementar**

Create `cierres/src/app/login/page.tsx`:
```tsx
import { signIn } from '@/lib/auth/auth'
import { redirect } from 'next/navigation'

export default function LoginPage() {
  async function login(formData: FormData) {
    'use server'
    try {
      await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      })
    } catch {
      redirect('/login?error=1')
    }
    redirect('/cierres')
  }

  return (
    <main className="mx-auto mt-16 max-w-sm p-6">
      <h1 className="mb-6 text-xl font-semibold">Cierres · Ingresar</h1>
      <form action={login} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="email" required className="rounded border p-2" />
        <input name="password" type="password" placeholder="contraseña" required className="rounded border p-2" />
        <button className="rounded bg-black p-2 text-white">Entrar</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Verificación manual**

Run (desde `cierres/`): `npm run dev` → entrar a `http://localhost:3000/login`, loguear con `santelmo@eldesembarco.com` / `santelmo1234`.
Expected: redirige a `/cierres` (que aún no existe → 404 esperado hasta Task 13).

- [ ] **Step 3: Commit**

```bash
git add cierres/src/app/login
git commit -m "feat: página de login"
```

---

## Task 13: Lista de cierres

**Files:**
- Create: `cierres/src/app/cierres/page.tsx`

- [ ] **Step 1: Implementar**

Create `cierres/src/app/cierres/page.tsx`:
```tsx
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { esCentral } from '@/lib/auth/rbac'

export default async function CierresPage() {
  const session = await auth()
  if (!session) return null
  const { rol, localId } = session.user

  const where = esCentral(rol) ? {} : { localId: localId ?? -1 }
  const cierres = await prisma.cierre.findMany({
    where,
    orderBy: { fecha: 'desc' },
    take: 60,
    include: { local: true },
  })

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cierres</h1>
        <Link href={`/cierres/${hoy}`} className="rounded bg-black px-3 py-2 text-white">+ Cierre de hoy</Link>
      </div>
      <ul className="divide-y">
        {cierres.map((c) => (
          <li key={c.id} className="flex justify-between py-2">
            <Link href={`/cierres/${c.fecha.toISOString().slice(0, 10)}`} className="underline">
              {c.fecha.toISOString().slice(0, 10)} · {c.local.nombre}
            </Link>
            <span className={c.estado === 'cerrado' ? 'text-green-600' : 'text-amber-600'}>{c.estado}</span>
          </li>
        ))}
        {cierres.length === 0 && <li className="py-2 text-gray-500">Sin cierres todavía.</li>}
      </ul>
    </main>
  )
}
```

- [ ] **Step 2: Verificación manual**

Recargar `http://localhost:3000/cierres` logueado.
Expected: muestra "Sin cierres todavía." y el botón "+ Cierre de hoy".

- [ ] **Step 3: Commit**

```bash
git add cierres/src/app/cierres/page.tsx
git commit -m "feat: lista de cierres con scope por rol"
```

---

## Task 14: Formulario de carga + Server Actions (guardar/cerrar)

**Files:**
- Create: `cierres/src/app/cierres/actions.ts`
- Create: `cierres/src/components/CierreForm.tsx`
- Create: `cierres/src/app/cierres/[fecha]/page.tsx`

- [ ] **Step 1: Server Actions**

Create `cierres/src/app/cierres/actions.ts`:
```ts
'use server'

import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { cierreInputSchema } from '@/lib/cierre/schema'
import { calcularTotales } from '@/lib/cierre/calculations'
import { esCentral } from '@/lib/auth/rbac'
import { revalidatePath } from 'next/cache'

const UMBRAL_DIFERENCIA = 1000 // $ — calibrar en el piloto

async function resolverLocalId(fecha: string) {
  const session = await auth()
  if (!session) throw new Error('No autenticado')
  const { rol, localId } = session.user
  if (!esCentral(rol)) {
    if (!localId) throw new Error('Encargado sin local asignado')
    return { localId, userId: Number(session.user.id), rol }
  }
  // central/admin: por ahora opera sobre San Telmo (local 1) en el piloto
  return { localId: 1, userId: Number(session.user.id), rol }
}

export async function guardarCierre(fecha: string, payloadJson: string, cerrar: boolean) {
  const { localId, userId } = await resolverLocalId(fecha)
  const input = cierreInputSchema.parse(JSON.parse(payloadJson))
  const totales = calcularTotales(input)
  const fechaDate = new Date(fecha)

  if (cerrar && Math.abs(totales.diferenciaCaja) > UMBRAL_DIFERENCIA && !((JSON.parse(payloadJson).nota ?? '').trim())) {
    return { ok: false as const, error: `La diferencia de caja es ${totales.diferenciaCaja}. Agregá una nota para cerrar.` }
  }

  await prisma.cierre.upsert({
    where: { localId_fecha: { localId, fecha: fechaDate } },
    update: {
      fondoFijo: input.fondoFijo, gastosTotal: input.gastosTotal, notaCredito: input.notaCredito,
      cantidadTickets: input.cantidadTickets ?? null, nota: JSON.parse(payloadJson).nota ?? null,
      estado: cerrar ? 'cerrado' : 'borrador',
      cerradoPor: cerrar ? userId : null, cerradoEn: cerrar ? new Date() : null,
      turnos: { deleteMany: {}, create: input.turnos.map((t) => ({ turno: t.turno, montoZ: t.montoZ })) },
      ventas: { deleteMany: {}, create: input.ventas.map((v) => ({ canal: v.canal, monto: v.monto })) },
    },
    create: {
      localId, fecha: fechaDate, fondoFijo: input.fondoFijo, gastosTotal: input.gastosTotal,
      notaCredito: input.notaCredito, cantidadTickets: input.cantidadTickets ?? null,
      nota: JSON.parse(payloadJson).nota ?? null, estado: cerrar ? 'cerrado' : 'borrador',
      creadoPor: userId, cerradoPor: cerrar ? userId : null, cerradoEn: cerrar ? new Date() : null,
      turnos: { create: input.turnos.map((t) => ({ turno: t.turno, montoZ: t.montoZ })) },
      ventas: { create: input.ventas.map((v) => ({ canal: v.canal, monto: v.monto })) },
    },
  })

  revalidatePath('/cierres')
  return { ok: true as const, totales }
}
```

- [ ] **Step 2: Componente de formulario (client) con resumen en vivo**

Create `cierres/src/components/CierreForm.tsx`:
```tsx
'use client'

import { useMemo, useState } from 'react'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { Canal, CierreInput } from '@/lib/cierre/types'
import { guardarCierre } from '@/app/cierres/actions'

const CANALES: Canal[] = ['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercadopago', 'uber', 'delivery_propio', 'varios']

export function CierreForm({ fecha, fondoFijoDefault, initial }: { fecha: string; fondoFijoDefault: number; initial?: Partial<CierreInput> }) {
  const [fondoFijo, setFondoFijo] = useState(initial?.fondoFijo ?? fondoFijoDefault)
  const [gastosTotal, setGastos] = useState(initial?.gastosTotal ?? 0)
  const [notaCredito, setNC] = useState(initial?.notaCredito ?? 0)
  const [cantidadTickets, setTickets] = useState<number | ''>(initial?.cantidadTickets ?? '')
  const [z1, setZ1] = useState(0)
  const [z2, setZ2] = useState(0)
  const [ventas, setVentas] = useState<Record<Canal, number>>(
    Object.fromEntries(CANALES.map((c) => [c, 0])) as Record<Canal, number>,
  )
  const [nota, setNota] = useState('')
  const [msg, setMsg] = useState('')

  const input: CierreInput = useMemo(() => ({
    fondoFijo, gastosTotal, notaCredito,
    cantidadTickets: cantidadTickets === '' ? null : Number(cantidadTickets),
    turnos: [{ turno: 'T1', montoZ: z1 }, { turno: 'T2', montoZ: z2 }],
    ventas: CANALES.map((c) => ({ canal: c, monto: ventas[c] })),
  }), [fondoFijo, gastosTotal, notaCredito, cantidadTickets, z1, z2, ventas])

  const t = calcularTotales(input)
  const semaforo = Math.abs(t.diferenciaCaja) === 0 ? '🟢' : Math.abs(t.diferenciaCaja) <= 1000 ? '🟡' : '🔴'

  async function submit(cerrar: boolean) {
    const res = await guardarCierre(fecha, JSON.stringify({ ...input, nota }), cerrar)
    setMsg(res.ok ? (cerrar ? 'Cerrado ✅' : 'Borrador guardado') : res.error)
  }

  const num = (v: number, set: (n: number) => void, label: string) => (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm">{label}</span>
      <input type="number" inputMode="decimal" value={v} onChange={(e) => set(Number(e.target.value))} className="w-36 rounded border p-1 text-right" />
    </label>
  )

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded border p-3">
        <h2 className="mb-2 font-medium">Caja</h2>
        {num(fondoFijo, setFondoFijo, 'Fondo fijo')}
        {num(z1, setZ1, 'Cierre Z · Turno 1')}
        {num(z2, setZ2, 'Cierre Z · Turno 2')}
        {num(gastosTotal, setGastos, 'Gastos')}
        {num(notaCredito, setNC, 'Nota de crédito')}
        <label className="flex items-center justify-between gap-2 py-1">
          <span className="text-sm">Cantidad de tickets</span>
          <input type="number" value={cantidadTickets} onChange={(e) => setTickets(e.target.value === '' ? '' : Number(e.target.value))} className="w-36 rounded border p-1 text-right" />
        </label>
      </section>

      <section className="rounded border p-3">
        <h2 className="mb-2 font-medium">Ventas por canal</h2>
        {CANALES.map((c) => num(ventas[c], (n) => setVentas((p) => ({ ...p, [c]: n })), c))}
      </section>

      <section className="sticky bottom-0 rounded border bg-white p-3 shadow">
        <div className="flex justify-between"><span>Venta total</span><b>{t.ventaTotal}</b></div>
        <div className="flex justify-between"><span>Venta neta</span><b>{t.ventaNeta}</b></div>
        <div className="flex justify-between"><span>Saldo efectivo</span><b>{t.saldoEfectivo}</b></div>
        <div className="flex justify-between"><span>Ticket promedio</span><b>{t.ticketPromedio ?? '—'}</b></div>
        <div className="flex justify-between"><span>Diferencia de caja</span><b>{semaforo} {t.diferenciaCaja}</b></div>
        {Math.abs(t.diferenciaCaja) > 1000 && (
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Justificá la diferencia para poder cerrar" className="mt-2 w-full rounded border p-1" />
        )}
        <div className="mt-2 flex gap-2">
          <button onClick={() => submit(false)} className="flex-1 rounded border p-2">Guardar borrador</button>
          <button onClick={() => submit(true)} className="flex-1 rounded bg-black p-2 text-white">Cerrar</button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Página del formulario**

Create `cierres/src/app/cierres/[fecha]/page.tsx`:
```tsx
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db'
import { CierreForm } from '@/components/CierreForm'
import { esCentral } from '@/lib/auth/rbac'

export default async function CierreDiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params
  const session = await auth()
  if (!session) return null
  const localId = esCentral(session.user.rol) ? 1 : session.user.localId ?? 1
  const local = await prisma.local.findUniqueOrThrow({ where: { id: localId } })

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-lg font-semibold">{local.nombre} · {fecha}</h1>
      <CierreForm fecha={fecha} fondoFijoDefault={Number(local.fondoFijoDefault)} />
    </main>
  )
}
```

- [ ] **Step 4: Verificación manual**

`npm run dev` → loguear → "+ Cierre de hoy" → cargar montos → ver el resumen actualizarse → Guardar borrador → volver a `/cierres` y ver el cierre listado como `borrador`.
Expected: el resumen calcula en vivo; el borrador persiste.

- [ ] **Step 5: Commit**

```bash
git add cierres/src/app/cierres cierres/src/components/CierreForm.tsx
git commit -m "feat: formulario de carga del cierre con resumen en vivo + guardar/cerrar"
```

---

## Task 15: Subida del CSV de apps

**Files:**
- Create: `cierres/src/app/importaciones/actions.ts`
- Create: `cierres/src/app/importaciones/page.tsx`

- [ ] **Step 1: Server Action de subida**

Create `cierres/src/app/importaciones/actions.ts`:
```ts
'use server'

import { auth } from '@/lib/auth/auth'
import { puedeSubirCsv } from '@/lib/auth/rbac'
import { ingestCsv } from '@/lib/ingest/ingestService'

export async function subirCsv(formData: FormData) {
  const session = await auth()
  if (!session || !puedeSubirCsv(session.user.rol)) return { ok: false as const, error: 'Sin permiso' }

  const file = formData.get('archivo') as File | null
  const fecha = String(formData.get('fecha') ?? '')
  if (!file || !fecha) return { ok: false as const, error: 'Falta archivo o fecha' }

  const csv = await file.text()
  try {
    const r = await ingestCsv({
      csv, plataformaCodigo: 'PY', fechaReporte: new Date(fecha),
      archivoNombre: file.name, subidoPor: Number(session.user.id),
    })
    return { ok: true as const, ...r }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'Error al procesar el CSV' }
  }
}
```

- [ ] **Step 2: Página de subida**

Create `cierres/src/app/importaciones/page.tsx`:
```tsx
import { auth } from '@/lib/auth/auth'
import { puedeSubirCsv } from '@/lib/auth/rbac'
import { subirCsv } from './actions'

export default async function ImportacionesPage() {
  const session = await auth()
  if (!session || !puedeSubirCsv(session.user.rol)) {
    return <main className="p-4">No tenés permiso para subir reportes.</main>
  }

  async function action(formData: FormData) {
    'use server'
    const r = await subirCsv(formData)
    // En MVP mostramos el resultado por consola del server; la vista detallada se itera luego.
    console.log('Resultado ingesta:', r)
  }

  const hoy = new Date().toISOString().slice(0, 10)
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-lg font-semibold">Importar reporte PedidosYa</h1>
      <form action={action} className="flex flex-col gap-3">
        <label className="text-sm">Fecha del reporte
          <input name="fecha" type="date" defaultValue={hoy} className="mt-1 w-full rounded border p-2" />
        </label>
        <input name="archivo" type="file" accept=".csv" required className="rounded border p-2" />
        <button className="rounded bg-black p-2 text-white">Subir y procesar</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Verificación manual**

Loguear como `admin@eldesembarco.com` / `admin1234` → ir a `/importaciones` → subir el CSV de ejemplo con fecha `2026-06-19`.
Expected: en la consola del server aparece `{ ok: true, filasMapeadas: 1, filasSinMapear: N }` (San Telmo `517621` mapea; el resto cae en sin mapear). Re-subir el mismo archivo no duplica (`ventas_app` se actualiza).

- [ ] **Step 4: Commit**

```bash
git add cierres/src/app/importaciones
git commit -m "feat: subida y procesamiento del CSV de PedidosYa (central/admin)"
```

---

## Task 16: Vista de control declarado-vs-app

**Files:**
- Create: `cierres/src/components/ControlTable.tsx`
- Create: `cierres/src/app/control/page.tsx`

- [ ] **Step 1: Tabla de control**

Create `cierres/src/components/ControlTable.tsx`:
```tsx
import type { ControlRow } from '@/lib/control/buildControlRows'

export function ControlTable({ rows }: { rows: ControlRow[] }) {
  if (rows.length === 0) return <p className="text-gray-500">Sin canales de delivery para comparar.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-1">Plataforma</th><th>Declarado</th><th>App</th><th>Dif.</th><th>%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const sem = Math.abs(r.diferencia) === 0 ? '🟢' : Math.abs(r.diferencia) <= 1000 ? '🟡' : '🔴'
          return (
            <tr key={r.plataforma} className="border-b">
              <td className="py-1">{r.plataforma}</td>
              <td>{r.declarado}</td><td>{r.app}</td>
              <td>{sem} {r.diferencia}</td>
              <td>{r.pct ?? '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Página de control**

Create `cierres/src/app/control/page.tsx`:
```tsx
import { auth } from '@/lib/auth/auth'
import { puedeVerControl } from '@/lib/auth/rbac'
import { getControl } from '@/lib/control/getControl'
import { ControlTable } from '@/components/ControlTable'

export default async function ControlPage({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const session = await auth()
  if (!session || !puedeVerControl(session.user.rol)) {
    return <main className="p-4">No tenés permiso para ver el control.</main>
  }
  const { fecha } = await searchParams
  const dia = fecha ?? new Date().toISOString().slice(0, 10)
  const control = await getControl(1, new Date(dia)) // piloto: San Telmo (local 1)

  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="mb-1 text-lg font-semibold">Control declarado vs app</h1>
      <form className="mb-3"><input name="fecha" type="date" defaultValue={dia} className="rounded border p-1" /></form>
      {control.faltaCierre && <p className="mb-2 text-amber-600">⚠️ Falta el cierre de este día.</p>}
      {control.faltaImportacion && <p className="mb-2 text-amber-600">⚠️ Falta importar el reporte de apps.</p>}
      <ControlTable rows={control.rows} />
    </main>
  )
}
```

- [ ] **Step 3: Verificación manual**

Con el cierre del 2026-06-19 cargado (con venta `pedidosya`) y el CSV importado para esa fecha, entrar a `/control?fecha=2026-06-19` como admin.
Expected: la tabla muestra PedidosYa con declarado vs app y la diferencia con semáforo.

- [ ] **Step 4: Commit**

```bash
git add cierres/src/app/control cierres/src/components/ControlTable.tsx
git commit -m "feat: vista de control declarado-vs-app (solo central/admin)"
```

---

## Task 17: E2E del flujo de carga (Playwright)

**Files:**
- Create: `cierres/playwright.config.ts`
- Create: `cierres/tests/e2e/cierre.spec.ts`

- [ ] **Step 1: Configurar Playwright**

Run (desde `cierres/`): `npx playwright install --with-deps chromium`

Create `cierres/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120000 },
})
```

Add to `package.json` `"scripts"`: `"test:e2e": "playwright test"`.

- [ ] **Step 2: Escribir el test E2E**

Create `cierres/tests/e2e/cierre.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('encargado carga y cierra un cierre', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name=email]', 'santelmo@eldesembarco.com')
  await page.fill('input[name=password]', 'santelmo1234')
  await page.click('button:has-text("Entrar")')

  await expect(page).toHaveURL(/\/cierres/)
  await page.click('text=+ Cierre de hoy')

  await page.getByText('Cierre Z · Turno 1').locator('input').fill('100000')
  // canal efectivo (primer input de la sección Ventas por canal)
  await page.getByText('efectivo', { exact: true }).locator('input').fill('100000')

  await page.click('button:has-text("Cerrar")')
  await expect(page.getByText('Cerrado')).toBeVisible()
})
```

- [ ] **Step 3: Correr el E2E**

Run (desde `cierres/`): `npm run test:e2e`
Expected: PASS (login → crear → cerrar).

- [ ] **Step 4: Commit**

```bash
git add cierres/playwright.config.ts cierres/tests/e2e cierres/package.json
git commit -m "test: e2e del flujo de carga del cierre"
```

---

## Task 18: README y notas de despliegue

**Files:**
- Create: `cierres/README.md`

- [ ] **Step 1: Escribir el README**

Create `cierres/README.md`:
```markdown
# Cierres de Caja — Fase 1 (MVP)

App de carga de cierres + ingesta de reportes de delivery + control declarado-vs-app.

## Setup local
1. `npm install`
2. Crear base Postgres (Neon: https://neon.tech) y poner `DATABASE_URL` en `.env`.
3. `npx auth secret` → pegar `AUTH_SECRET` en `.env`.
4. `npx prisma migrate dev`
5. `npm run db:seed`
6. `npm run dev`

## Usuarios seed
- admin@eldesembarco.com / admin1234 (admin)
- santelmo@eldesembarco.com / santelmo1234 (encargado San Telmo)

## Tests
- Unit: `npm test`
- E2E: `npm run test:e2e`

## Deploy (Vercel)
1. Importar el repo en Vercel, root directory `cierres/`.
2. Variables: `DATABASE_URL`, `AUTH_SECRET`.
3. Build command default; `npx prisma generate` corre en postinstall.
4. Correr `npx prisma migrate deploy` contra la base de producción.

## Piloto
Cargar San Telmo en paralelo al Excel ~1 mes. Calibrar:
- Fórmula de `diferenciaCaja` en `src/lib/cierre/calculations.ts` (hoy: `totalZ - ventaTotal`).
- `UMBRAL_DIFERENCIA` en `src/app/cierres/actions.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add cierres/README.md
git commit -m "docs: README y notas de despliegue del MVP"
```

---

## Self-Review (completado por el autor del plan)

**1. Cobertura del spec:**
- Modelo de datos (spec §4) → Task 1 (schema) + Task 2 (seed). ✅
- Cierre + cálculo de diferencia/ticket prom (spec §3, §5.1) → Tasks 4, 14. ✅
- Validaciones / unicidad / borrador-cerrado / umbral (spec §6) → Tasks 5, 14. ✅
- Ingesta CSV + normalización de montos + mapeo por Restaurant ID + idempotencia (spec §5.2, §7) → Tasks 6, 7, 8, 15. ✅
- Control declarado-vs-app + estados "falta cierre/importación" (spec §5.3) → Tasks 9, 16. ✅
- Roles/permisos (spec §6, control solo central/admin) → Tasks 11, 16. ✅
- Plan de prueba (spec §8) → tests unitarios por task + E2E Task 17. ✅
- **Gap aceptado:** la pantalla para *resolver* filas `importacion_sin_mapear` (asociar un ID nuevo a un local) no está en el MVP; las filas se guardan y se revisan, pero el piloto es San Telmo con su ID ya mapeado en el seed, así que no bloquea. Se agenda como primer ítem post-piloto.

**2. Placeholders:** sin TBD/TODO; todo el código está completo. La fórmula de `diferenciaCaja` y `UMBRAL_DIFERENCIA` son decisiones explícitas marcadas como "calibrar en el piloto", no placeholders.

**3. Consistencia de tipos:** `Canal`, `Turno`, `CierreInput`, `CierreTotales` (Task 4) reutilizados en Tasks 5, 9, 14. `ParsedRow` (Task 6) reutilizado en Task 7/8. `Mapping`/`IngestPlan` (Task 7) usados en Task 8. `ControlRow` (Task 9) usado en Task 16. Sesión extendida (`rol`, `localId`) en Task 11 usada en Tasks 13–16. ✅
