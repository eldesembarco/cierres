# Cómo consultar el estado del allowlist GBP

## Tu caso

| Campo | Valor |
|---|---|
| **Caso ID** | `3-8005000041197` |
| **Tipo** | Solicitud de acceso básico a las APIs de Google Business Profile |
| **Project ID** | `potent-shade-494216-n6` (proyecto Cloud que tiene la OAuth client) |
| **Project number** | `740164658179` |
| **Cuenta dueña** | `polejavetzky@eldesembarco.com` |
| **Fecha de solicitud** | (Anotala vos cuando lo enviaste para contar los días hábiles) |
| **Tiempo declarado** | 7-10 días hábiles |

## Cómo te enteras del resultado

Google **NO tiene un dashboard público** para tracking de allowlist requests. La comunicación es por email.

### 1. Email automático de Google

Va a llegar un email a `polejavetzky@eldesembarco.com` desde:
- Remitente: `googleapis-ip-allowlist@google.com` o similar (Google rota emails)
- Subject: típicamente algo como *"Your Google Business Profile API access request"* o en español

Buscá en tu inbox por:
- El ID del caso: `3-8005000041197`
- Texto: "Business Profile API"
- Texto: "API access"

⚠️ **Revisá la carpeta spam** — a veces Google manda emails legítimos a spam, sobre todo si la cuenta es de Workspace.

### 2. Test directo a la API

La forma más confiable de saber si te aprobaron, sin esperar el email, es probar la API:

#### Desde producción
👉 https://desembarco-lucia.vercel.app/api/gbp/discover

Si todavía está bloqueado:
```json
{
  "ok": false,
  "error": "GBP 429 ... quota_limit_value: 0",
  "hint": "..."
}
```

Si fue aprobado, vas a ver:
```json
{
  "ok": true,
  "summary": { "accounts": 1, "locations": 4 },
  "accounts": [{
    "account": { "name": "accounts/..." },
    "locations": [
      { "title": "El Desembarco Jujuy", "placeId": "ChIJ...", ... },
      { "title": "Mr Tasty Munro", ... },
      ...
    ]
  }]
}
```

#### Desde tu máquina con curl

```bash
# Generar access token desde refresh token
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$GBP_OAUTH_CLIENT_ID" \
  -d "client_secret=$GBP_OAUTH_CLIENT_SECRET" \
  -d "refresh_token=$GBP_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"

# Con el access_token de la response, listar accounts
curl -H "Authorization: Bearer <access_token>" \
  https://mybusinessaccountmanagement.googleapis.com/v1/accounts
```

Si te devuelve la lista de accounts → aprobado.
Si te devuelve `429` con `quota_limit_value: 0` → todavía pendiente.

## Si tarda más de 10 días hábiles

### Opción 1: contestar al email original

Buscá en tu inbox el email donde Google te confirmó la recepción del caso (lo recibiste el día que enviaste el formulario). **Respondelo** preguntando por el status.

### Opción 2: nuevo formulario

Volvé a https://support.google.com/business/contact/api_default y abrí un nuevo caso, mencionando:
- *"Following up on case 3-8005000041197 submitted on [fecha]. Still no response after [X] business days."*
- Pegale el mismo Project ID y use case que el original
- Marcalo como "Status check" o "Follow-up" si la opción aparece

### Opción 3: forum de comunidad

https://support.google.com/business/community

Postear pidiendo follow-up del caso. Los Google Product Experts a veces ayudan a escalar.

## Razones comunes de rechazo

Si Google rechaza, va a decirte el motivo. Las causas frecuentes:

| Razón | Cómo arreglarlo |
|---|---|
| Use case poco claro | Re-enviar con descripción más detallada (3-5 oraciones específicas sobre qué vas a hacer con la API) |
| Project ID equivocado | Verificar que pegaste bien el number y el ID |
| Eres 3rd party agency sin business owner relationship | Aclarar relación: vos sos owner directo de las fichas, no agencia que las maneja para terceros |
| Falta de business verification en ciertas fichas | Verificar las 4 fichas del piloto en Business Profile Manager |
| Volumen estimado raro | El form pide "expected daily API calls" — poner algo realista (50-200) |

## Mientras esperás

Lo que el panel hace HOY sin allowlist:
- ✅ Dashboard funcional con las 622 reviews scrapeadas (data del proyecto produ existente)
- ✅ Generación de drafts IA con 4 providers (Cerebras, Groq, OpenRouter, Gemini)
- ✅ Comparativa side-by-side de providers
- ✅ Auto-respuesta classificada por sentiment
- ✅ Respuesta manual del CM
- ✅ Logs de auditoría completa
- ✅ Filtros, búsqueda, tabla de reviews

Lo que NO hace hasta el allowlist:
- ❌ Ingesta automática diaria desde Google
- ❌ El click "Enviar a Google" no llega realmente al perfil de Maps (queda APPROVED en DB)
- ❌ Métricas de Performance (vistas, llamadas, etc.)
- ❌ Análisis IA sobre data fresca

Cuando llegue el OK, el unblock es ~10 minutos: configurar credencial OAuth en n8n y activar los workflows de ingesta. Doc en `docs/n8n-discovery-workflow.md` y roadmap en `docs/ROADMAP-post-allowlist.md`.

## Datos clave para tener a mano

```
Project ID:    potent-shade-494216-n6
Project #:     740164658179
Cuenta dueña:  polejavetzky@eldesembarco.com
Caso ID:       3-8005000041197
APIs solicitadas:
  - mybusinessaccountmanagement.googleapis.com
  - mybusinessbusinessinformation.googleapis.com
  - businessprofileperformance.googleapis.com
  - mybusiness.googleapis.com (legacy v4 / reviews)
Locales del piloto:
  - El Desembarco Jujuy        (store: 11280071107343906057)
  - Mr Tasty Munro             (store: 11332625730353158145)
  - Mr Tasty Resistencia       (store: 13216106111290006902)
  - Mr Tasty San Fernando      (store: 12927600106366812876)
```
