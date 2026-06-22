# Automatización de Cierres de Caja — Diseño Fase 1 (MVP)

- **Fecha:** 2026-06-20
- **Autor:** Pablo (Grupo Desembarco) + Claude
- **Estado:** Diseño aprobado — pendiente de plan de implementación
- **Alcance de este documento:** SOLO Fase 1 (MVP). Las fases 2–4 quedan planteadas pero se diseñan por separado.

---

## 1. Contexto y problema

Hoy cada local maneja su cierre de caja diario en un Excel mensual (un archivo por mes y por local; ej. `CIERRES JUNIO 2026 - SAN TELMO.xlsx`). Estructura actual del Excel:

- `Hoja1`…`Hoja31` → una hoja por día (cierre Z por turno, ventas por método de pago, gastos, diferencia de caja, compras por proveedor con estado pagado/pendiente).
- `Mensual`, `TAB`, `PENDIENTES`, `Rendicion`, `Validacion`, `Compras` → consolidados y catálogos.

**Problemas concretos detectados en el archivo real:**

1. **Frágil y roto:** ~6.500 fórmulas con `#REF!`, `#DIV/0!`, `#N/A`, `#NAME?` por todos lados. Las referencias entre hojas se rompen seguido.
2. **Inconsistencia de fechas:** el archivo "JUNIO 2026" contiene datos de mayo 2026 y septiembre 2025 → evidencia de "copiar y pegar el del mes anterior" pisando datos.
3. **Un archivo por mes y por local** → duplicación manual, imposible comparar entre locales.
4. **Todo se tipea a mano** y no hay panel real de análisis.

**Operación a la que escala:** 16 locales **propios** (sobre una red mayor de propios + franquicias y 3 marcas: Desembarco, Mila & Go, Mr Tasty). POS = **Tango Restô** (Axoft). Carga **mixta** (celular + PC + administración central). **Mismo template** de cierre para los 16.

**Data adicional disponible:** reportes "end of day" de las apps de delivery (PedidosYa hoy; Rappi, Mercado Pago y Uber a sumar) en CSV, a nivel de toda la red, por tienda, con pedidos y ventas en efectivo/online. Se obtienen por **descarga manual** del portal de cada plataforma.

---

## 2. Objetivos y no-objetivos

### Objetivos (Fase 1)
- **Confiabilidad:** eliminar las fórmulas frágiles. Los totales se calculan al vuelo sobre datos planos; no hay referencias entre celdas que se rompan.
- **Menos carga manual / a prueba de errores:** un formulario que valida e impide guardar basura.
- **Control declarado-vs-app:** cruzar lo que el local declara en el cierre contra lo que reportan las apps de delivery, resaltando diferencias.
- **Modelo multi-local desde el día uno**, aunque el piloto sea un solo local.

### No-objetivos (Fase 1 — quedan para fases siguientes)
- Compras / cuentas por pagar a proveedores → **Fase 2**.
- Conciliación de **cobranzas/payouts** de las apps (liquidaciones, comisiones) → **Fase 3** (requiere los reportes de liquidación, distintos al `endOfDay`).
- Dashboards comparativos entre locales y P&L → **Fase 3**.
- Automatización de la ingesta (que n8n baje/lea el reporte solo) → **Fase 4**.
- Integración con **Tango Restô** → **Fase 4**.
- Migración del histórico del Excel (está roto; se arranca limpio).

---

## 3. Arquitectura (Opción C — híbrido, sin Looker)

**Una sola fuente de verdad + una sola app para cargar y ver + n8n como pegamento a futuro.**

- **Base de datos:** PostgreSQL (recomendado Neon o Supabase; alternativa Vercel Postgres). Fuente de verdad única.
- **App web:** Next.js (App Router) en Vercel — mismo stack que los demás paneles del grupo. Dos caras: *formulario de carga* (mobile-first, con roles) y *vistas/control*.
- **n8n:** no es imprescindible en Fase 1 (la ingesta es por subida manual del CSV dentro de la app). Entra fuerte desde Fase 2 (alertas, recordatorios de pago) y Fase 4 (ingesta automática, Tango).

**Flujo de datos (Fase 1):**

```
Encargados (cel/PC) + Administración central
        │  (carga manual del cierre)
        ▼
   App web (Next.js / Vercel)  ◄──►  PostgreSQL (fuente de verdad)
        ▲                                  │
        │  (subida manual del CSV)         │  (lectura)
   Reportes endOfDay de apps               ▼
   (PedidosYa, Rappi, MP, Uber)     Vistas: cierre del día/mes
                                     + Control declarado-vs-app
```

**Decisiones técnicas sugeridas** (a confirmar en el plan de implementación):
- ORM: Prisma o Drizzle.
- Auth: Auth.js (NextAuth) o Clerk, con roles.
- Parsing CSV: librería estándar (ej. `papaparse`) con normalización de montos.

---

## 4. Modelo de datos

### Maestros (cambian poco)

**`marcas`** — `id`, `nombre`, `activo`

**`locales`** — `id`, `nombre`, `marca_id`→marcas, `direccion`, `ciudad`, `pais` (default `AR`), `moneda` (default `ARS`), `fondo_fijo_default`, `activo`

**`plataformas`** — `id`, `nombre`, `codigo` (`PY`/`RA`/`MP`/`UE`), `activo`

**`local_plataforma`** — *mapeo clave* — `id`, `local_id`→locales, `plataforma_id`→plataformas, `restaurant_id_externo` (texto), `nombre_externo` (texto), `activo`
- `UNIQUE(plataforma_id, restaurant_id_externo)`. Acá vive, p.ej., que `517621` de PedidosYa = "Desembarco San Telmo". Aísla el quilombo de nombres sucios de las apps en una sola tabla.

**`usuarios`** — `id`, `nombre`, `email` (unique), `rol` (`encargado`|`central`|`admin`), `local_id`→locales (null para central/admin), `activo`
- *Nota:* encargado con un solo `local_id`. Si más adelante un encargado maneja varios, se agrega `usuario_local` (N:N) sin romper nada.

### Operación diaria (crece todos los días)

**`cierres`** — `id`, `local_id`→locales, `fecha` (date), `fondo_fijo`, `gastos_total`, `nota_credito`, `cantidad_tickets` (nullable), `estado` (`borrador`|`cerrado`), `nota` (texto, justificación de diferencia), `creado_por`, `creado_en`, `actualizado_en`, `cerrado_por`, `cerrado_en`
- `UNIQUE(local_id, fecha)` → **mata el "copié el del mes pasado y se pisó todo"**.

**`cierre_turnos`** — `id`, `cierre_id`→cierres, `turno` (`T1`|`T2`), `monto_z` — `UNIQUE(cierre_id, turno)`

**`cierre_ventas`** — `id`, `cierre_id`→cierres, `canal` (`efectivo`|`tarjetas`|`rappi`|`pedidosya`|`mercadopago`|`uber`|`delivery_propio`|`varios`), `monto` — `UNIQUE(cierre_id, canal)`
- Usar `canal` (en vez de una columna por método) hace que **sumar una plataforma nueva no rompa el esquema**.

**`ventas_app`** — `id`, `local_id`→locales, `plataforma_id`→plataformas, `fecha` (date), `pedidos_efectivo` (int), `pedidos_online` (int), `venta_efectivo` (numeric), `venta_online` (numeric), `venta_total` (numeric, generada = efectivo+online), `importacion_id`→importaciones, `creado_en`, `actualizado_en`
- `UNIQUE(local_id, plataforma_id, fecha)` → idempotencia: re-subir el reporte **reemplaza, no duplica**.

**`importaciones`** — `id`, `plataforma_id`→plataformas, `fecha_reporte` (date), `archivo_nombre`, `filas_total`, `filas_mapeadas`, `filas_ignoradas_red`, `filas_sin_mapear`, `subido_por`, `creado_en`

**`importacion_sin_mapear`** — `id`, `importacion_id`→importaciones, `plataforma_id`, `restaurant_id_externo`, `nombre_externo`, `venta_efectivo`, `venta_online` — cola para que central asocie un ID nuevo a un local (one-time).

### Derivados (no son tablas — se calculan en app/SQL)

- **Venta total** = `SUM(cierre_ventas.monto)`
- **Venta neta** = venta total − `nota_credito`
- **Saldo efectivo / total a depositar / diferencia de caja** → fórmula en la app. *La fórmula exacta de "diferencia de caja" se calibra en el piloto contra el Excel/realidad* (la del Excel actual no es transparente).
- **Control delivery** (`v_control_delivery`): por `(local, fecha, canal↔plataforma)`, compara `cierre_ventas` (canales de delivery) contra `ventas_app`, con diferencia absoluta y %. Mapeo de canal↔plataforma: `pedidosya↔PedidosYa`, `rappi↔Rappi`, `mercadopago↔Mercado Pago`, `uber↔Uber`.

---

## 5. Flujos

### 5.1 Carga del cierre (rol encargado)
1. Login → entra directo a su local, fecha = hoy.
2. Completa bloques: cabecera (fondo fijo pre-cargado) → cierre Z por turno → ventas por canal → gastos / NC / tickets.
3. **Resumen en vivo** (calculado): venta total, venta neta, saldo, total a depositar, **diferencia de caja con semáforo** 🟢🟡🔴.
4. Guarda **borrador** (sin validación estricta) o **cierra**:
   - Valida unicidad `(local, fecha)`.
   - Si la diferencia supera el umbral configurado → exige `nota`.
5. Central/admin pueden reabrir/corregir (queda registrado quién y cuándo).

### 5.2 Ingesta del CSV de apps (rol central/admin)
1. Sube el archivo (drag & drop). Arranca PedidosYa; mismo flujo para Rappi/MP/Uber con su parser.
2. El parser detecta plataforma y `fecha_reporte`, **normaliza montos** (`"102,883.50"` → `102883.50`), separa por tienda.
3. Mapea cada fila por `restaurant_id_externo` contra `local_plataforma`:
   - mapea a uno de los 16 → upsert en `ventas_app` (incluye filas en `0` para distinguir "0 vendido" de "no reportado").
   - es otra tienda de la red → se ignora (`filas_ignoradas_red`).
   - es un local propio con ID no mapeado → va a `importacion_sin_mapear`.
4. Muestra resumen (mapeadas / ignoradas / sin mapear) → confirmar → registra `importaciones`.
5. Las "sin mapear" se asocian una vez y quedan resueltas para siempre.

### 5.3 Vista de control (rol central/admin)
- Tabla por `(local, fecha)`: **declarado (cierre) vs app**, por plataforma, con diferencia y semáforo.
- Filtros por fecha / local / plataforma. Exportable.
- Estados especiales: "falta cierre" (hay `ventas_app` sin `cierre`), "falta importación" (hay `cierre` sin `ventas_app`).

---

## 6. Reglas de negocio y validaciones

- Montos numéricos `>= 0`; nunca texto → elimina `#DIV/0!`.
- `UNIQUE(local_id, fecha)` en `cierres`.
- Diferencia de caja calculada server-side; umbral configurable (en `$` y/o `%`) por local o global.
- `borrador` vs `cerrado`: cerrar exige cuadre o `nota` justificatoria.
- Idempotencia de ingesta vía `UNIQUE(local_id, plataforma_id, fecha)`.
- **Fecha de negocio** (date, no timestamp). El "día" del cierre y el del reporte `endOfDay` deben alinear (la fecha del nombre del archivo es la de negocio).

### Permisos (matriz)
| Acción | encargado | central | admin |
|---|---|---|---|
| Cargar/editar cierre de su local | ✅ (su local, fechas recientes) | ✅ (todos) | ✅ (todos) |
| Reabrir cierre cerrado | ❌ | ✅ | ✅ |
| Subir CSV de apps | ❌ | ✅ | ✅ |
| Mapear IDs sin asignar | ❌ | ✅ | ✅ |
| Ver control declarado-vs-app | ❌ | ✅ | ✅ |
| Administrar maestros/usuarios | ❌ | ❌ | ✅ |

---

## 7. Manejo de errores y casos borde

- **CSV de formato desconocido** → error claro, no importa nada (transacción atómica).
- **Montos `es-AR` vs `en-US`:** el `endOfDay` usa coma de miles + punto decimal; el parser normaliza explícitamente.
- **Tienda con 0 ventas** → se guarda `0` (no se omite).
- **Paraguay / otra moneda** → fuera de los 16, ignorado; el modelo soporta `moneda` por si entran.
- **Doble subida del mismo reporte** → idempotente (reemplaza).
- **Local sin cierre / sin importación** ese día → se refleja como estado en la vista de control, no como error.

---

## 8. Plan de prueba (piloto)

- **Piloto:** San Telmo carga en la app **en paralelo al Excel ~1 mes**.
- **Validación de números:** venta total, diferencia de caja y delivery declarado-vs-app deben coincidir con el Excel/realidad. Se **calibra la fórmula de diferencia** y los umbrales.
- **Criterios de éxito:**
  - Los números coinciden con el cierre real del mes.
  - El encargado carga el cierre desde el celular en pocos minutos.
  - El control detecta las diferencias reales de delivery.
- **Tests automáticos:**
  - Unit del parser (normalización de montos, mapeo por ID, idempotencia, filas sin mapear).
  - Unit de cálculos (venta total, neta, saldo, diferencia).
  - E2E del flujo de carga del cierre (borrador → cerrado con/ sin justificación).

---

## 9. Riesgos y supuestos

- **Supuesto:** se pueden relevar al inicio los 16 locales propios y sus `Restaurant ID` por plataforma.
- **Riesgo:** la fórmula exacta de "diferencia de caja" hay que calibrarla → mitigado por el mes en paralelo.
- **Riesgo:** cada plataforma exporta distinto → se arranca con PedidosYa y se agregan parsers por plataforma.
- **Supuesto:** la subida manual del CSV es aceptable en Fase 1 (la automatización es Fase 4).

---

## 10. Fases siguientes (fuera de alcance de este spec)

- **Fase 2 — Compras y cuentas por pagar:** facturas por proveedor/rubro, panel de pendientes, alertas n8n.
- **Fase 3 — Conciliación de cobranzas + dashboards + rollout a los 16:** liquidaciones/payouts por app, comisiones, comparativos, P&L, CMV, desperdicio.
- **Fase 4 — Automatización de ingesta + Tango Restô:** n8n lee los reportes solo; integración con el POS.
