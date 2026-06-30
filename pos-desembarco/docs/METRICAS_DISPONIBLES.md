# Métricas disponibles · PedidosYa vs Rappi

> Cheat-sheet de qué data tenemos disponible de cada vendor para alimentar reportes.
> Última actualización: mayo 2026.

## 📚 Links a la doc oficial

### PedidosYa (Delivery Hero)

| Sección | URL |
|---|---|
| 🏠 Plugin API (lo que ELLOS llaman a nosotros) | https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-plugin-api |
| 🏠 Middleware API (lo que NOSOTROS llamamos) | https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api |
| 📊 **POS Order Report service** (key para reportes) | https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/POS-Order-Report-service |
| 🔄 Update Order Status | https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/Order/operation/Update%20Order%20Status |
| 📦 Get List of Order Ids | https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/POS-Order-Report-service/operation/Get%20List%20of%20Order%20Ids |
| 📦 Get Order Details | https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-middleware-api#tag/POS-Order-Report-service/operation/Get%20Order%20Details |
| 🍔 Schema completo del Order | local: [`docs/pedidosya/pluginOrder.yaml`](pedidosya/pluginOrder.yaml) (1033 líneas) |
| 📜 Spec middleware completa | local: [`docs/pedidosya/middleware.yaml`](pedidosya/middleware.yaml) (3585 líneas) |

### Rappi (Restaurants Public API)

| Sección | URL |
|---|---|
| 🏠 Home dev portal | https://dev-portal.rappi.com/es/ |
| 🚀 Getting started + dominios país | https://dev-portal.rappi.com/es/getting-started/ |
| 🔐 Authentication process | https://dev-portal.rappi.com/es/authentication-process/ |
| 📝 Self-onboarding (necesita TAM) | https://dev-portal.rappi.com/es/self-onboarding/ |
| 📋 Managing user orders | https://dev-portal.rappi.com/es/managing-user-orders/ |
| 📨 Webhook events | https://dev-portal.rappi.com/es/webhook-events/ |
| 📊 **API Reference: Orders** (key para reportes) | https://dev-portal.rappi.com/es/api-reference/orders/ |
| 🍽️ Managing menus | https://dev-portal.rappi.com/es/managing-store-menus/ |
| 🏪 Retrieving stores data | https://dev-portal.rappi.com/es/retrieving-stores-data/ |
| 🟢 Managing availability | https://dev-portal.rappi.com/es/managing-availability/ |

---

## 🔍 Comparativa por categoría

### 🆔 Identificación

| | PedidosYa | Rappi |
|---|---|---|
| ID interno único | `token` (UUID) | `order_id` |
| Código humano | `code`, `shortCode` | `order_id` (mismo, no hay alias humano) |
| Tienda / sucursal | `platformRestaurant.id` | `store.internal_id` + `external_id` |
| Timestamp creación | `createdAt` ISO | `created_at` ISO |

### 👤 Cliente

| | PedidosYa | Rappi |
|---|---|---|
| Nombre | `customer.firstName` + `lastName` | `customer.first_name` + `last_name` |
| Teléfono | `customer.mobilePhone` | `customer.phone_number` |
| Email | `customer.email` | _no expone_ |
| DNI / documento | `corporateTaxId` (solo corporativo) | `customer.document_number` ✅ |
| **Tipo de usuario** | `corporateOrder` (bool) | `customer.user_type` ej `USER_VIP` ✅ |

### 🛒 Items / productos

| | PedidosYa | Rappi |
|---|---|---|
| Nombre | `products[].name` | `items[].name` |
| Categoría | `products[].categoryName` ✅ | _no expone_ |
| Cantidad | `products[].quantity` | `items[].quantity` |
| Precio unitario | `products[].unitPrice` ✅ | _calcular `price/quantity`_ |
| Precio total ítem | `products[].paidPrice` | `items[].price` |
| SKU/código interno | `products[].remoteCode`, `sku` | `items[].sku`, `items[].id` |
| Toppings/agregados | `selectedToppings[]` con name + price | `items[].subitems[]` con SKU + price |
| Comentarios cliente | `products[].comment` | `items[].comments` |
| Variación | `products[].variation` | _en `subitems`_ |

### 💰 Precios y totales

| | PedidosYa | Rappi |
|---|---|---|
| Total bruto | `price.grandTotal` | `totals.total_order` |
| Total neto | `price.totalNet` | `totals.total_products` |
| **IVA separado** | `price.vatTotal` ✅ | _no separado_ |
| Delivery fee | `price.deliveryFees[]` array detallado | `totals.charges.shipping` |
| Service fee | _en `deliveryFee`_ | `totals.charges.service_fee` ✅ |
| Propina al rider | `price.riderTip` | `totals.other_totals.tip` |
| Cobrar en mano | `price.collectFromCustomer`, `payRestaurant` | `totals.total_to_pay` |
| Discount total | `discounts[]` con sponsorships ✅ | `totals.total_discounts` |
| Crédito Rappi usado | n/a | `totals.other_totals.total_rappi_credits` ✅ |
| Pago con Rappi Pay | n/a | `totals.other_totals.total_rappi_pay` ✅ |

### 🎁 Descuentos detallados

**PY** (`discounts[]` con `sponsorships[]`):
- `name`, `amount`
- `sponsor: PLATFORM | VENDOR | THIRD_PARTY` con `amount` cada uno
- Sabés EXACTAMENTE quién pagó cada centavo de cada descuento ✅
- También en `products[].discounts` y `selectedToppings[].discounts` (item-level)

**Rappi** (`discounts[]`):
- `value`, `description`, `title`, `type` (shipping / offer_by_product / etc.)
- `value_type`: `percentage | fixed`
- `percentage_by_rappi` vs `percentage_by_partners`
- `amount_by_rappi` vs `amount_by_partner`
- `discount_product_units`, `discount_product_unit_value`
- `includes_toppings`, `max_value`
- También `delivery_discount.total_percentage_discount` y `total_value_discount`

### 🚚 Delivery

| | PedidosYa | Rappi |
|---|---|---|
| Tipo | `expeditionType: delivery \| pickup` | `delivery_method: delivery \| marketplace \| pickup` |
| Quien entrega | `delivery.riderPickupTime` (null = vendor delivery) | `delivery_method: marketplace` (vendor) vs `delivery` (Rappi rider) |
| Dirección | `delivery.address` con calle, número, ciudad, postal, lat, lng | `delivery_information` con `street_name`, `street_number`, `city`, `neighborhood`, `postal_code`, `complete_address`, `complement` |
| **Geocoding quality** | _no expone_ | `match_geocoding_address`, `match_original_address`, `has_reverse_geocoding_result` ✅ |
| Tiempo de cocción | `preparationTimeAdjustments` | `cooking_time` real + `min_cooking_time` + `max_cooking_time` ✅ |
| **Tracking del rider en vivo** | _no expone_ | webhook `ORDER_RT_TRACKING` con `lat`, `lng`, `eta_in_millis`, `eta_type`, `courier_id` ✅ |

### 💳 Pago

| | PedidosYa | Rappi |
|---|---|---|
| Tipo | `payment.type` | `payment_method` (cc / cash / online / etc.) |
| Estado | `payment.status` | _implícito en `total_to_pay = 0`_ |
| Datos de facturación | `invoicingInformation` con CUIT, razón social | `billing_information` con `name`, `email`, `phone`, `document_type`, `document_number` ✅ |

### 📅 Estados y eventos

**PY** — webhooks de status update:
- `order_accepted`, `order_rejected`, `order_picked_up`, `cancelled`
- Auto-cancel si no respondés en X minutos (varía por plataforma)

**Rappi** — webhooks granulares ✅:
- `NEW_ORDER` / `ORDER_EVENT_CANCEL` / `ORDER_OTHER_EVENT`
- Lifecycle eventos sub-tipo: `ready_for_pick_up`, `domiciliary_in_store`, `hand_to_domiciliary`, `arrive`, `close_order`
- 10 sub-tipos de cancelación: `cancel_by_user`, `canceled_with_charge`, `cancel_by_support`, `canceled_by_fraud_automation`, `canceled_store_closed`, etc.
- Auto-cancel a los **6 minutos exactos**

### 📜 Historial / consulta histórica

**PY**:
- `GET /v2/chains/{chainCode}/orders/ids?status=accepted|cancelled&pastNumberOfHours=24` (1-24h hacia atrás)
- `GET /v2/chains/{chainCode}/orders/{orderId}` para detalle completo
- Limitación: solo `accepted` o `cancelled` como filtros, máx 24h

**Rappi**:
- `GET /api/v2/.../orders` snapshot (transiciona READY → SENT como side effect)
- `GET /api/v2/.../orders/status/sent` últimos 10 min
- `GET /api/v2/.../orders/{orderId}/events` ✅ — timeline completo con timestamps por evento

---

## 📊 Reportes que se pueden armar

### Operacionales (alta frecuencia, near real-time)

- **Ventas brutas / netas por canal y hora** — ambos
- **Ticket promedio** — ambos
- **Top productos por cantidad y ARS** — ambos
- **Toppings/agregados más vendidos** — ambos (Rappi con SKU = mejor cruce con inventario)
- **Tiempo de prep promedio** — Rappi tiene min/max/real, PY ajustes
- **Tasa de rechazo / razones** — PY tiene `reason`, Rappi tiene 10 sub-tipos
- **Pedidos timeout (no aceptados a tiempo)** — ambos
- **Items frecuentemente sin stock** — `items_sku[]` que mandamos al rechazar (Rappi)

### Financieros (mensual / cierre)

- **Comisión de la plataforma** — PY: sum sponsor=PLATFORM; Rappi: sum amount_by_rappi
- **Cuánto puso vendor en promos** — PY: sponsor=VENDOR; Rappi: amount_by_partner
- **Delivery fee real** — PY array detallado; Rappi `charges.shipping`
- **Service fee** — PY oculto en deliveryFee; Rappi `charges.service_fee` ✅ separado
- **Propinas al rider** — ambos
- **IVA discriminado** — PY ✅ (`vatTotal`); Rappi NO (hay que estimarlo)
- **Pagos online vs efectivo** — ambos
- **Crédito Rappi Pay usado** — Rappi ✅ (datos de fidelización)

### Marketing / clientes

- **Clientes recurrentes** — ambos por phone, Rappi por document_number ✅
- **Clientes corporate** — PY `corporateOrder/Tax`; Rappi `user_type=USER_VIP`
- **Heatmap geográfico** — ambos lat/lng; Rappi tiene calidad de geocoding ✅
- **Hora pico por barrio** — Rappi `neighborhood` ✅; PY hay que parsear
- **Email para campañas** — solo PY ✅

### Logística

- **Tiempo total puerta a puerta** — Rappi gana con `arrive` + `close_order`; PY no expone entrega final
- **Tiempo en cocina** — ambos
- **Tiempo cocina → rider** — ambos pero Rappi más granular
- **% pickup vs delivery** — ambos

### Calidad / alertas

- **Pedidos timeout** — ambos
- **Direcciones que fallan geocoding** — Rappi ✅
- **Items con problemas (out-of-stock)** — PY ItemUnavailabilityHandling; Rappi vía rejects con SKU
- **Comentarios negativos del cliente** — text mining sobre `customerComment` (PY) o `comments` (Rappi)
- **Streak de rechazos** — Rappi te deshabilita la tienda si rechazás muchos seguidos ⚠️ (importante alerta)

### Estratégicos (cruzar PY + Rappi + POS interno)

- **Margen real por producto** = ARS facturado − comisión_plataforma − costo_insumo
- **Canibalización entre canales** = mismo phone pidiendo PY + Rappi
- **Sucursal más rentable por canal**
- **Día/hora muerta** (los 3 canales bajos = ventana para campaña)
- **ROI de descuento sponsoreado**: producto con discount → cuánto subió volumen → ingreso vs costo
- **CAC implícito** = comisiones plataforma / clientes nuevos

---

## ⚠️ Lo que NO te dan ni una ni la otra

- Funnel previo al pedido (impresiones, clicks, abandono carrito)
- Reviews/calificaciones del pedido (las apps las guardan internas, no las exponen al partner)
- Datos demográficos del cliente (edad, género)
- Hora exacta de entrega final (Rappi sí via `close_order`, PY no expone)
- Razón cualitativa de un rechazo desde su lado (Rappi te da el sub-event pero no contexto)

---

## 🎯 Quick wins para empezar

1. **Cierre Z diario** — facturado/tickets/promedio/canales — ya implementado en `/reportes`
2. **Ranking semanal de productos** — alimenta decisiones de menú y stock
3. **Ratio comisión/facturado por canal** — para negociar con vendor cuando renovás contrato
4. **Heatmap de zonas** — para definir radios de delivery propio vs apps
5. **Alerta automática** si streak de 3+ rechazos en Rappi (deshabilita tienda)
6. **Tiempo prep real vs estimado** — calibrar para que la app no te penalice por demoras

Implementación pendiente:
- Activar Postgres en Vercel (1 click) — sin esto los reportes son por-instancia
- Cron de backfill: agarrar histórico de `GET /v2/chains/.../orders/ids` (PY) cada hora
- Cruce con `posVendorId` para multi-sucursal
