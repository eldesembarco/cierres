# n8n · Workflow de Discovery (Etapa 1c)

**Objetivo**: pegar una sola vez contra Google Business Profile API para obtener el `place_id` y `location_name` (resource name) de cada una de las 4 fichas piloto, y popular las celdas correspondientes en la hoja `Locales` del Sheet.

Después de este workflow, las hojas `Metricas` y `Reviews` ya pueden recibir la ingesta diaria porque tienen el `location_name` necesario para llamar las APIs.

## Pre-requisitos

- ✅ Sheet `Maps Insights - El Desembarco` creado (correr `crear-sheet-maps.gs`)
- ✅ Hoja `Locales` poblada con los 4 nombres + store_code (ya viene del seed)
- ✅ Credencial **Google Sheets** en n8n (`CwvJhd6EFScImvcu` — ya existe)
- ⏳ Credencial **Google OAuth2** en n8n con scope `business.manage` (crear según `gbp-oauth-setup.md` § "Compartir el token con n8n")
- ⏳ Allowlist de Google aprobado (no necesario para listAccounts/listLocations, sí para Performance/Reviews)

## Flujo del workflow

```
┌─────────────────┐
│ Manual Trigger  │  (one-shot, lo activás vos)
└────────┬────────┘
         ↓
┌─────────────────────────────┐
│ HTTP Request                 │  GET https://mybusinessaccountmanagement
│   listAccounts                  .googleapis.com/v1/accounts
│   Auth: Google OAuth2          → devuelve { accounts: [{ name, ... }] }
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│ Split In Batches            │  itera sobre cada account
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│ HTTP Request                 │  GET .../v1/{accountName}/locations
│   listLocations                 ?readMask=name,storeCode,title,
│   Auth: Google OAuth2           primaryCategory,storefrontAddress,metadata
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│ Code (transform)             │  flatten + para cada location:
│                                  - extract storeCode
│                                  - format direccion
│                                  - extract place_id de metadata
│                                  - tomar primaryCategory.displayName
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│ Google Sheets · Update Row   │  match por store_code en hoja Locales
│   columns: place_id,            update solo:
│            location_name,         place_id, location_name, display_name,
│            display_name,          categoria, updated_at
│            categoria,
│            updated_at
└────────┬────────────────────┘
         ↓
┌─────────────────────────────┐
│ HTTP Request (opcional)      │  POST a /api/webhooks/n8n/revalidate
│   webhook-revalidate            del Next, para que el dashboard pegue
│                                  refresh inmediato
└─────────────────────────────┘
```

## Mapping de campos (location → hoja Locales)

| API field | Sheet column |
|---|---|
| `storeCode` | `store_code` (match key) |
| `name` (e.g. `accounts/123/locations/456`) | `location_name` |
| `metadata.placeId` | `place_id` |
| `title` | `display_name` |
| `storefrontAddress.addressLines[].join() + locality + administrativeArea` | `direccion` (si está vacía) |
| `primaryCategory.displayName` | `categoria` |
| `new Date().toISOString()` | `updated_at` |

> NO sobreescribir `local`, `activo`, `local_interno` — esos los manejás vos a mano.

## Validación post-ejecución

En la hoja `Locales`, las 4 filas deberían tener:
- `place_id` no vacío (string tipo `ChIJ...`)
- `location_name` no vacío (string tipo `accounts/{N}/locations/{M}`)
- `categoria` poblado (ej. "Hamburguesería")
- `display_name` matcheando lo que veías en Business Profile Manager

Si alguna fila no se actualizó, probable causa:
- `store_code` del Sheet no matchea el `storeCode` de la API → revisar que copiaste bien los 20 dígitos
- la cuenta `polejavetzky@eldesembarco.com` no tiene admin sobre esa ficha → re-confirmar en Business Profile Manager

## Cómo armarlo

**Opción A — manual**: crear el workflow desde la UI de n8n con los nodos descriptos arriba.

**Opción B — desde Claude**: cuando tengas la credencial OAuth de GBP creada en n8n, decime el ID de la credencial y armo el workflow vía n8n MCP en tu instancia, dejándolo inactivo y listo para que vos lo actives.

## Después de discovery

Con `Locales` poblada, los siguientes 3 workflows pueden correr (Etapa 2):

1. **`ingest-performance`** — cron diario 03:00. Para cada local activo, llamar `fetchMultiDailyMetricsTimeSeries` últimos 3 días (margen de estabilización). Append a `Metricas`.
2. **`ingest-reviews`** — cron diario 03:30. Para cada local activo, listar reviews. Upsert a `Reviews` por `review_id`.
3. **`compute-snapshot`** — cron diario 04:00. Recalcular hoja `Snapshot` desde `Metricas` + `Reviews`.
