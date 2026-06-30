# Estudio — Control de cajas de los 16 locales propios

*Grupo Desembarco · marcas Desembarco / Mr Tasty / Mila&Go*
*Fecha: 2026-06-25 · Fuentes analizadas: export Mercado Pago "collection" (28/05) + export Qlik ventas Tango (23–24/06)*

---

## 1. Resumen ejecutivo

El control de cajas se arma con **tres patas que NO compiten** — cada una responde una pregunta distinta y se cruzan entre sí, no se reemplazan:

- **Qlik (ventas de Tango) = QUÉ SE VENDIÓ.** Detalle de venta de toda la red (24.412 líneas, 2 días en la muestra). Dice cuánto vendió cada local, por turno, y de qué ORIGEN vino el pedido (mostrador, salón, PedidosYa, Mercado Delivery, Rappi, etc.). Es la "venta objetivo".
- **Cierre del encargado (Tango cierre PDF) = QUÉ DECLARÓ + CÓMO LE PAGARON.** Única fuente que dice la **forma de cobro** (efectivo / tarjeta / QR), y por lo tanto la única que mueve la **diferencia de caja**.
- **Mercado Pago + PedidosYa = QUÉ PLATA ENTRÓ DE VERDAD.** El export de MP es la liquidación real de Mercado Delivery: cuánto neto entró a la cuenta (ya descontada comisión) y **cuándo** (T+7).

La idea central: cruzar lo que el sistema dice que se vendió (Qlik) contra lo que el encargado declaró (cierre) contra lo que efectivamente se cobró (MP/PeYa) — y que los tres números cierren. Donde no cierran, hay un faltante, una anulación que tapa algo, o una comisión.

---

## 2. Las dos fuentes nuevas — qué aportan y qué NO

| | **Qlik (ventas Tango)** | **Mercado Pago "collection"** |
|---|---|---|
| **Qué es** | Detalle de venta de toda la red, línea por línea de producto | Liquidación de **Mercado Delivery** (lado plata/app) |
| **Grano** | 1 fila = 1 producto de un ticket → hay que **sumar** a (local, fecha, turno) | 1 fila = 1 cobro de MP |
| **APORTA** | • Venta total por local y turno (cifra objetivo)<br>• **ORIGEN** del pedido (mostrador, salón, PeYa, Mercado Delivery, Rappi, Uber, Mila&Go)<br>• **CMV / margen** (ninguna otra fuente lo tiene)<br>• Toda la red de una | • La **plata real neta** que entra a la cuenta MP de Mercado Delivery<br>• La **comisión** (≈2,7–2,8% del bruto en esta muestra)<br>• La **fecha de acreditación**: T+7 fijo (28/05 → 04/06)<br>• Detecta **refunds/cancelaciones** |
| **NO aporta** | • **NO dice forma de cobro** (barrí las 34 columnas: cero)<br>• No toca la caja<br>• No reduce solo a los 16 propios (35 candidatos no-Mrt) | • **NO toca la caja** (es 100% dinero en cuenta, no efectivo)<br>• En esta muestra solo trae **Mercado Delivery** (no el QR de mostrador)<br>• Solo los 3 locales que cobraron por MP ese día |

**En una línea cada una:**
- **Qlik trae el ORIGEN del pedido, NO la forma de cobro.** Valida la venta total pero no completa el cierre de caja.
- **MP trae la plata real de Mercado Delivery con su comisión y su T+7** — un dato que hoy no existe en ningún lado del sistema.

---

## 3. Arquitectura recomendada — de dónde sale cada dato

| Dato | Fuente (source of truth) | Por qué |
|---|---|---|
| Venta total por turno (objetivo) | **Qlik** (Importe Total c/IVA) + montoZ del cierre Tango como contraste | Qlik agrega limpio por local+turno; el cierre dice lo que cerró la caja |
| Venta por origen/canal | **Qlik** (NomCliente) | Único con el origen, con códigos estables (MOSTRADOR 000006, MP DELIVERY 000015, etc.) |
| **Forma de cobro** (efectivo / tarjeta / QR) | **Cierre Tango PDF** | Única fuente con forma de cobro. El efectivo de acá es lo único que mueve la caja |
| Plata real de Mercado Delivery (neto + fecha) | **MP collection** (net de approved − devoluciones) | Da el neto post-comisión y la fecha T+7. Ni Tango ni Qlik tienen liquidación bancaria |
| Plata real de PedidosYa | **PeYa CSV** (ya integrado) | Ya cargado en la app; separa efectivo / online |
| Anulaciones / devoluciones | **Cierre Tango** (caja) + Qlik (Estado D) + MP refunds (verificación) | Solo las que "afectan caja" del cierre tocan el efectivo |
| CMV / margen | **Qlik** | Único con costo de mercadería (reporte aparte, no es conciliación) |
| Identidad del local | **Mapeo por ID externo** (store_id MP, IdSucursal Qlik, restaurant_id PeYa) | Mapear por nombre falla (colisión propio vs Mrt) — siempre por ID |

**Regla de oro:** la **diferencia de caja** la siguen moviendo SOLO el efectivo del cierre Tango. MP y Qlik entran como **control**, nunca como saldo de caja.

---

## 4. Los cruces concretos — qué descubre cada uno

**Cruce 1 — Venta declarada (cierre) vs venta real (Qlik), por turno.**
Compara el montoZ del cierre del encargado contra la venta total que Qlik registró ese turno (verificado: San Telmo 23/06 tarde = $1.913.912 exacto en Qlik).
→ **Descubre faltantes / sub-declaración.** También expone el **no-facturado**: en la muestra hay **$66M sin factura fiscal, y el 94% de eso es mostrador/salón** (NO delivery) — señal de efectivo in-store que no emite ticket.

**Cruce 2 — Mercado Delivery: Qlik (lo que se vendió) vs MP (lo que se cobró neto).**
→ **Descubre la comisión y los pedidos perdidos.** En la muestra, **18 de 95 operaciones fueron devueltas — $368.500 sobre $1.888.450 (≈19,5%)**, casi todas en San Telmo. ⚠️ Para que el cruce cierre hay que **pasar Qlik a neto sin IVA** y **netear los refunds de MP** (ver riesgos): el gap crudo NO es ~3%, es ~3% comisión **+ ~21% IVA**.

**Cruce 3 — PedidosYa: Qlik vs CSV de PeYa.**
→ **Descubre desfases** entre lo que Tango registró como venta PeYa y lo que la app de PeYa procesó.

**Cruce 4 — Anulaciones para tapar faltantes.**
Devoluciones de Qlik (57 líneas, −$477.100, **ya netas** en el total) y refunds de MP contra las anulaciones que el encargado declaró en el cierre.
→ **Descubre anulaciones usadas para tapar un faltante de caja.**

**Cruce 5 — Caja física (el que ya existe).**
Efectivo esperado (cierre) vs depósito. MP y Qlik NO entran. La novedad: Qlik permite chequear que la venta in-store del turno sea coherente con el efectivo+tarjeta+QR declarado.

---

## 5. Plan de integración en la app, por fases

La app `cierres` ya tiene el patrón armado (PedidosYa CSV → `ventas_app` → `buildControlRows`; Tango PDF → `cierre_tango`). Las dos fuentes nuevas **reusan** ese patrón.

- **Fase 0 — Identidad de locales (prerequisito, sin código).** Sembrar 2 "plataformas" (Mercado Delivery, Qlik) y poblar a mano la tabla de mapeo: por cada local, su IdSucursal de Qlik y su store_id de MP. Curar el set de 16 CABA. **Esfuerzo bajo, pero es una sesión con vos.**
- **Fase 1 — Importador MP → `ventas_app`.** Parser XML directo (openpyxl falla). Netea approved − devoluciones por local+día. Suma "Mercado Delivery" al control. **Esfuerzo medio.**
- **Fase 2 — Importador Qlik → tabla venta-por-origen.** Agrega las 24k líneas por (local, fecha, turno, origen) con Importe Total/Neto/CMV. Endpoint igual al de Tango. **Esfuerzo alto** (pieza más grande).
- **Fase 3 — Vista de control combinada.** Secciones: venta total (Qlik vs cierre), delivery (declarado vs plata real), anulaciones, caja. Semáforos. **Esfuerzo medio.**
- **Fase 4 — CMV / margen.** Reporte de margen desde Qlik (separado del control). **Esfuerzo bajo-medio.**

---

## 6. Riesgos y advertencias honestas (de las auditorías adversariales)

1. **Cada fuente usa un ID de local distinto y NO hay forma de derivar uno de otro.** store_id MP (8 díg.) ≠ IdSucursal Qlik (chico) ≠ id app. Mapeo **manual y congelado**. Por nombre **rompe** (colisión propio `Caballito` vs franquicia `Mrt Caballito`, +14 pares).
2. **El cruce de Mercado Delivery NO es ~3% directo.** Qlik en **bruto c/IVA**; MP en **neto post-comisión**. Gap crudo ≈ 2,8% comisión **+ ~21% IVA**. Normalizar (Qlik a neto sin IVA) antes de comparar.
3. **T+7: la plata entra una semana después.** El cruce por día debe usar la **fecha de venta**, no la de acreditación.
4. **Refunds con trampa.** Las 18 filas devueltas tienen "Monto recibido" **positivo** que NO es ingreso (sobre-estima ~$356K). Usar solo aprobadas.
5. **Qlik NO completa el cierre.** No tiene forma de cobro; valida la venta total, no autocompleta efectivo/tarjeta.
6. **Mila&Go rompe el 1:1.** En MP es un local con store_id propio; en Qlik **no existe como sucursal** — es un origen repartido dentro de varias sucursales Desembarco. Decidir cómo se modela.
7. **Los dos archivos de ejemplo NO se solapan en fechas** (MP 28/05, Qlik 23–24/06). Sirven para entender la estructura, **no para validar montos cruzados todavía**.
8. **El momento de la descarga importa.** El Qlik debe bajarse **post-cierre de cada turno** (los turnos se solapan en hora); si se baja intradía, corta ventas.

---

## 7. Qué necesito de vos para avanzar

**Decisiones (bloquean Fase 0):**
1. **Los 16 IdSucursal propios de CABA.** Qlik lista 35 candidatos (incluye Desembarco de GBA y provincias). Necesito la lista cerrada.
2. **Mila&Go: ¿local aparte o un canal dentro de las sucursales Desembarco?** Las dos lecturas son incompatibles — definí cuál vale.
3. **¿Qlik reemplaza la carga del encargado o queda como 3ª auditoría?** Si reemplaza, definir cuál es la verdad del monto total.
4. **Neteo de MP:** ¿solo aprobadas ($1.478.040) o neto menos devuelto ($1.466.187)? Recomiendo **solo aprobadas**.
5. **¿El cierre se carga con IVA o sin IVA?** Asumo **con IVA**.

**Archivos:**
6. Un **export de MP sin filtrar** (o de un día con cobro en mostrador) para confirmar si trae también el **QR/Point de mostrador**. La muestra de hoy es 100% delivery.
7. Un **Qlik y un MP del mismo rango de fechas y mismos locales**, para cruzar números de verdad y calibrar umbrales.
8. **Cómo llegan los archivos**: ¿mail + n8n (como el PDF de Tango) o subida manual? ¿Frecuencia?

---

# Apéndice técnico (para la implementación)

## A. Cruces — claves de join y fórmulas

1. **Venta declarada vs Qlik (total/turno)** — clave `(localId, fecha, turno)` (local vía `local_plataforma['Qlik'].IdSucursal`; TurnoHora MAÑANA→manana/TARDE→tarde). `dif = qlikImporteTotal − tangoMontoZ`; alerta si `|dif|>umbral` o `pct>X%`.
2. **Qlik MP DELIVERY vs MP collection** — clave `(localId, fecha)` a nivel DÍA. Normalizar: `gap = 1 − (mpNetApproved / qlikMpDeliveryNeto_sinIVA)`; esperado ≈ comisión (~2,8%); alerta si `gap>6–8%`. Join por **fecha de venta** (date_created), no de liquidación.
3. **PedidosYa Qlik vs CSV** — clave `(localId, fecha)` día. `dif = qlikPedidosYaTotal − (ventaEfectivo+ventaOnline)` de `ventas_app`.
4. **Anulaciones** — `(localId, fecha[, turno])`. Sospecha si `qlikD_inStore != 0` y `tango.anulacionesAfectanCaja == 0`. Las D de delivery se reconcilian contra MP/PeYa refunds, no contra caja.
5. **Caja física (existente)** — `diferenciaCaja = efectivoDepositado − (ventaEfectivo − gastosEfectivo)`. Cross-check: `ventaEfectivo+tarjetas+QR (Tango) ≈ in-store Qlik (MOSTRADOR+SALON)`.

## B. Plan técnico por fase

- **Fase 0:** seed plataformas `Mercado Delivery`(MD)/`Qlik`(QL); poblar `local_plataforma` (restaurantIdExterno = store_id MP / IdSucursal Qlik). Sin cambio de schema. Reusar `ImportacionSinMapear` para IDs entrantes no mapeados (no adivinar por nombre).
- **Fase 1:** `parseMpCollection.ts` (lector XML directo). Rama `plataformaCodigo==='MD'` en `ingestCsv` → `ventas_app`. Agregar `mercado_pedidos:'Mercado Delivery'` a `CANAL_A_PLATAFORMA`.
- **Fase 2:** `parseQlik.ts` + tabla nueva `VentasOrigen`/`CierreQlik` `@@unique[localId,fecha,turno,origen]` con `importeTotal/importeNeto/cmv/anulaciones`. Endpoint con `x-ingest-secret` (n8n) o upload manual. Filtrar 16 propios + descartar basura (`Sucursal '-'`, $0, `IdSucursal '-'`).
- **Fase 3:** extender `getControl`/`buildControlRows` con secciones (venta total, delivery, anulaciones, caja). `ControlTable` con semáforos.
- **Fase 4:** CMV/margen desde `VentasOrigen` en `report.ts`/informes (reporting, no control).

## C. Datos de respaldo
- Perfil de datos medido: `C:\Users\ferra\Servicios\_estudio_cajas\data-profile.md`
- Scripts de lectura (XML directo): `_xlsx_raw.py`, `_analyze.py`, `_qlik.py` en `C:\Users\ferra\Servicios`
- MP collection: `C:\Users\ferra\OneDrive\Desktop\collection-20260624191005-bb2d.xlsx`
- Qlik: `C:\Users\ferra\Downloads\ebbcf648-132f-49d3-822c-aaf9ffa1bb0c.xlsx`
- App: `C:\Users\ferra\Servicios\cierres`
