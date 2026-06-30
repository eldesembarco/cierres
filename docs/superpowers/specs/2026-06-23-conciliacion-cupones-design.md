# Conciliación de cupones por método — Diseño

- **Fecha:** 2026-06-23
- **Autor:** Pablo (Grupo Desembarco) + Claude
- **Estado:** Diseño aprobado — pendiente de plan de implementación
- **Contexto mayor:** extiende el cierre de caja (ver `2026-06-20-cierres-automatizacion-fase1-design.md`). App ya en producción.

---

## 1. Contexto y problema

En el Excel, además del total por método de pago, el local carga **cada operación una por una** en columnas `N° Cupón` + `Importe`, separadas por método (Mercado Pago, PedidosYa, Rappi, etc.). Sirve para **conciliar**: que la suma de los cupones coincida con el total declarado de ese método.

Hoy la app solo guarda el **total por canal** y el desglose de tarjetas por lote. Falta poder cargar ese **detalle de cupones** y conciliarlo contra el total.

Decisiones del brainstorm (2026-06-23):
- El detalle es **para conciliar** (el total se carga aparte; los cupones se comparan contra él).
- Debe poder activarse para **cualquier método** (no una lista fija): Mercado Pago, PedidosYa, Rappi, transferencias, QR, etc.
- UI: **desplegable por método** dentro del formulario de carga (opción A).
- La carga de cupones es **optativa**; un descuadre **avisa (semáforo), no bloquea** el cierre.

---

## 2. Objetivos y no-objetivos

### Objetivos
- Permitir cargar líneas de detalle (`referencia` + `importe`) para **cualquier canal** del cierre.
- Mostrar, por método con detalle cargado, la **conciliación en vivo**: suma de cupones vs total declarado, con semáforo.
- Persistir el detalle junto con el cierre.

### No-objetivos (quedan afuera)
- **Carga rápida / pegar-importar** listas de cupones (era la opción C) → futuro.
- Ver el detalle de cupones desde el **panel de administración/control** → futuro. La conciliación vive en la carga, que es donde se cuadra.
- Conciliar el cupón contra el reporte de la app de delivery (eso es la Fase 3 de cobranzas).

---

## 3. Modelo de datos (1 tabla nueva)

**`cierre_detalle`** — `id`, `cierreId`→cierres (onDelete: Cascade), `canal` (enum `Canal` existente), `referencia` (texto, el N° de cupón/operación; opcional/puede vacío), `importe` (Decimal 14,2), `orden` (int, para mantener el orden de carga)
- Index en `(cierreId, canal)`. Sin restricción de unicidad: un mismo canal tiene N líneas y las referencias pueden repetirse.

Es el único cambio de esquema. Cada línea pertenece a un cierre y a un canal.

---

## 4. Lógica de conciliación (pura y testeada)

Función pura `conciliarCupones(detalles, ventas)`:
- **Entrada:** `detalles: { canal, referencia, importe }[]` y `ventas: { canal, monto }[]` (el total declarado por canal).
- **Salida:** por cada canal que **tenga al menos una línea de detalle**, un objeto `{ canal, sumaCupones, declarado, diferencia, estado }`.
  - `sumaCupones` = suma de `importe` de las líneas de ese canal (redondeada).
  - `declarado` = `monto` del canal en `ventas` (0 si no hay).
  - `diferencia` = `sumaCupones - declarado`.
  - `estado` = `'ok'` si `|diferencia|` == 0 (con tolerancia de redondeo $1), `'descuadre'` si no. (Umbral ajustable; el semáforo reutiliza el patrón existente: 🟢 ok / 🔴 descuadre.)
- Canales sin detalle cargado **no** aparecen (no se concilia lo que no se cargó).

Vive en `src/lib/cierre/conciliacion.ts`. Reutiliza `round2`/`sumMoney` de `@/lib/money`.

---

## 5. UI — desplegable por método (en `CierreForm`)

- En la sección **"Ventas por canal"**, cada método suma un toggle **"Detalle / cupones"** (colapsado por defecto; un contador opcional "(N)" si tiene líneas).
- Al expandir: una lista de filas, cada una con **referencia** (input de texto) + **importe** (`MoneyInput`), con **"+ agregar"** y un botón de quitar (×) por fila.
- Debajo del detalle de ese método, una línea de conciliación en vivo:
  `Cupones: $X · Declarado: $Y · Dif: $Z` con semáforo 🟢/🔴.
- Estado en React: un array de detalles por canal dentro del estado del formulario. El cálculo de conciliación corre en vivo con `conciliarCupones`.
- Mobile-first: el desplegable mantiene el formulario manejable (colapsado por defecto).

---

## 6. Guardado y validación

- El payload del formulario suma `detalles: { canal, referencia, importe }[]` (solo las filas con `importe > 0` o `referencia` no vacía; se descartan filas vacías).
- `guardarCierre` persiste el detalle con el mismo mecanismo que turnos/tarjetas: `detalles: { deleteMany: {}, create: ... }` dentro del upsert del cierre.
- Validación Zod (`cierreInputSchema`): `detalles` = array de `{ canal: Canal, referencia: string (puede vacío), importe: number >= 0 }`.
- El descuadre de cupones **no** afecta la regla de cierre (no agrega requisito de nota). La nota sigue atada solo a la diferencia de caja.

---

## 7. Pruebas

- **Unit `conciliacion.test.ts`:** suma por canal, diferencia, estado ok/descuadre, canales sin detalle no aparecen, tolerancia de redondeo.
- **Unit (extensión de `cierreSchema.test.ts`):** acepta `detalles` válidos, rechaza importe negativo / canal inválido, acepta `detalles` vacío/omitido.
- **E2E:** no se modifica (los cupones son optativos; el flujo de cierre actual no los carga).

---

## 8. Resumen de archivos

- **Esquema:** `prisma/schema.prisma` (nueva tabla `CierreDetalle`) + migración.
- **Lógica:** `src/lib/cierre/conciliacion.ts` (+ tipos en `src/lib/cierre/types.ts`: `CierreDetalle`, ampliar `CierreInput`).
- **Validación:** `src/lib/cierre/schema.ts` (campo `detalles`).
- **Persistencia:** `src/app/cierres/actions.ts` (`guardarCierre`).
- **UI:** `src/components/CierreForm.tsx` (desplegable por canal + conciliación en vivo).
- **Tests:** `tests/unit/conciliacion.test.ts`, ampliar `tests/unit/cierreSchema.test.ts`.
