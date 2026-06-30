# Reportes con datos reales

La pantalla `/reportes` consume `/api/reports?from=…&to=…` que agrega los pedidos persistidos. Funciona en **dos modos**:

| Modo | Cuándo | Qué guarda |
|---|---|---|
| 🟡 **Memoria** | Default — sin Postgres configurado | Solo lo que esté en RAM de la instancia actual de Vercel. Se pierde con cada cold start o redeploy |
| 🟢 **Postgres** | Cuando `POSTGRES_URL` está en env | Persistencia real entre instancias y deploys. Reportes históricos. Indices para queries rápidas |

El badge en el header de `/reportes` te muestra en qué modo está corriendo.

## Activar Postgres (5 minutos en Vercel Dashboard)

### 1. Agregar Neon Postgres del Marketplace

En el dashboard de Vercel del proyecto `pos-desembarco`:

1. Ir a la tab **Storage**
2. Click **Create Database** → seleccionar **Neon Serverless Postgres** (free tier alcanza)
3. Nombre sugerido: `pos-orders`
4. Region: `aws-iad1` (Virginia, lo que matchea el deploy default)
5. Click **Create + Connect to Project**

Vercel automáticamente:
- Crea la base
- Agrega `POSTGRES_URL` y otros env vars al proyecto en production + preview
- Linkea las dos cosas

### 2. Redeploy

```bash
vercel --prod
```

(o desde el dashboard, hit "Redeploy" en el último deployment)

### 3. Inicializar el schema

Una llamada GET para crear las tablas:

```bash
curl https://pos-desembarco.vercel.app/api/admin/init-db
```

Respuesta esperada:
```json
{ "ok": true, "mode": "postgres", "message": "Schema ready" }
```

Si todavía no está configurado:
```json
{ "ok": false, "mode": "memory", "message": "POSTGRES_URL not configured — running in-memory" }
```

### 4. Verificar

Abrí `/reportes` — el badge ahora muestra **POSTGRES** (verde) en lugar de **MEMORIA** (ámbar).

Probá simulando algunos pedidos en `/apps` (Sim PY / Sim Rappi) y volvé a `/reportes` — los KPIs y charts se llenan en tiempo real.

## Schema

Dos tablas:

```sql
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,            -- ED-XXXXXX
  app             TEXT NOT NULL,               -- 'pedidosya' | 'rappi'
  state           TEXT NOT NULL,               -- received | accepted | ready | picked_up | etc
  received_at     BIGINT NOT NULL,             -- ms timestamp
  updated_at      BIGINT NOT NULL,
  remote_id       TEXT,
  py_code         TEXT,
  py_token        TEXT,                        -- discriminator
  rappi_order_id  TEXT,                        -- discriminator
  rappi_store_id  TEXT,
  country_domain  TEXT,
  customer_name   TEXT,                        -- denormalizado del raw
  customer_phone  TEXT,
  total_value     INTEGER NOT NULL,            -- en centavos / unidades menores ARS
  items_count     INTEGER NOT NULL,
  payment_method  TEXT,
  rejection_reason TEXT,
  prep_time_min   INTEGER,
  raw             JSONB NOT NULL               -- payload completo del webhook (auditoría)
);

CREATE TABLE order_items (
  order_id        TEXT REFERENCES orders(id) ON DELETE CASCADE,
  idx             INTEGER,
  name            TEXT NOT NULL,
  quantity        INTEGER,
  unit_price      INTEGER,
  total_price     INTEGER,
  sku             TEXT,
  PRIMARY KEY (order_id, idx)
);
```

Índices:
- `idx_orders_received_at` (DESC) — list / range queries
- `idx_orders_app_state` — filtrado por app + estado
- `idx_orders_py_token` — idempotency PY
- `idx_orders_rappi` — idempotency Rappi
- `idx_order_items_name` — agrupación top-products

## Endpoints de reportes

`GET /api/reports?from=<ms>&to=<ms>` devuelve TODO el batch:

```json
{
  "mode": "postgres",
  "range": { "fromMs": 1234, "toMs": 5678 },
  "kpis": { "facturado": 1842500, "tickets": 87, "ticketPromedio": 21178, "propinas": 156612 },
  "byHour": [{ "hour": 20, "total": 248000, "tickets": 12 }, ...],
  "byChannel": [{ "app": "pedidosya", "total": 342000, "tickets": 18 }, ...],
  "topProducts": [{ "name": "Desembarco", "qty": 38, "total": 828400 }, ...],
  "byPayment": [{ "method": "ONLINE", "total": 524000, "tickets": 28, "pct": 28 }, ...]
}
```

Default range: últimas 24h si no se mandan params.

## Backfill histórico (cuando estén las creds)

PY tiene endpoint para listar pedidos históricos:
```
GET /v2/chains/{chainCode}/orders/ids?status=accepted&pastNumberOfHours=24
GET /v2/chains/{chainCode}/orders/{orderId}    # por cada uno
```

Rappi tiene:
```
GET /api/v2/restaurants-integrations-public-api/orders                     # snapshot READY
GET /api/v2/restaurants-integrations-public-api/orders/{id}/events         # historial
```

A futuro: un Vercel Cron Job llama estos endpoints cada hora y hace upsert al store. La schema ya soporta `ON CONFLICT (id) DO UPDATE` así que no hay que preocuparse por duplicados.

## Costos

- **Free tier de Neon (via Vercel Marketplace)**:
  - 0.5 GB storage
  - 100 horas de cómputo
  - alcanza para mucho — un POS de un restaurant genera ~10-100 pedidos/día = ~30 MB/año
- Si crece: Pro plan $19/mes con 10 GB y autoscaling
