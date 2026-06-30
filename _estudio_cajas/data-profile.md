# Estudio control de cajas — perfil de datos (ground truth)

Dos fuentes que Pablo quiere usar para el **control de cajas** de los 16 locales propios.
Medido directamente sobre los archivos (lector XML propio: `_xlsx_raw.py`, `_analyze.py`, `_qlik.py` en `C:\Users\ferra\Servicios`).

## Archivo A — Mercado Pago "collection"
Ruta: `C:\Users\ferra\OneDrive\Desktop\collection-20260624191005-bb2d.xlsx`
Hoja `Export collection`. **95 transacciones**, **1 día (28/05/2026)**. (openpyxl falla por stylesheet roto → leer por XML directo.)

- **Grano:** 1 fila = 1 operación de cobro de Mercado Pago.
- **Identifica el local:** `Número de local (store_id)` + `Nombre del local`:
  - El Desembarco San Telmo (store_id 72488709) — 76 txns, net $1.524.925
  - El Desembarco Microcentro (77378254) — 16 txns, net $254.454
  - Mila and Go San Telmo (77284068) — 3 txns, net $55.307
- **Columnas clave:** Fecha de compra; **Fecha de liquidación** (T+~7: 28/05→04/06); Descripción (producto); `Código de referencia (external_reference)`=47171855721; `Número de ticket`=…DS; **Estado** (approved 77 / refunded 18); **Valor del producto (bruto)**; **Tarifa MP / Comisión**; **Monto recibido (net_received)**; **Medio de pago (payment_method)**=`account_money` (100%); **Monto devuelto**; **Canal de venta (business_unit)**=`Delivery` (100%); Mercado Pago Point (vacío); Modo de entrada=Proximity.
- **Totales:** bruto $1.888.450 · neto $1.834.687 · comisión $0 (en esta muestra) · devuelto $368.500.
- **Lectura:** en esta exportación, MP collection = **Mercado Delivery** (business_unit Delivery, marketplace MELI), cobrado con dinero en cuenta MP, **liquidado a T+7**, con refunds. Es el "lado plata/app" de Mercado Delivery.
- **Dudas a confirmar:** ¿una exportación sin filtro trae también QR/Point de mostrador (in-store MP)? ¿la comisión $0 es porque MELI absorbe o por el tipo de cuenta? El net de filas refunded sigue positivo → cuidar el neteo.

## Archivo B — Qlik (ventas Tango, detalle)
Ruta: `C:\Users\ferra\Downloads\ebbcf648-132f-49d3-822c-aaf9ffa1bb0c.xlsx`
Hoja `Sheet1`. **24.412 filas**, **2 días (23 y 24/06/2026)**, **~107 sucursales (toda la red: propios + franquicias "Mrt …" + Mila & Go)**.

- **Grano:** 1 fila = 1 línea de producto de un comprobante (ticket). Hay que **agregar** a (local, fecha, turno).
- **Identifica local + turno:** `IdSucursal`/`NroSucursal`/`Sucursal`; `TurnoHora` = TURNO MAÑANA / TURNO TARDE. `Fecha Turno` (serial Excel).
- **CANAL/ORIGEN en `NomCliente` (= CodCliente):** ⭐ hallazgo central
  - MOSTRADOR (000006) $151.805.542 · SALON (000005) $31.322.709 → **in-store** (mostrador + salón)
  - PEDIDOS YA (000003) $55.717.626 · **MP DELIVERY (000015) $17.435.503** · RAPPI (000013) $11.260.944 · UBER EATS (000044) $1.066.357 → **delivery apps**
  - MILA & GO (000004) $1.145.771 · MR TASTY (000007) $1.083.300 · ENCARGADOS (000011) $57 (comps)
  - ⚠️ `NomCliente` = **ORIGEN del pedido**, NO **forma de cobro**. Para MOSTRADOR/SALÓN no dice si fue efectivo/tarjeta/MP-QR.
- **Importe:** `Importe Total` (con IVA) vs `Importe Neto` (sin IVA). Total red 2 días: Importe Total $270.837.811 · Neto $224.844.728 · **CMV $118.439.355** (→ margen).
- **Anulaciones/devoluciones:** `Estado Detalle` D = 57 filas, **importe negativo $-477.100**. `Estado Cabecera` C (facturado, Tipo Comp FAC) vs T (sin FAC, $66M — correlaciona con delivery). `Motivo Anulación` casi vacío.
- **Calidad de datos:** colisión de nombres **propio vs franquicia** (ej. `Caballito` id39 vs `Mrt Caballito` id56; `San Miguel` vs `Mrt San Miguel`); un `Moreno` con IdSucursal `-` y `85`; filas basura Sucursal `-` ($0). Mapear por **IdSucursal** (no por nombre).
- **NO trae:** forma de cobro del in-store, ni comisiones, ni liquidación bancaria.

## No-overlap de fechas
Archivo A = 28/05. Archivo B = 23–24/06. **No se solapan** → son EJEMPLOS de cada fuente, no un par para cruzar numéricamente hoy. Para un cruce real hace falta el MISMO rango en ambos.

## Contexto app cierres (lo ya construido)
- App `C:\Users\ferra\Servicios\cierres` (Next.js+Prisma+Neon schema `cierres`). El cierre es por (local, fecha, turno).
- Modelo de venta: `ventas {canal, monto}` con canal = origen (efectivo, tarjetas, pedidosya, pedidosya_efectivo, mercado_pedidos=Mercado Delivery, mercadopago, rappi, uber, delivery_propio, varios). Recién separamos **forma de cobro** (Mercado Pago) de **app** (Mercado Delivery) y agregamos pedidosya_efectivo.
- Diferencia de caja = efectivoDepositado − (ventaEfectivo − gastosEfectivo). Solo efectivo toca la caja.
- Ya integrado: **Tango cierre PDF** por mail → `cierre_tango` (VENTAS POR FORMA DE COBRO por turno) — ESTA es la forma de cobro. **PedidosYa CSV** endOfDay → control declarado-vs-app (`buildControlRows`, mapeo `local_plataforma`, `CANAL_A_PLATAFORMA`).
- `buildControlRows(declared[], app[])` compara por plataforma. Mapeo local↔plataforma en `local_plataforma` (cada plataforma tiene su Restaurant ID sucio).
