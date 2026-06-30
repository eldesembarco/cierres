# Conciliación de cupones por método — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir cargar líneas de detalle (referencia + importe) para cualquier método del cierre y conciliar en vivo la suma de cupones contra el total declarado, con semáforo.

**Architecture:** Una tabla hija nueva (`CierreDetalle`), una función pura de conciliación testeada (`conciliacion.ts`), persistencia en `guardarCierre` con el mismo patrón que turnos/tarjetas, y un componente cliente auto-contenido (`CuponesDetalle`) que se monta debajo de cada método en el formulario. Sin tocar el flujo de cierre (los cupones son optativos y no bloquean).

**Tech Stack:** Next.js 16 + React 19 · Prisma 7 (Neon, schema `cierres`) · Zod 4 · Tailwind v4 · Vitest 4.

**Working dir:** repo root `C:\Users\ferra\Servicios`; app en `cierres/` (npm/npx ahí; git desde la raíz con paths `cierres/...`). Spec: `docs/superpowers/specs/2026-06-23-conciliacion-cupones-design.md`. Commits terminan con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Estado actual relevante (ya en prod):**
- `CierreInput` = `{ fondoFijo, gastosTotal, notaCredito, cantidadTickets?, turnos[{turno,montoZ,efectivoDepositado}], ventas[{canal,monto}], tarjetas[{turno,tipo,monto,lote?}] }`.
- `Canal` = `'efectivo'|'tarjetas'|'rappi'|'pedidosya'|'mercado_pedidos'|'mercadopago'|'uber'|'delivery_propio'|'varios'`.
- `@/lib/money` exporta `parseMoney`, `round2`, `sumMoney`, `formatMoney`.
- `@/components/MoneyInput` es un input de moneda ya existente (confirmar su firma exacta de props al usarlo).
- `guardarCierre(fecha, payloadJson, cerrar)` hace `upsert` con `turnos/ventas/tarjetas: { deleteMany:{}, create:[...] }`.

---

## Task 1: Tabla `CierreDetalle` + migración

**Files:** Modify `cierres/prisma/schema.prisma`

- [ ] **Step 1: Agregar el modelo y la relación**

En `cierres/prisma/schema.prisma`, dentro del modelo `Cierre` agregar el campo de relación (junto a `turnos`, `ventas`, `tarjetas`):
```prisma
  detalles        CierreDetalle[]
```
Y agregar el modelo nuevo (al lado de `CierreVenta`):
```prisma
model CierreDetalle {
  id         Int     @id @default(autoincrement())
  cierre     Cierre  @relation(fields: [cierreId], references: [id], onDelete: Cascade)
  cierreId   Int     @map("cierre_id")
  canal      Canal
  referencia String  @default("")
  importe    Decimal @default(0) @db.Decimal(14, 2)
  orden      Int     @default(0)
  @@index([cierreId, canal])
  @@map("cierre_detalle")
}
```

- [ ] **Step 2: Migrar contra Neon (schema `cierres`)**

Run (desde `cierres/`). `prisma.config.ts` lee `process.env.DATABASE_URL`, así que exportalo desde `.env` (que ya trae `&schema=cierres` → NO toca el schema `public` de LucIA):
```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
npx prisma migrate dev --name cupones
```
Expected: crea `prisma/migrations/<ts>_cupones/` y aplica `cierre_detalle` en el schema `cierres`. Si la conexión pooled falla, usar el host directo (sin `-pooler`).

- [ ] **Step 3: Verificar el cliente**

Run: `npx prisma generate` then `npx tsc --noEmit` → sin errores (el cliente expone `prisma.cierreDetalle` y la relación `detalles`).

- [ ] **Step 4: Commit**

```bash
git add cierres/prisma
git commit -m "feat: tabla cierre_detalle (cupones por método) + migración"
```

---

## Task 2: Tipos + validación Zod de `detalles` (TDD)

**Files:** Modify `cierres/src/lib/cierre/types.ts`, `cierres/src/lib/cierre/schema.ts`, `cierres/tests/unit/cierreSchema.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Agregar a `cierres/tests/unit/cierreSchema.test.ts` (dentro del `describe('cierreInputSchema', ...)` existente):
```ts
  it('acepta detalles de cupones', () => {
    const r = cierreInputSchema.parse({ ...valido, detalles: [{ canal: 'mercadopago', referencia: 'MP6971', importe: 17500 }] })
    expect(r.detalles[0].referencia).toBe('MP6971')
  })
  it('detalles por defecto es []', () => {
    expect(cierreInputSchema.parse(valido).detalles).toEqual([])
  })
  it('rechaza importe de cupón negativo', () => {
    expect(() => cierreInputSchema.parse({ ...valido, detalles: [{ canal: 'mercadopago', referencia: 'x', importe: -1 }] })).toThrow()
  })
```

- [ ] **Step 2: Correr (debe fallar)**

Run: `npx vitest run tests/unit/cierreSchema.test.ts` → FAIL (`detalles` no existe en el schema).

- [ ] **Step 3: Implementar**

En `cierres/src/lib/cierre/types.ts`, agregar el tipo y el campo a `CierreInput`:
```ts
export interface Cupon { referencia: string; importe: number }
```
Dentro de `CierreInput` agregar:
```ts
  detalles: { canal: Canal; referencia: string; importe: number }[]
```

En `cierres/src/lib/cierre/schema.ts`, agregar dentro de `z.object({ ... })` (después de `tarjetas`):
```ts
  detalles: z.array(z.object({ canal, referencia: z.string(), importe: monto }))
    .default([]),
```

- [ ] **Step 4: Correr (debe pasar)**

Run: `npx vitest run tests/unit/cierreSchema.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add cierres/src/lib/cierre/types.ts cierres/src/lib/cierre/schema.ts cierres/tests/unit/cierreSchema.test.ts
git commit -m "feat: tipos + validación Zod de cupones (detalles)"
```

---

## Task 3: Lógica de conciliación (TDD)

**Files:** Create `cierres/src/lib/cierre/conciliacion.ts`, `cierres/tests/unit/conciliacion.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `cierres/tests/unit/conciliacion.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { conciliarLinea, conciliarCupones } from '@/lib/cierre/conciliacion'

describe('conciliarLinea', () => {
  it('cuadra exacto → ok, diferencia 0', () => {
    const r = conciliarLinea([17500, 19900], 37400)
    expect(r.sumaCupones).toBe(37400)
    expect(r.diferencia).toBe(0)
    expect(r.estado).toBe('ok')
  })
  it('descuadra → estado descuadre', () => {
    const r = conciliarLinea([100, 100], 250)
    expect(r.diferencia).toBe(-50)
    expect(r.estado).toBe('descuadre')
  })
  it('tolera $1 de redondeo', () => {
    expect(conciliarLinea([100.5, 100], 200.5).estado).toBe('ok')
  })
})

describe('conciliarCupones', () => {
  it('agrupa por canal y solo devuelve canales con detalle', () => {
    const res = conciliarCupones(
      [{ canal: 'mercadopago', referencia: 'a', importe: 100 }, { canal: 'mercadopago', referencia: 'b', importe: 100 }, { canal: 'rappi', referencia: 'c', importe: 50 }],
      [{ canal: 'mercadopago', monto: 200 }, { canal: 'rappi', monto: 80 }, { canal: 'efectivo', monto: 999 }],
    )
    expect(res).toHaveLength(2)
    const mp = res.find((r) => r.canal === 'mercadopago')!
    expect(mp.estado).toBe('ok')
    const rappi = res.find((r) => r.canal === 'rappi')!
    expect(rappi.diferencia).toBe(-30)
    expect(rappi.estado).toBe('descuadre')
  })
})
```

- [ ] **Step 2: Correr (debe fallar)**

Run: `npx vitest run tests/unit/conciliacion.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

Create `cierres/src/lib/cierre/conciliacion.ts`:
```ts
import { round2, sumMoney } from '@/lib/money'
import type { Canal } from '@/lib/cierre/types'

const TOLERANCIA = 1 // $ de redondeo

export type EstadoConciliacion = 'ok' | 'descuadre'

export interface ConciliacionResultado {
  sumaCupones: number
  declarado: number
  diferencia: number
  estado: EstadoConciliacion
}

export interface ConciliacionCanal extends ConciliacionResultado {
  canal: Canal
}

export function conciliarLinea(importes: number[], declarado: number): ConciliacionResultado {
  const sumaCupones = sumMoney(importes)
  const diferencia = round2(sumaCupones - declarado)
  const estado: EstadoConciliacion = Math.abs(diferencia) <= TOLERANCIA ? 'ok' : 'descuadre'
  return { sumaCupones, declarado, diferencia, estado }
}

export function conciliarCupones(
  detalles: { canal: Canal; referencia: string; importe: number }[],
  ventas: { canal: Canal; monto: number }[],
): ConciliacionCanal[] {
  const declaradoPorCanal = new Map(ventas.map((v) => [v.canal, v.monto]))
  const importesPorCanal = new Map<Canal, number[]>()
  for (const d of detalles) {
    if (!importesPorCanal.has(d.canal)) importesPorCanal.set(d.canal, [])
    importesPorCanal.get(d.canal)!.push(d.importe)
  }
  const res: ConciliacionCanal[] = []
  for (const [canal, importes] of importesPorCanal) {
    res.push({ canal, ...conciliarLinea(importes, declaradoPorCanal.get(canal) ?? 0) })
  }
  return res
}
```

- [ ] **Step 4: Correr (debe pasar)** y **commit**

Run: `npx vitest run tests/unit/conciliacion.test.ts` → PASS
```bash
git add cierres/src/lib/cierre/conciliacion.ts cierres/tests/unit/conciliacion.test.ts
git commit -m "feat: lógica de conciliación de cupones con tests"
```

---

## Task 4: Persistir `detalles` en `guardarCierre`

**Files:** Modify `cierres/src/app/cierres/actions.ts`

- [ ] **Step 1: Agregar el detalle al upsert**

En `cierres/src/app/cierres/actions.ts`, dentro de `guardarCierre`, después de calcular `input`, filtrar filas vacías y agregarlas al upsert. Agregar antes del `prisma.cierre.upsert`:
```ts
  const detalles = input.detalles.filter((d) => d.importe > 0 || d.referencia.trim() !== '')
```
En el bloque `update:` agregar (junto a `tarjetas`):
```ts
      detalles: { deleteMany: {}, create: detalles.map((d, i) => ({ canal: d.canal, referencia: d.referencia, importe: d.importe, orden: i })) },
```
En el bloque `create:` agregar:
```ts
      detalles: { create: detalles.map((d, i) => ({ canal: d.canal, referencia: d.referencia, importe: d.importe, orden: i })) },
```

- [ ] **Step 2: Verificar**

Run (desde `cierres/`): `npx tsc --noEmit` → sin errores. `npx vitest run` → todos verdes (no rompe nada).

- [ ] **Step 3: Commit**

```bash
git add cierres/src/app/cierres/actions.ts
git commit -m "feat: persistir cupones (detalles) en el cierre"
```

---

## Task 5: UI — componente `CuponesDetalle` + integración en `CierreForm`, verificación y deploy

**Files:** Create `cierres/src/components/CuponesDetalle.tsx`; Modify `cierres/src/components/CierreForm.tsx`

- [ ] **Step 1: Crear el componente auto-contenido**

Create `cierres/src/components/CuponesDetalle.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { conciliarLinea } from '@/lib/cierre/conciliacion'
import { formatMoney } from '@/lib/money'
import type { Cupon } from '@/lib/cierre/types'

export function CuponesDetalle({
  declarado,
  value,
  onChange,
}: {
  declarado: number
  value: Cupon[]
  onChange: (next: Cupon[]) => void
}) {
  const [open, setOpen] = useState(value.length > 0)

  const setRow = (i: number, patch: Partial<Cupon>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const addRow = () => onChange([...value, { referencia: '', importe: 0 }])
  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i))

  const con = conciliarLinea(value.map((c) => c.importe), declarado)
  const sem = con.estado === 'ok' ? '🟢' : '🔴'

  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-blue-600 hover:underline">
        {open ? 'Ocultar detalle' : 'Detalle / cupones'}{value.length > 0 ? ` (${value.length})` : ''}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          {value.map((c, i) => (
            <div key={i} className="mb-1 flex items-center gap-2">
              <input
                value={c.referencia}
                onChange={(e) => setRow(i, { referencia: e.target.value })}
                placeholder="N° cupón / ref."
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MoneyInput value={c.importe} onChange={(n: number) => setRow(i, { importe: n })} className="w-28" />
              <button type="button" onClick={() => removeRow(i)} aria-label="Quitar" className="px-1 text-slate-400 hover:text-red-600">&times;</button>
            </div>
          ))}
          <button type="button" onClick={addRow} className="mt-1 text-xs text-blue-600 hover:underline">+ agregar cupón</button>
          {value.length > 0 && (
            <div className="mt-2 border-t border-slate-200 pt-2 text-xs tabular-nums text-slate-600">
              Cupones: {formatMoney(con.sumaCupones)} &middot; Declarado: {formatMoney(con.declarado)} &middot; Dif: {formatMoney(con.diferencia)} {sem}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```
**IMPORTANTE:** confirmá la firma real de `MoneyInput` (abrí `cierres/src/components/MoneyInput.tsx`) y ajustá las props (`value`/`onChange`/`className`) si difieren. Confirmá también que `formatMoney` existe en `@/lib/money` (si no, usá `'$' + n.toLocaleString('es-AR')`).

- [ ] **Step 2: Integrar en `CierreForm`**

Abrí `cierres/src/components/CierreForm.tsx` y, siguiendo los patrones existentes (la lista `CANALES` y el estado de `ventas`):
1. Agregá estado para los cupones por canal:
```tsx
  const [detalles, setDetalles] = useState<Record<Canal, Cupon[]>>(
    Object.fromEntries(CANALES.map((c) => [c, [] as Cupon[]])) as Record<Canal, Cupon[]>,
  )
```
(importá `Cupon` desde `@/lib/cierre/types` y `CuponesDetalle` desde `@/components/CuponesDetalle`).
2. Debajo del input de cada canal en la sección "Ventas por canal", renderizá:
```tsx
  <CuponesDetalle
    declarado={ventas[c]}
    value={detalles[c]}
    onChange={(next) => setDetalles((p) => ({ ...p, [c]: next }))}
  />
```
3. Agregá los detalles al `input`/payload que se manda a `guardarCierre`, aplanando y descartando filas vacías:
```tsx
    detalles: CANALES.flatMap((c) =>
      detalles[c].filter((d) => d.importe > 0 || d.referencia.trim() !== '').map((d) => ({ canal: c, referencia: d.referencia, importe: d.importe })),
    ),
```
(donde se arma el objeto `CierreInput` que ya incluye `ventas`, `tarjetas`, etc.)

- [ ] **Step 3: Verificar todo**

Run (desde `cierres/`):
- `npx tsc --noEmit` → limpio.
- `npm run build` → compila.
- `npx vitest run` → todos verdes (incluye los nuevos tests).
- `npm run test:e2e` → PASS (no se tocó; cupones optativos). Si rompió por algún cambio en el form, ajustá selectores y dejalo verde.
- `npm run dev` (background ~15s) → `GET /login` 200; frená el server.

- [ ] **Step 4: Commit**

```bash
git add cierres/src/components/CuponesDetalle.tsx cierres/src/components/CierreForm.tsx
git commit -m "feat(ui): detalle de cupones por método con conciliación en vivo"
```

- [ ] **Step 5: Redeploy a producción**

Desde `cierres/`: `npx vercel deploy --prod --yes`. Si el CLI v54 dice "No existing credentials", leé el token de `%APPDATA%\com.vercel.cli\Data\auth.json` y pasá `--token <token>` (proyecto `cierres` ya linkeado, scope `polejavetzky-6352`). Verificá `GET https://cierres-seven.vercel.app/login` → 200.

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- Tabla `cierre_detalle` (§3) → Task 1. ✅
- `conciliarCupones` (§4) → Task 3. ✅
- Tipos + Zod `detalles` (§6) → Task 2. ✅
- Persistencia en `guardarCierre` (§6) → Task 4. ✅
- UI desplegable por método + conciliación en vivo (§5) → Task 5. ✅
- Optativo / no bloquea (§1, §6): no se agrega ninguna regla de cierre; los detalles vacíos se filtran. ✅
- Pruebas (§7): conciliacion.test.ts (Task 3) + extensión de cierreSchema.test.ts (Task 2); E2E intacto (Task 5). ✅
- No-objetivos (carga rápida, vista admin): no se incluyen. ✅

**Placeholders:** ninguno; código completo en cada paso. La única instrucción "confirmá la firma de MoneyInput" es una verificación real contra el código existente, no un placeholder.

**Consistencia de tipos:** `Cupon` (Task 2) usado en Task 5; `conciliarLinea`/`conciliarCupones` (Task 3) usados en Task 5/tests; `detalles` en `CierreInput` (Task 2) consumido por schema (Task 2), action (Task 4) y form (Task 5); modelo `CierreDetalle` con relación `detalles` (Task 1) usado por el upsert (Task 4). ✅
