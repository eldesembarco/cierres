# Workflow n8n · Email/Slack de resumen diario

Llega al CM cada mañana con el resumen del día.

## Flujo

```
[Schedule Trigger]                cron diario 08:00 ART (11:00 UTC)
      ↓
[HTTP Request → LucIA]            GET /api/cron/daily-summary
      ↓                            con header x-webhook-secret
[IF needs_attention]               summary.needs_attention === true
      ↓
[Set]                              format del email/slack
      ↓
[Email Send / Slack]               notifica al CM
```

## Setup

### 1. Credenciales

- **Header Auth (LucIA webhook)**: la misma del workflow de ingesta
- **Email**: SMTP de tu cuenta (Gmail funciona). En n8n: Credentials → SMTP
- **Slack** (opcional): incoming webhook o token

### 2. Nodos

#### A. Schedule Trigger
- Cron: `0 8 * * *` ART → `0 11 * * *` UTC

#### B. HTTP Request — GET LucIA daily-summary
- Method: **GET**
- URL: `https://desembarco-lucia.vercel.app/api/cron/daily-summary`
- Headers: `x-webhook-secret: {{ $credentials.luciaWebhook.value }}`

#### C. IF — solo si hay algo que mostrar
- Condition: `{{ $json.summary.needs_attention === true }}`
- Si false → workflow termina (no spam si no hay novedades)

#### D. Set — Formatear el email

Campos a setear:

**subject**:
```
LucIA · Reseñas {{ $json.summary.counts.total }} nuevas · {{ $json.summary.counts.urgentes > 0 ? '🚨 ' + $json.summary.counts.urgentes + ' URGENTES' : 'al día' }}
```

**body_html**:
```html
<h2 style="font-family:sans-serif;color:#2d1810">Resumen del día · El Desembarco LucIA</h2>

<p style="font-family:sans-serif">
<strong>{{ $json.summary.counts.total }}</strong> reseñas nuevas en las últimas 24hs.
</p>

<table style="font-family:sans-serif;border-collapse:collapse;width:100%;max-width:600px">
  <tr style="background:#f4ead5">
    <td style="padding:8px;border-bottom:2px solid #d4a017">🚨 Urgentes (1-2★)</td>
    <td style="padding:8px;border-bottom:2px solid #d4a017;text-align:right;font-weight:bold;color:#8b1f0f">
      {{ $json.summary.counts.urgentes }}
    </td>
  </tr>
  <tr>
    <td style="padding:8px;border-bottom:1px dashed #e8dcc0">⏳ Pendientes CM (3-4★)</td>
    <td style="padding:8px;border-bottom:1px dashed #e8dcc0;text-align:right">
      {{ $json.summary.counts.pendientes_cm }}
    </td>
  </tr>
  <tr>
    <td style="padding:8px;border-bottom:1px dashed #e8dcc0">✓ Auto-aprobadas (5★)</td>
    <td style="padding:8px;border-bottom:1px dashed #e8dcc0;text-align:right;color:#3d5424">
      {{ $json.summary.counts.auto_aprobadas }}
    </td>
  </tr>
  <tr>
    <td style="padding:8px">📤 Enviadas hoy</td>
    <td style="padding:8px;text-align:right">{{ $json.summary.counts.enviadas }}</td>
  </tr>
</table>

<p style="margin-top:20px">
  <a href="https://desembarco-lucia.vercel.app/dashboard" 
     style="display:inline-block;padding:12px 24px;background:#2d1810;color:#faf3e0;text-decoration:none;font-family:monospace;text-transform:uppercase;letter-spacing:0.1em">
    Abrir Panel →
  </a>
</p>

{{#if $json.summary.urgentes.length}}
<h3 style="margin-top:30px;color:#8b1f0f">🚨 Reseñas urgentes</h3>
{{#each $json.summary.urgentes}}
<div style="border-left:3px solid #c8331e;padding:10px;margin:10px 0;background:#f4ead5">
  <p style="margin:0"><strong>{{ this.autor }}</strong> · {{ this.local }} · {{ this.rating }}★</p>
  <p style="margin:8px 0 0;font-style:italic">"{{ this.texto }}"</p>
</div>
{{/each}}
{{/if}}

<p style="margin-top:30px;color:#4a2c1a;font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.15em">
  El Desembarco · Panel de Reseñas
</p>
```

> El templating de n8n usa `{{ }}` para expresiones JS, no Handlebars puro. Para iterar arrays usar nodos separados (Split In Batches → Set → Merge). O compilar el HTML en un nodo Code.

#### E. Email Send

- Credentials: SMTP de Gmail/etc
- From: `panel@eldesembarco.com` o lo que tengas
- To: `polejavetzky@eldesembarco.com,ferrariomatias@gmail.com`
- Subject: `{{ $json.subject }}`
- HTML: `{{ $json.body_html }}`

#### Alternativa Slack

- Slack node → Channel: `#cm-reviews` o DM
- Text:
```
*LucIA Daily · {{ $json.summary.counts.total }} reseñas nuevas*

🚨 Urgentes: {{ $json.summary.counts.urgentes }}
⏳ Pendientes CM: {{ $json.summary.counts.pendientes_cm }}
✓ Auto-aprobadas: {{ $json.summary.counts.auto_aprobadas }}

<https://desembarco-lucia.vercel.app/dashboard|Abrir Panel>
```

## Test manual

```bash
curl -H "x-webhook-secret: vuoxVLPWRMNHT0x0sW+lW0m/ginG3566xUZEPOzZEsc=" \
  https://desembarco-lucia.vercel.app/api/cron/daily-summary
```

Devuelve el JSON con todo el contenido para que n8n arme el email/slack.

## Trigger manual del workflow

Para test inmediato sin esperar las 8 AM:
1. n8n → workflow → "Execute workflow" (manualmente)
2. O endpoint webhook si configurás un Webhook Trigger paralelo
