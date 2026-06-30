# Maps Insights · Plan de integración

## Qué es este proyecto

Panel de métricas de **Google Business Profile** (ex Google My Business) para los locales gestionados desde la cuenta operativa. Lee daily snapshots de vistas, búsquedas, acciones (llamadas / direcciones / clicks web) y reseñas, y los agrega en un dashboard.

Mismo stack que el panel de facturas (n8n + Sheet + React) para que sea fácil de mantener.

> **Nota de alcance**: este proyecto es **independiente** del panel de facturas. El universo de fichas Maps no coincide con los 18 locales del panel de facturas — son grupos distintos. La columna `local_interno` en la hoja `Locales` queda nullable por si más adelante hay overlap y se quiere cruzar.

---

## Stack

- **Ingesta**: n8n self-hosted (`https://n8n.srv1312396.hstgr.cloud`) → cron diario que pega a Business Profile API → escribe Sheet
- **DB**: Google Sheet "Maps Insights - El Desembarco" (a crear con `crear-sheet-maps.gs`)
- **API lectura**: webhooks n8n `GET /webhook/maps/*` (mismo patrón que `/webhook/facturas`)
- **Front**: React 18 vía CDN + Babel standalone (mismo formato que `proyecto-facturas/handoff/`)
- **Auth**: Google OAuth con dominio restringido a `eldesembarco.com` (reusamos el Client ID del panel de facturas)

---

## Cuenta y permisos (estado actual)

- **Cuenta operativa**: `polejavetzky@eldesembarco.com`
- **Permiso**: Administrador en **4 locales** (otorgado local por local desde Google Search por la cuenta dueña):

| Ficha | Store code | Dirección |
|---|---|---|
| El Desembarco Jujuy | 11280071107343906057 | Av. Senador Pérez 235, San Salvador de Jujuy |
| Mr Tasty Munro | 11332625730353158145 | Av. Vélez Sarfield 4235, Munro BA |
| Mr Tasty Resistencia | 13216106111290006902 | Arturo Illia 21, Resistencia, Chaco |
| Mr Tasty San Fernando | 12927600106366812876 | Colon 1376, San Fernando BA |

Las 4 están **verificadas** (chequeable en Business Profile Manager). El piloto se hace sobre estas; cuando se sumen más permisos, basta con agregar filas en la hoja `Locales` y el discovery de n8n las incorpora automáticamente.

---

## APIs de Google a habilitar (Etapa 0)

En **Google Cloud Console** (mismo proyecto del OAuth Client del panel de facturas, o uno nuevo dedicado):

1. **My Business Business Information API** — datos de fichas (`accounts.locations.list`)
2. **My Business Account Management API** — listar cuentas/grupos
3. **Business Profile Performance API** — métricas diarias (vistas, búsquedas, acciones)
4. **My Business Q&A API** — preguntas/respuestas (opcional)

⚠️ **Importante**: Las APIs anteriores requieren **allowlist explícito** de Google. Hay que llenar:
👉 https://developers.google.com/my-business/content/prereqs#request

Tarda entre días y semanas. Sin allowlist, las APIs devuelven 403.

5. **Google My Business API legacy** (Reviews) — también requiere allowlist aparte.

---

## Modelo de datos

### Hoja `Locales`
Una fila por local. Snapshot semi-estático.

| Columna | Tipo | Descripción |
|---|---|---|
| local | string | Nombre canónico (igual a `display_name` por default) |
| store_code | string | Código de tienda asignado en Business Profile Manager |
| place_id | string | ID de Google Maps (para deeplinks) |
| location_name | string | Resource name de la API: `accounts/{a}/locations/{l}` |
| display_name | string | Cómo aparece en Maps |
| direccion | string | Dirección completa |
| categoria | string | Categoría primaria de Maps |
| activo | bool | Si entra en la ingesta diaria |
| local_interno | string | Nullable. Nombre del local en el panel de facturas si hace match |
| created_at | datetime | |
| updated_at | datetime | |

### Hoja `Metricas` (la grande)
Una fila por local × día × métrica. Crece ~18 locales × 30 días × ~10 métricas = ~5400 filas/mes.

| Columna | Tipo | Descripción |
|---|---|---|
| id | string | `{local}-{fecha}-{metrica}` |
| local | string | |
| fecha | date | YYYY-MM-DD |
| metrica | enum | `BUSINESS_IMPRESSIONS_DESKTOP_MAPS` \| `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` \| `BUSINESS_IMPRESSIONS_MOBILE_MAPS` \| `BUSINESS_IMPRESSIONS_MOBILE_SEARCH` \| `CALL_CLICKS` \| `WEBSITE_CLICKS` \| `BUSINESS_DIRECTION_REQUESTS` \| `BUSINESS_CONVERSATIONS` \| `BUSINESS_BOOKINGS` \| `BUSINESS_FOOD_ORDERS` |
| valor | number | |
| created_at | datetime | |

### Hoja `Reviews`
| Columna | Tipo | Descripción |
|---|---|---|
| review_id | string | |
| local | string | |
| fecha | datetime | |
| rating | int | 1-5 |
| autor | string | |
| texto | string | |
| respuesta | string | nullable |
| respuesta_fecha | datetime | nullable |
| respondida | bool | |
| created_at | datetime | |

### Hoja `Snapshot`
Vista agregada para el front (calculada por n8n cada noche). Una fila por local.

| Columna | Tipo |
|---|---|
| local | string |
| rating_promedio | number |
| reviews_total | int |
| reviews_pendientes | int |
| vistas_30d | int |
| acciones_30d | int |
| llamadas_30d | int |
| direcciones_30d | int |
| website_clicks_30d | int |
| variacion_vs_mes_anterior_pct | number |
| updated_at | datetime |

---

## Etapas

### 🟢 Etapa 0 · Setup Google (USER)
- [ ] Habilitar las 4 APIs en Cloud Console
- [ ] Llenar allowlist form de Business Profile API
- [ ] Llenar allowlist form de Reviews API
- [ ] Verificar qué de los 18 locales tienen ficha pública

### 🟡 Etapa 1 · Discovery + Sheet seed (CLAUDE)
- [ ] Correr `crear-sheet-maps.gs` para crear el Sheet vacío
- [ ] n8n workflow one-shot: lista accounts y locations del usuario → popular hoja `Locales` con `place_id` y `location_name` reales
- [ ] Validar matching local interno ↔ ficha Maps

### 🟠 Etapa 2 · Ingesta diaria (CLAUDE)
- [ ] n8n cron diario 03:00 → para cada local → `locations.fetchMultiDailyMetricsTimeSeries` → append en `Metricas`
- [ ] n8n cron diario 03:30 → para cada local → `reviews.list` → upsert en `Reviews`
- [ ] n8n cron diario 04:00 → recalcular hoja `Snapshot`

### 🟣 Etapa 3 · API lectura (CLAUDE)
- [ ] `GET /webhook/maps/snapshot` → devuelve hoja `Snapshot`
- [ ] `GET /webhook/maps/local/:local` → métricas históricas de un local
- [ ] `GET /webhook/maps/reviews?pendientes=true` → cola de reseñas sin respuesta
- [ ] `POST /webhook/maps/reply` → responder reseña (escribe vía API)

### 🔵 Etapa 4 · Front (CLAUDE)
Mismo formato que panel facturas (HTML + .jsx vía CDN, sin build).
- [ ] Vista principal: ranking de los 18 locales (rating, vistas, acciones, reviews pendientes)
- [ ] Detalle por local: timeline de métricas + reviews
- [ ] Cola de reviews pendientes con responder inline
- [ ] Alertas: caídas de vistas mes vs mes, reviews ≤ 2 estrellas

### 🟤 Etapa 5 · Deploy
- Mismo subpath del dashboard de facturas, o app aparte (decidir)

---

## Endpoints de la API (referencia rápida)

| Operación | API endpoint |
|---|---|
| Listar cuentas | `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` |
| Listar locales de una cuenta | `GET https://mybusinessbusinessinformation.googleapis.com/v1/{parent=accounts/*}/locations` |
| Métricas multi-daily | `GET https://businessprofileperformance.googleapis.com/v1/{name=locations/*}:fetchMultiDailyMetricsTimeSeries` |
| Listar reviews | `GET https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/reviews` |
| Responder review | `PUT https://mybusiness.googleapis.com/v4/{name}/reply` |

Quotas por defecto: 10 QPS, 100k requests/día — sobra para 18 locales.

---

## Limitaciones conocidas

- Histórico máximo: **18 meses** desde la fecha actual
- No hay datos demográficos del visitante
- No hay heatmap de origen geográfico
- Reviews API requiere allowlist independiente (más estricto)
- Métricas tardan ~2-3 días en estabilizarse (no pidas datos de "hoy")

---

## Decisiones pendientes

- [ ] ¿Proyecto separado o agregar al mismo dashboard de facturas como tab "Maps"?
- [ ] ¿Notificación a Telegram/email cuando aparece review ≤ 2 estrellas?
- [ ] ¿Histórico inicial: solo desde hoy o backfill 18 meses?
