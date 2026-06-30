# Cierre por turno (Mañana / Tarde) — Diseño

- **Fecha:** 2026-06-23
- **Estado:** Diseño aprobado — pendiente de plan
- **Contexto mayor:** refactor del modelo de cierre (ver `2026-06-20-cierres-automatizacion-fase1-design.md`). App en producción; datos del piloto son de prueba → se pueden resetear al migrar.

## 1. Qué cambia y por qué

Hoy hay **un cierre por (local, fecha)** con los turnos como subtotales del Z. El negocio cierra **por turno**: un día tiene **dos cierres** (turno **Mañana** y turno **Tarde**), cada uno con sus propias ventas, efectivo, gastos y **diferencia**, y se **cierran por separado**. Se ven **juntos en la misma planilla** del día.

## 2. Decisiones (brainstorm 2026-06-23)
- Un día = **dos cierres** (mañana/tarde). Modelo: cierre por **(local, fecha, turno)**.
- **Todo es por turno**: ventas por método, cierre Z, efectivo depositado, tarjetas, cupones, **gastos**, **nota de crédito**, tickets, diferencia y **estado** (cada turno borrador/cerrado por separado).
- **Del local/día:** fondo fijo (se guarda en cada cierre, default del local) y fecha.
- **Lista:** una fila por **día**; al abrir, la planilla muestra los dos turnos + total del día.
- **Tango:** "Importar desde Tango" trae los datos **de ambos turnos** y completa los dos bloques.

## 3. Modelo de datos (refactor)

- `enum Turno { manana tarde }` (reemplaza `T1 T2`). Se muestra "Mañana"/"Tarde".
- **`Cierre`** pasa a ser **por turno**:
  - Agrega `turno Turno`, `montoZ Decimal`, `efectivoDepositado Decimal` (estos dos venían de `CierreTurno`).
  - Mantiene (ahora por turno): `fondoFijo`, `gastosTotal`, `notaCredito`, `cantidadTickets`, `estado`, `nota`, auditoría (`creadoPor/En`, `cerradoPor/En`, `actualizadoEn`).
  - Clave única: `@@unique([localId, fecha, turno])` (antes `[localId, fecha]`).
  - Hijos: `ventas` (CierreVenta), `tarjetas` (CierreTarjeta), `detalles` (CierreDetalle) — ahora cuelgan del cierre **del turno**.
- **Eliminar `CierreTurno`** (subsumido por el cierre-turno).
- **`CierreTarjeta`**: quitar el campo `turno`; unique pasa a `@@unique([cierreId, tipo])`.
- `CierreVenta`, `CierreDetalle`: sin cambios estructurales (ahora por cierre-turno).
- **Migración:** resetear las filas de `cierres` y descendientes del piloto (datos de prueba) antes/durante el cambio de clave. Schema `cierres` en Neon (no tocar `public`/LucIA).

## 4. Tipos y lógica (`src/lib/cierre`)

- `Turno = 'manana' | 'tarde'`.
- **`TurnoInput`** (la carga de UN turno):
  `{ fondoFijo, montoZ, efectivoDepositado, gastosTotal, notaCredito, cantidadTickets?, ventas:[{canal,monto}], tarjetas:[{tipo,monto,lote?}], detalles:[{canal,referencia,importe}] }`. (Sin `turnos[]`; tarjetas sin `turno`.)
- **`TurnoTotales`** = `{ ventaTotal, ventaNeta, ventaEfectivo, saldoEfectivo, diferenciaCaja, totalCredito, totalDebito, ticketPromedio }`.
- **`calcularTotales(t: TurnoInput): TurnoTotales`** (por turno). Fórmula validada: `diferenciaCaja = round2(efectivoDepositado − (ventaEfectivo − gastosTotal))`. `ventaTotal = sum(ventas)`, `ventaNeta = ventaTotal − notaCredito`, crédito/débito por tipo de tarjeta, `ticketPromedio = ventaNeta/tickets` (null si 0).
- **`sumarDia(turnos: TurnoTotales[]): { ventaTotalDia, ventaEfectivoDia, diferenciaDia, totalDepositadoDia }`** — para el total del día.
- **Zod** (`turnoInputSchema`): valida un `TurnoInput` (montos ≥ 0, canal/tipo válidos, `tarjetas` y `detalles` con default `[]`). `conciliarCupones` no cambia (opera sobre `detalles` + `ventas` de un turno).

## 5. Persistencia (`src/app/cierres/actions.ts`)

- `guardarCierre(fecha: string, turno: Turno, payloadJson: string, cerrar: boolean)`.
- Upsert por `localId_fecha_turno`. Persiste montoZ + efectivoDepositado en el cierre; ventas/tarjetas/detalles con `deleteMany + create`. La regla de cierre (nota si `|diferenciaCaja| > UMBRAL`) se evalúa **por turno**.

## 6. UI

- **Componente `TurnoCierre`** (nuevo): la carga de un turno (≈ el form actual: bloques Caja, Ventas por canal con cupones, Tarjetas, resumen con diferencia, botones Guardar borrador / Cerrar). Recibe `{ fecha, turno, fondoFijoDefault, inicial }` y llama `guardarCierre(fecha, turno, …)`.
- **Página `/cierres/[fecha]`**: carga los dos cierres-turno del local+fecha y renderiza **dos `TurnoCierre`** (Mañana, Tarde) + un **panel de Total del día** arriba (venta del día y diferencia del día = `sumarDia`). El botón **"Importar desde Tango"** vive a nivel de la planilla y completa ambos bloques.
- **Lista `/cierres`**: una fila por (local, fecha) — agrupa los dos turnos. Muestra estado resumido (ej. "Mañana ✓ · Tarde borrador").
- `CierreForm.tsx` actual se reemplaza por `TurnoCierre` + la página planilla.

## 7. Tango (`parseTango` + `/api/tango`)

- `parseTango(csv)` ahora devuelve **por turno**: `{ fecha, turnos: [{ turno, ventas:[{canal,monto}], montoZ, cantidadTickets }] }`. Mapea `T1→manana`, `T2→tarde` (y acepta "mañana"/"tarde"/"manana"/"tarde"). `montoZ` por turno = suma de importes del turno.
- `/api/tango` (mock) devuelve ese shape. La planilla distribuye cada turno a su bloque.

## 8. No-objetivos
- Conciliación de cobranzas, dashboards, automatización real de Tango (sigue mock).

## 9. Pruebas
- `calculations.test.ts`: reescribir para `TurnoInput` (diferencia por turno) + `sumarDia`.
- `cierreSchema.test.ts`: reescribir para `turnoInputSchema`.
- `conciliacion.test.ts`: sin cambios (opera por turno igual).
- `parseTango.test.ts`: reescribir para el shape por turno (T1→manana, T2→tarde).
- `e2e/cierre.spec.ts`: actualizar — cargar y cerrar el turno **Mañana** (un bloque), assert "Cerrado".

## 10. Archivos
Esquema+migración (`schema.prisma`); `src/lib/cierre/{types,calculations,schema}.ts`; `src/lib/cierre/conciliacion.ts` (revisar imports de tipos); `src/lib/ingest/parseTango.ts`; `src/app/api/tango/route.ts`; `src/app/cierres/actions.ts`; `src/components/TurnoCierre.tsx` (nuevo, ex-CierreForm); `src/app/cierres/[fecha]/page.tsx` (planilla 2 turnos + total día + import Tango); `src/app/cierres/page.tsx` (lista por día); seed (sin cambios de datos, pero la app crea cierres por turno); tests citados.

---

## ADDENDUM — Gastos con comprobante + Mobile solo-carga (mismo rebuild)

### Gastos como líneas (por turno)
- Reemplazar el campo único `gastosTotal` por una **lista de gastos** por turno. Cada gasto: `tipo` (TipoGasto), `formaPago` (FormaPago), `monto`, `descripcion?`, `comprobanteId?`, `orden`.
- `enum TipoGasto { mercaderia descartable limpieza bazar uniformes servicios sueldos mantenimiento marca libreria varios }` (rubros del Excel; configurable a futuro).
- `enum FormaPago { efectivo tarjeta transferencia otro }`.
- **Modelo `CierreGasto`** (hijo del cierre-turno, onDelete Cascade) + **modelo `Comprobante`** `{ id, nombre, mime, data Bytes, creadoEn }`. El gasto referencia `comprobanteId` (nullable).
- **Cálculo (cambio):** `gastosEfectivo = sum(gastos donde formaPago='efectivo')`; `gastosTotal = sum(todos los gastos)`. `saldoEfectivo = ventaEfectivo − gastosEfectivo` (solo el efectivo reduce la caja). `diferenciaCaja = efectivoDepositado − saldoEfectivo`. Agregar `gastosTotal` y `gastosEfectivo` a `TurnoTotales`.
- `TurnoInput`: quitar `gastosTotal`, agregar `gastos: { tipo, formaPago, monto, descripcion?, comprobanteId? }[]`.

### Subida de comprobante (swappable)
- `POST /api/comprobante` (FormData `archivo`) → guarda en `Comprobante` (Bytes) → devuelve `{ id }`. `GET /api/comprobante/[id]` → sirve el archivo (`Content-Type` = mime).
- En el form: cada fila de gasto tiene un input de archivo (acepta `image/*,application/pdf`, `capture` para foto en cel) que al elegir sube y guarda el `comprobanteId`. Optativo.
- Comentario MOCK/swap: reemplazar el cuerpo por Vercel Blob (`@vercel/blob put()` + `BLOB_READ_WRITE_TOKEN`) cuando se quiera; el `comprobanteUrl`/route no cambia para el front.

### UI de gastos (en `TurnoCierre`)
- Sección "Gastos" con **"+ Agregar gasto"** → fila/inline con: tipo (select), forma de pago (select), monto (MoneyInput), descripción (texto corto), y subir comprobante (📎, muestra ✓ cuando subió). Quitar fila (×). Subtotal de gastos del turno abajo.

### Mobile solo-carga (encargado)
- El rol **encargado** ya ve solo su local y solo "Cierres" (sin Importar/Control). Asegurar que: la planilla del día se vea bien en pantalla angosta (~380px), los selects/inputs sean cómodos en cel, y la TopBar para encargado quede mínima (marca + logout). No requiere modelo nuevo — es pulido mobile + roles existentes.

### Pruebas (suma)
- `calculations.test.ts`: cubrir `gastosEfectivo` vs `gastosTotal` y que la diferencia use solo efectivo.
- `cierreSchema.test.ts`: `gastos` válidos (tipo/formaPago/monto), default `[]`.
