# n8n · Piggyback sobre el workflow existente del dashboard

**Approach correcto**: el workflow de Apify ya corre 1 vez al día en el dashboard de produ.
LucIA se cuelga al final de ese workflow para reusar la data — sin disparar Apify de nuevo.

## Diagrama

```
┌──────────────────────────── WORKFLOW EXISTENTE (dashboard produ) ────────────────────────────┐
│                                                                                              │
│  [Cron diario]                                                                               │
│       ↓                                                                                      │
│  [Apify run]  → scrapea TODOS tus locales (109+ fichas)                                      │
│       ↓                                                                                      │
│  [Get dataset items]                                                                         │
│       ↓                                                                                      │
│  [Append a Sheet produ]  → escribe al Sheet `1oWEGxG5C0U7RGReQpCy2KdIvU7B0PyEvjYEh6HlkJqs`  │
│       ↓                                                                                      │
│  ✦ ─── ACÁ EMPALMA LUCIA ────────────────────────────────────────────────── ✦                │
│       ↓                                                                                      │
│  [1. Filter]  → solo placeIds del piloto LucIA (4 fichas)                                    │
│       ↓                                                                                      │
│  [2. Code]    → diff vs Sheet de LucIA (detectar reviews nuevas)                             │
│       ↓                                                                                      │
│  [3. Google Sheets]  → append al Sheet de LucIA `1G474XZtwLBw9fbSitFZKxuCB4uKw85uAvp-nTGDRA2k`│
│       ↓                                                                                      │
│  [4. HTTP Request]   → POST /api/webhooks/n8n/new-reviews con los reviewIds nuevos           │
│       ↓                                                                                      │
│  [5. (opcional) Email/Slack] → notificar al CM con summary                                   │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Costo extra**: cero (Apify ya corre).

## Setup paso a paso

Abrí tu workflow existente del dashboard. Después del último nodo que escribe a la hoja `reviews` del Sheet produ, agregás 4 nodos.

### Credencial nueva (1 vez)

En n8n → **Credentials → New → Header Auth**
- Name: `LucIA · n8n webhook`
- Header Name: `x-webhook-secret`
- Header Value: `vuoxVLPWRMNHT0x0sW+lW0m/ginG3566xUZEPOzZEsc=`
- Save

(Es la `N8N_WEBHOOK_SECRET` del `.env.local` de LucIA, ya en producción)

---

### Nodo 1: Filter — solo placeIds del piloto

**Tipo**: `Filter` o `IF`

Condición: el `placeId` de la review actual está en la lista de los 4 piloto.

```javascript
// Si usás "Filter" con expresión:
{{ ['ChIJCeFoPAAPG5QRfd80k993A00', 'ChIJ-T3i8sSxvJURsG8WJkzX2qo', 'ChIJN4pDXVoNRZQRbh55N8y6uNk', 'ChIJ9QQTy6ulvJUR3vjyKR4-CDg'].includes($json.placeId) }}
```

**Output**: solo las reviews de Jujuy / Munro / Resistencia / San Fernando.

---

### Nodo 2: Code — Diff contra Sheet de LucIA + normalizar

**Tipo**: `Code` (JavaScript)

```javascript
// Input: items filtrados (solo los 4 piloto)
// Hacemos GET al Sheet de LucIA para saber qué reviews ya existen.

const inputItems = $input.all().map(x => x.json);

// Map placeId → nombre del local LucIA
const PLACE_TO_LOCAL = {
  'ChIJCeFoPAAPG5QRfd80k993A00': 'El Desembarco Jujuy',
  'ChIJ-T3i8sSxvJURsG8WJkzX2qo': 'Mr Tasty Munro',
  'ChIJN4pDXVoNRZQRbh55N8y6uNk': 'Mr Tasty Resistencia',
  'ChIJ9QQTy6ulvJUR3vjyKR4-CDg': 'Mr Tasty San Fernando',
};

// Fetch reviews actuales del Sheet de LucIA via export CSV (público, sin auth)
const SHEET_ID = '1G474XZtwLBw9fbSitFZKxuCB4uKw85uAvp-nTGDRA2k';
const GID = '1952686816'; // hoja Reviews
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

const csvText = await this.helpers.httpRequest({ url, method: 'GET', returnFullResponse: false });
const lines = csvText.split('\n').slice(1); // skip header
const existingIds = new Set(lines.map(l => l.split(',')[0].replace(/^"|"$/g, '')));

// Normalizar al schema del Sheet LucIA y filtrar nuevas
const now = new Date().toISOString();
const newRows = inputItems
  .filter(r => {
    const id = r.reviewId || r.id;
    return id && !existingIds.has(id);
  })
  .map(r => ({
    review_id: r.reviewId || r.id,
    local: PLACE_TO_LOCAL[r.placeId] || 'Desconocido',
    fecha: r.publishAtDate || r.publishedAt || r.publishedAtDate || '',
    rating: parseInt(r.stars || r.rating || 0),
    autor: r.reviewerName || r.name || 'Anónimo',
    texto: r.reviewText || r.text || '',
    respuesta: r.responseFromOwnerText || '',
    respuesta_fecha: r.responseFromOwnerDate || '',
    respondida: !!(r.responseFromOwnerText),
    imagenes: JSON.stringify(r.reviewImageUrls || []),
    created_at: now,
  }));

return newRows.map(r => ({ json: r }));
```

**Output**: solo las reviews NUEVAS del piloto, con schema correcto del Sheet de LucIA.

---

### Nodo 3: Google Sheets — Append al Sheet de LucIA

**Tipo**: `Google Sheets` (con la credencial que ya tenés `CwvJhd6EFScImvcu`)

**Configuración**:
- Operation: **Append row**
- Document: `1G474XZtwLBw9fbSitFZKxuCB4uKw85uAvp-nTGDRA2k` (Sheet de LucIA)
- Sheet: `Reviews`
- Mapping mode: `Map each column manually`
- Map cada columna del json al header correspondiente del Sheet:
  - `review_id` → `review_id`
  - `local` → `local`
  - `fecha` → `fecha`
  - `rating` → `rating`
  - `autor` → `autor`
  - `texto` → `texto`
  - `respuesta` → `respuesta`
  - `respuesta_fecha` → `respuesta_fecha`
  - `respondida` → `respondida`
  - `imagenes` → `imagenes`
  - `created_at` → `created_at`

> Si no tiene acceso, compartí el Sheet de LucIA con la cuenta `polejavetzky@eldesembarco.com` que ya está en la credencial de Google Sheets.

---

### Nodo 4: Code — Recopilar reviewIds para el webhook

**Tipo**: `Code`

```javascript
// Tomamos todos los reviewIds que pasaron por el append
const ids = $('Code').all().map(x => x.json.review_id).filter(Boolean);
return [{ json: { reviewIds: ids } }];
```

> "Code" en `$('Code')` debe matchear el nombre que le pongas al nodo 2. Si lo nombrás "Diff LucIA", usá `$('Diff LucIA')`.

---

### Nodo 5: HTTP Request — POST al webhook de LucIA

**Tipo**: `HTTP Request`

**Configuración**:
- Method: **POST**
- URL: `https://desembarco-lucia.vercel.app/api/webhooks/n8n/new-reviews`
- Authentication: **Generic Credential Type → Header Auth** → seleccionar `LucIA · n8n webhook`
- Body Content Type: `JSON`
- Body:
```json
{{ JSON.stringify({ reviewIds: $json.reviewIds }) }}
```

O en modo "raw":
```json
{
  "reviewIds": {{ JSON.stringify($json.reviewIds) }}
}
```

**Behavior on error**:
- ❌ NO marcar el workflow como failed (LucIA puede estar caído por mantenimiento)
- ✅ Continue On Fail = true
- ✅ Retry on Failure = 2 retries con backoff 30s

---

### Nodo 6 (opcional): Slack/Email — Notificar al CM

Cuando `$json.processed > 0`:

```
📊 LucIA procesó {{ $json.processed }} reseñas nuevas:
✓ {{ $json.summary.auto_approved }} auto-aprobadas (5★ positivas)
⏳ {{ $json.summary.pending_cm }} esperan revisión del CM (3-4★)
🚨 {{ $json.summary.urgent_manual }} URGENTES (1-2★)

→ Panel: https://desembarco-lucia.vercel.app/dashboard
```

---

## Test sin esperar al cron

Apenas tengas los nodos conectados:

1. n8n → **Execute Workflow** (botón manual del workflow completo)
2. O ejecutá solo desde el nodo Filter en adelante (click derecho → Execute node)

Mirá los logs de cada nodo:
- Filter: cuántas reviews quedaron (4 piloto vs 109 total del scraper)
- Code: cuántas son NUEVAS (vs ya existentes en LucIA)
- Append: confirmación de filas escritas al Sheet de LucIA
- HTTP Request: response del webhook con summary (`{ ok, processed, summary, results }`)

Si todo OK, el dashboard de LucIA debería mostrar las nuevas reviews + drafts generados a los pocos segundos.

---

## Ventajas de este approach

| | Workflow standalone | Piggyback (este) |
|---|---|---|
| Costo Apify extra | ~$3-75/mes | **$0** |
| Coordinación con cron | 2 timestamps a sync | **1 solo cron** |
| Riesgo desincronización | sí | **cero** |
| Esfuerzo setup | crear workflow nuevo | sumar 4 nodos al existente |
| Cuando llegue GBP API | hay que migrar | **se reemplazan los nodos directamente** |

---

## Cuando aprueben GBP API (si vuelve a aplicar)

Reemplazás el nodo Apify del workflow existente por **My Business Reviews API** y todo el resto sigue igual.

Mientras tanto, este pipeline funciona **100%** sin GBP API.
