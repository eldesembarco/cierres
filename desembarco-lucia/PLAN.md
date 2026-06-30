# Desembarco LucIA · Plan de proyecto

Panel operativo para Community Manager y Marketing de **El Desembarco / Mr Tasty / Mila & Go**.

Integra **Google Business Profile** (reseñas + métricas) con **IA (Gemini)** para drafts de respuesta y análisis. **Meta** (Facebook + Instagram) queda para Parte 2.

---

## Alcance

### Parte 1 — la que estamos construyendo
1. **Google Business Profile**: reviews + Performance API (vistas, búsquedas, llamadas, direcciones, clicks web)
2. **IA capa CM**: drafts de respuesta a reviews con Gemini (aprobación humana SIEMPRE), análisis de temas recurrentes, sentiment trend, alertas

### Parte 2 — postpuesta (esperando Meta Business Manager configurado)
3. **Meta**: Facebook Pages + Instagram Graph (posts, comentarios, mensajes, métricas)

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 + TypeScript + App Router |
| UI | Tailwind CSS 4 |
| DB | Neon Postgres + Prisma 5 |
| Auth | NextAuth (a definir versión cuando se implemente) |
| IA | **Gemini** (`@google/generative-ai`) — modelo 2.5 Flash para drafts, 2.5 Pro para análisis |
| Lectura Sheets | `papaparse` + export CSV |
| Ingesta diaria | n8n self-hosted (`https://n8n.srv1312396.hstgr.cloud`) |
| Deploy | Vercel (proyecto separado, **no tocar** `desembarco-dashboard` de produ) |

> **NUNCA** usar Anthropic SDK acá. El plan del usuario no lo permite. Siempre Gemini.

---

## Cuenta operativa Maps

`polejavetzky@eldesembarco.com` con admin en **4 fichas verificadas (piloto)**:

| Ficha | Store code |
|---|---|
| El Desembarco Jujuy | 11280071107343906057 |
| Mr Tasty Munro | 11332625730353158145 |
| Mr Tasty Resistencia | 13216106111290006902 |
| Mr Tasty San Fernando | 12927600106366812876 |

> Es un universo distinto al panel de facturas (`proyecto-facturas/` tiene otros 18 locales). NO mezclar.

---

## Política IA (decidida)

- **Aprobación humana SIEMPRE** — Gemini genera draft, CM revisa/edita/manda
- **Logs completos** por draft: `prompt + draft generado + acción CM (aprobó/editó/descartó) + draft final + timestamp`
- **Configurable a futuro** por marca/local/rating
- **Tono editable** desde admin: campo de texto con voice/tone por marca, inyectado en prompt

---

## APIs externas a habilitar

| API | Dónde | Allowlist? |
|---|---|---|
| My Business Account Management API | Google Cloud Console | No |
| My Business Business Information API | Google Cloud Console | No |
| Business Profile Performance API | Google Cloud Console | **Sí** ([form](https://developers.google.com/my-business/content/prereqs#request)) |
| Google My Business API legacy (Reviews) | Google Cloud Console | **Sí** (allowlist independiente) |
| Gemini API | Google AI Studio (`aistudio.google.com`) | No |

Quotas GBP: 10 QPS / 100k requests-día → sobra para 4 fichas.

---

## Modelo de datos

### Sheet "Maps Insights - El Desembarco" (creado con `crear-sheet-maps.gs`)

- **Locales**: maestro de fichas (store_code, place_id, location_name, dirección, etc)
- **Metricas**: long-format, 1 fila por local×día×métrica
- **Reviews**: snapshot del último scrape con respuestas
- **Snapshot**: vista agregada para el front (recalculada por n8n cada noche)
- **RespuestasIA** (a sumar): logs de drafts y acciones CM

### DB Postgres (Prisma) — solo lo que NO tiene sentido en Sheet

- `User` — login del CM
- `ResponseLog` — log de cada draft IA (prompt, draft, accion, final, timestamp)
- `BrandTone` — tono/voice editable por marca
- `Alert` — alertas activas (sentiment, caída de vistas)

> Los datos crudos viven en el Sheet (fácil de inspeccionar manualmente). La DB solo guarda lo que requiere transacciones o consultas relacionales.

---

## Estructura de rutas (App Router)

```
src/app/
├── layout.tsx                  ← root
├── page.tsx                    ← landing / login redirect
├── login/
│   └── page.tsx
├── (dashboard)/                ← grupo autenticado
│   ├── layout.tsx              ← sidebar + header
│   ├── page.tsx                ← dashboard home (KPIs)
│   ├── inbox/
│   │   └── page.tsx            ← cola de reviews + drafts IA
│   ├── reviews/
│   │   ├── page.tsx            ← histórico de reviews
│   │   └── [id]/page.tsx       ← detalle + responder
│   ├── metricas/
│   │   └── page.tsx            ← vistas/llamadas/direcciones
│   └── admin/
│       ├── page.tsx            ← settings
│       ├── locales/page.tsx    ← gestión de fichas
│       └── tonos/page.tsx      ← editar voice/tone por marca
└── api/
    ├── webhooks/n8n/           ← cuando n8n popula data
    └── gemini/draft/           ← endpoint para generar draft on-demand
```

---

## Etapas

| Etapa | Quien | Status |
|---|---|---|
| 🟢 0a · Scaffold Next.js | USER | ✅ hecho |
| 🟢 0b · Crear API key Gemini en AI Studio | USER | ⏳ |
| 🟢 0c · Habilitar APIs Google + allowlist GBP | USER | ⏳ |
| 🟢 0d · Crear proyecto Vercel + crear DB Neon | USER | ⏳ |
| 🟡 1a · DB schema + libs | CLAUDE | en curso |
| 🟡 1b · Auth básica (NextAuth) | CLAUDE | pendiente |
| 🟡 1c · n8n discovery one-shot (popula `Locales` con place_id) | CLAUDE | pendiente |
| 🟠 2 · Ingesta diaria (n8n cron) reviews + performance | CLAUDE | pendiente |
| 🟣 3 · Inbox CM con drafts Gemini + responder | CLAUDE | pendiente |
| 🔵 4 · Tab Métricas marketing | CLAUDE | pendiente |
| 🟤 5 · Alertas (sentiment, picos negativos, caídas) | CLAUDE | pendiente |
| ⚫ 6 · Deploy Vercel | USER + CLAUDE | pendiente |

---

## Limitaciones conocidas

- Histórico GBP máximo: **18 meses**
- No hay datos demográficos del visitante en Performance API
- Reviews API requiere allowlist independiente (más estricto)
- Métricas tardan ~2-3 días en estabilizarse (no pidas datos de "hoy")
- Quotas Gemini gratuitas: ~15 RPM en Flash (suficiente para drafts on-demand del piloto)

---

## Endpoints externos de referencia

| Operación | URL |
|---|---|
| Listar cuentas GBP | `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` |
| Listar locales | `GET https://mybusinessbusinessinformation.googleapis.com/v1/{parent=accounts/*}/locations` |
| Métricas multi-daily | `GET https://businessprofileperformance.googleapis.com/v1/{name=locations/*}:fetchMultiDailyMetricsTimeSeries` |
| Listar reviews | `GET https://mybusiness.googleapis.com/v4/{parent=accounts/*/locations/*}/reviews` |
| Responder review | `PUT https://mybusiness.googleapis.com/v4/{name}/reply` |
| Gemini generate | `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` |

---

## Cosas que NO hacer

- No clonar ni tocar `desembarco-dashboard/` (está en produ)
- No mezclar el universo de fichas con el panel de facturas (universos distintos)
- No usar Anthropic SDK
- No deployar respuestas auto sin pasar por aprobación humana
