# Cierre por turno (Mañana / Tarde) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Que un día tenga dos cierres independientes (turno Mañana y Tarde), cada uno con sus ventas/efectivo/gastos/diferencia y su propio estado, mostrados juntos en la planilla del día.

**Architecture:** El `Cierre` pasa a ser por `(local, fecha, turno)`. La lógica (`calcularTotales`) opera por turno; `sumarDia` agrega el día. La planilla `/cierres/[fecha]` renderiza dos componentes `TurnoCierre` (extraído del `CierreForm` actual) + total del día + import Tango. Parser Tango y mock `/api/tango` pasan a devolver por turno.

**Tech Stack:** Next.js 16 · Prisma 7 (Neon, schema `cierres`) · Zod 4 · Tailwind v4 · Vitest 4. Spec: `docs/superpowers/specs/2026-06-23-cierre-por-turno-design.md`. Commits terminan con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Working dir: app en `cierres/`, git desde raíz. **Deploy:** `TOKEN=$(grep -E '^VERCEL_TOKEN=' C:/Users/ferra/Servicios/cierres/.env | cut -d= -f2-); npx --yes vercel deploy --prod --yes --token "$TOKEN" --cwd C:/Users/ferra/Servicios/cierres`.

---

## Task 1: Schema refactor + migración (reset datos de prueba)

**Files:** `cierres/prisma/schema.prisma`

- [ ] Cambiar `enum Turno { T1 T2 }` → `enum Turno { manana tarde }`.
- [ ] En `Cierre`: agregar `turno Turno`, `montoZ Decimal @default(0) @map("monto_z") @db.Decimal(14,2)`, `efectivoDepositado Decimal @default(0) @map("efectivo_depositado") @db.Decimal(14,2)`. Quitar la relación `turnos CierreTurno[]`. Cambiar `@@unique([localId, fecha])` → `@@unique([localId, fecha, turno])`.
- [ ] Eliminar el modelo `CierreTurno`.
- [ ] En `CierreTarjeta`: quitar el campo `turno`; cambiar `@@unique([cierreId, turno, tipo])` → `@@unique([cierreId, tipo])`.
- [ ] Migrar (exportando DATABASE_URL desde `.env`, que tiene `&schema=cierres`):
```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' cierres/.env | cut -d= -f2- | tr -d '\"')"
cd cierres && npx prisma migrate dev --name cierre_por_turno
```
Si Prisma pide reset por el cambio de clave/columnas (datos de prueba): aceptar el reset (los cierres del piloto son de prueba). Confirmar que NO toca el schema `public`.
- [ ] `npx prisma generate` + `npx tsc --noEmit` (habrá errores en consumidores hasta Tasks 2-6; está bien que esta task deje el schema/migración y el cliente generados). Commit: `git add cierres/prisma && git commit -m "feat: cierre por turno — schema (turno manana/tarde, unique local+fecha+turno)"`.

## Task 2: Tipos + cálculo por turno + sumarDia (TDD)

**Files:** `cierres/src/lib/cierre/types.ts`, `calculations.ts`, `tests/unit/calculations.test.ts`

- [ ] Reescribir `types.ts`:
```ts
export type Canal = 'efectivo'|'tarjetas'|'rappi'|'pedidosya'|'mercado_pedidos'|'mercadopago'|'uber'|'delivery_propio'|'varios'
export type Turno = 'manana' | 'tarde'
export type TipoTarjeta = 'mastercard'|'maestro'|'visa_credito'|'visa_debito'|'amex'
export interface Cupon { referencia: string; importe: number }

export interface TurnoInput {
  fondoFijo: number
  montoZ: number
  efectivoDepositado: number
  gastosTotal: number
  notaCredito: number
  cantidadTickets?: number | null
  ventas: { canal: Canal; monto: number }[]
  tarjetas: { tipo: TipoTarjeta; monto: number; lote?: string | null }[]
  detalles: { canal: Canal; referencia: string; importe: number }[]
}
export interface TurnoTotales {
  ventaTotal: number; ventaNeta: number; ventaEfectivo: number
  saldoEfectivo: number; diferenciaCaja: number
  totalCredito: number; totalDebito: number; ticketPromedio: number | null
}
export interface DiaTotales { ventaTotalDia: number; ventaEfectivoDia: number; totalDepositadoDia: number; diferenciaDia: number }
```
- [ ] Test `calculations.test.ts` (reescribir):
```ts
import { describe, it, expect } from 'vitest'
import { calcularTotales, sumarDia } from '@/lib/cierre/calculations'
import type { TurnoInput } from '@/lib/cierre/types'

const base: TurnoInput = {
  fondoFijo: 500000, montoZ: 183150, efectivoDepositado: 46200, gastosTotal: 0, notaCredito: 0, cantidadTickets: 100,
  ventas: [{ canal: 'efectivo', monto: 46200 }, { canal: 'tarjetas', monto: 541700 }],
  tarjetas: [{ tipo: 'visa_credito', monto: 300000 }, { tipo: 'visa_debito', monto: 241700 }],
  detalles: [],
}
describe('calcularTotales (por turno)', () => {
  it('venta total y neta', () => { const t = calcularTotales(base); expect(t.ventaTotal).toBe(587900); expect(t.ventaNeta).toBe(587900) })
  it('diferencia = depositado - (efectivo - gastos)', () => { expect(calcularTotales(base).diferenciaCaja).toBe(0) })
  it('descuadre', () => { expect(calcularTotales({ ...base, efectivoDepositado: 40000 }).diferenciaCaja).toBe(-6200) })
  it('credito y debito', () => { const t = calcularTotales(base); expect(t.totalCredito).toBe(300000); expect(t.totalDebito).toBe(241700) })
  it('ticket promedio null si 0', () => { expect(calcularTotales({ ...base, cantidadTickets: 0 }).ticketPromedio).toBeNull() })
})
describe('sumarDia', () => {
  it('suma dos turnos', () => {
    const d = sumarDia([calcularTotales(base), calcularTotales(base)])
    expect(d.ventaTotalDia).toBe(1175800); expect(d.diferenciaDia).toBe(0)
  })
})
```
- [ ] Implementar `calculations.ts`:
```ts
import { round2, sumMoney } from '@/lib/money'
import type { TurnoInput, TurnoTotales, DiaTotales } from '@/lib/cierre/types'
const TIPOS_CREDITO = new Set(['mastercard', 'visa_credito', 'amex'])
const TIPOS_DEBITO = new Set(['maestro', 'visa_debito'])
export function calcularTotales(t: TurnoInput): TurnoTotales {
  const ventaTotal = sumMoney(t.ventas.map((v) => v.monto))
  const ventaNeta = round2(ventaTotal - t.notaCredito)
  const ventaEfectivo = sumMoney(t.ventas.filter((v) => v.canal === 'efectivo').map((v) => v.monto))
  const saldoEfectivo = round2(ventaEfectivo - t.gastosTotal)
  const diferenciaCaja = round2(t.efectivoDepositado - saldoEfectivo)
  const totalCredito = sumMoney(t.tarjetas.filter((x) => TIPOS_CREDITO.has(x.tipo)).map((x) => x.monto))
  const totalDebito = sumMoney(t.tarjetas.filter((x) => TIPOS_DEBITO.has(x.tipo)).map((x) => x.monto))
  const ticketPromedio = t.cantidadTickets && t.cantidadTickets > 0 ? round2(ventaNeta / t.cantidadTickets) : null
  return { ventaTotal, ventaNeta, ventaEfectivo, saldoEfectivo, diferenciaCaja, totalCredito, totalDebito, ticketPromedio }
}
export function sumarDia(turnos: TurnoTotales[]): DiaTotales {
  return {
    ventaTotalDia: sumMoney(turnos.map((t) => t.ventaTotal)),
    ventaEfectivoDia: sumMoney(turnos.map((t) => t.ventaEfectivo)),
    totalDepositadoDia: sumMoney(turnos.map((t) => t.diferenciaCaja + t.saldoEfectivo)),
    diferenciaDia: sumMoney(turnos.map((t) => t.diferenciaCaja)),
  }
}
```
- [ ] Correr `npx vitest run tests/unit/calculations.test.ts` (fail→pass). Commit: `git add cierres/src/lib/cierre/types.ts cierres/src/lib/cierre/calculations.ts cierres/tests/unit/calculations.test.ts && git commit -m "feat: cálculo de totales por turno + sumarDia"`.

## Task 3: Zod `turnoInputSchema` + conciliacion (TDD)

**Files:** `cierres/src/lib/cierre/schema.ts`, `tests/unit/cierreSchema.test.ts`, revisar `conciliacion.ts`

- [ ] Reescribir `schema.ts` como `turnoInputSchema` (un turno): campos `fondoFijo, montoZ, efectivoDepositado, gastosTotal, notaCredito` (montos `z.number().nonnegative()`), `cantidadTickets` int≥0 nullable opt, `ventas` array `{canal,monto}` con refine canales únicos, `tarjetas` array `{tipo,monto,lote?}` default `[]` (SIN turno), `detalles` array `{canal,referencia:string,importe}` default `[]`. Exportar `TurnoInputParsed = z.infer<...>`.
- [ ] Actualizar `tests/unit/cierreSchema.test.ts` al nuevo shape (válido mínimo: `{fondoFijo:0,montoZ:0,efectivoDepositado:0,gastosTotal:0,notaCredito:0,ventas:[{canal:'efectivo',monto:100}]}`; rechaza monto negativo; canal inválido; acepta `detalles`/`tarjetas` por defecto `[]`).
- [ ] Revisar `conciliacion.ts`: importa `Canal` de types (sigue existiendo) — sin cambios funcionales. Correr `npx vitest run` parcial (calculations, cierreSchema, conciliacion). Commit: `git add cierres/src/lib/cierre/schema.ts cierres/tests/unit/cierreSchema.test.ts && git commit -m "feat: zod turnoInputSchema (carga por turno)"`.

## Task 4: parseTango por turno + /api/tango (TDD)

**Files:** `cierres/src/lib/ingest/parseTango.ts`, `tests/unit/parseTango.test.ts`, `cierres/src/app/api/tango/route.ts`

- [ ] Reescribir `parseTango` para devolver por turno:
```ts
export interface TangoTurno { turno: Turno; ventas: { canal: Canal; monto: number }[]; montoZ: number; cantidadTickets: number | null }
export interface TangoParseResult { fecha: string | null; turnos: TangoTurno[] }
```
Mapear medio→canal (igual map `MEDIO_A_CANAL`). Turno: `T1`/`1`/`manana`/`mañana`→`manana`; `T2`/`2`/`tarde`→`tarde`. Por turno: agrupar ventas por canal (suma), `montoZ` = suma de importes del turno, `cantidadTickets` = suma de comprobantes del turno (null si 0).
- [ ] Test `parseTango.test.ts` (reescribir) con el CSV de 2 turnos: verifica `turnos` tiene manana y tarde, ventas por canal por turno, `montoZ` por turno (T1=756490 con efectivo46200+tarjetas541700+mp168590; T2=1435425), fecha.
- [ ] `/api/tango/route.ts`: el mock corre `parseTango` sobre el CSV embebido (7 filas, ambos turnos, fecha de hoy) y devuelve `TangoParseResult`. Mantener delay ~900ms y el comentario MOCK/swap-point.
- [ ] Correr `npx vitest run tests/unit/parseTango.test.ts` (fail→pass). Commit: `git add cierres/src/lib/ingest/parseTango.ts cierres/tests/unit/parseTango.test.ts cierres/src/app/api/tango/route.ts && git commit -m "feat: parseTango y /api/tango por turno"`.

## Task 5: actions `guardarCierre(fecha, turno, …)`

**Files:** `cierres/src/app/cierres/actions.ts`

- [ ] Cambiar la firma a `guardarCierre(fecha: string, turno: Turno, payloadJson: string, cerrar: boolean)`. Parsear con `turnoInputSchema`. Upsert por `where: { localId_fecha_turno: { localId, fecha: fechaDate, turno } }`. Persistir `turno, montoZ, efectivoDepositado, fondoFijo, gastosTotal, notaCredito, cantidadTickets, nota, estado` + hijos `ventas/tarjetas/detalles` (tarjetas sin `turno`) con `deleteMany+create`. Regla de nota por turno (`|diferenciaCaja|>UMBRAL`). `revalidatePath('/cierres')`. `resolverLocalId` igual.
- [ ] `npx tsc --noEmit` (puede tener errores en el form hasta Task 6). Commit: `git add cierres/src/app/cierres/actions.ts && git commit -m "feat: guardarCierre por turno"`.

## Task 6: UI — `TurnoCierre` + planilla del día + lista

**Files:** `cierres/src/components/TurnoCierre.tsx` (nuevo, basado en el actual `CierreForm.tsx`), `cierres/src/app/cierres/[fecha]/page.tsx`, `cierres/src/app/cierres/page.tsx`. Borrar `CierreForm.tsx` cuando `TurnoCierre` lo reemplace.

- [ ] **Leer el `CierreForm.tsx` actual** y refactorizarlo en `TurnoCierre.tsx`: un bloque de carga para UN turno. Props `{ fecha: string; turno: Turno; titulo: string; fondoFijoDefault: number; inicial?: Partial<TurnoInput> }`. Estado interno: montoZ, efectivoDepositado, gastos, NC, tickets, ventas (record por canal), tarjetas (sin turno: por tipo), cupones (detalles), nota. Resumen en vivo con `calcularTotales` (venta total, depositado, **diferencia con semáforo**). Botones "Guardar borrador"/"Cerrar" → `guardarCierre(fecha, turno, JSON.stringify({...input, nota}), cerrar)`. Exponer un método/`ref` o `imperativeHandle`/callback para que la planilla pueda **precargar** sus campos desde Tango (ej. prop `precargaRef` o un store via `onReady`); alternativa simple: que `TurnoCierre` acepte `inicial` y la planilla le pase nuevas `inicial` keys (re-mount con `key`) al importar. Elegir el enfoque más simple que permita la precarga de ambos turnos.
- [ ] **Planilla `/cierres/[fecha]/page.tsx`**: server component que lee los dos cierres-turno (`prisma.cierre.findMany({ where: { localId, fecha } })`), arma `inicial` de cada turno, y renderiza un client wrapper con: panel **Total del día** arriba (usa `sumarDia` con los totales en vivo de ambos turnos), botón **"Importar desde Tango"** (fetch `/api/tango`, distribuye `result.turnos` a cada `TurnoCierre`), y los dos `TurnoCierre` (Mañana / Tarde). El estado de los totales del día puede vivir en el wrapper (cada `TurnoCierre` reporta sus totales por callback `onTotales`).
- [ ] **Lista `/cierres/page.tsx`**: agrupar por `(localId, fecha)` → una fila por día. Mostrar fecha + local + estado resumido por turno (ej. "Mañana cerrado · Tarde borrador"). Link a `/cierres/[fecha]`.
- [ ] Verificar: `npx tsc --noEmit` limpio, `npm run build` OK.
- [ ] Commit: `git add cierres/src && git commit -m "feat(ui): planilla por turno (Mañana/Tarde) + total del día + import Tango por turno"`.

## Task 7: E2E + verificación final + deploy

**Files:** `cierres/tests/e2e/cierre.spec.ts`

- [ ] Actualizar el E2E: login encargado → "+ Cierre de hoy" → en el bloque **Mañana** llenar montoZ + efectivo depositado + efectivo (igual → diferencia 0) → "Cerrar" del bloque Mañana → assert "Cerrado". Ajustar selectores al nuevo DOM (bloques por turno).
- [ ] Verificar todo: `npx tsc --noEmit`, `npm run build`, `npx vitest run` (todo verde), `npm run test:e2e` (PASS). `npm run dev` → `/login` 200.
- [ ] Commit lo que falte. **Deploy** con el token del `.env` (comando arriba). Verificar `curl -s -o /dev/null -w "%{http_code}" https://cierres-seven.vercel.app/login` → 200.

---

## Self-Review
- Spec §3 (modelo) → Task 1. §4 (tipos/cálculo) → Tasks 2-3. §5 (persistencia) → Task 5. §6 (UI) → Task 6. §7 (Tango) → Task 4. §9 (tests) → Tasks 2,3,4,7. ✅
- Consistencia: `TurnoInput`/`TurnoTotales`/`Turno`/`Cupon` (Task 2) usados en 3,5,6; `turnoInputSchema` (3) en actions (5); `TangoParseResult` por turno (4) en la planilla (6); `guardarCierre(fecha,turno,…)` (5) llamado por `TurnoCierre` (6). ✅
- Riesgo UI (Task 6 grande): el `TurnoCierre` se basa 1:1 en el `CierreForm` actual (mismo contenido, scope a un turno); la planilla compone dos + total del día. El agente debe leer el form actual antes de refactorizar.
