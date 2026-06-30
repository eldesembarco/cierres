<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Desembarco LucIA · Agent context

Read [PLAN.md](./PLAN.md) first for full project context.

## Quick context

- Panel CM/Marketing para El Desembarco / Mr Tasty / Mila & Go.
- Integra Google Business Profile (reviews + Performance API) con IA (Gemini) para drafts de respuesta.
- Parte 2 (Meta — FB+IG) está postpuesta hasta que el user configure Business Manager.
- **Universo de fichas**: 4 piloto (1 Desembarco, 3 Mr Tasty). NO mezclar con `proyecto-facturas/` que tiene otros 18 locales distintos.
- **Existe `desembarco-dashboard/` en produ** (Next 16 + Vercel + Neon). Es OTRO proyecto distinto. NO tocar.

## Hard rules

- **NUNCA usar Anthropic SDK / Claude.** El plan del usuario no lo permite. Toda la IA va por Gemini (`@google/generative-ai`).
- **NUNCA mandar respuestas auto a reviews sin aprobación humana.** El producto es CM-assist, no CM-replace.
- **Logs completos de cada draft IA** en `ResponseLog` (prompt + draft + acción CM + final + timestamp).
- **NO clonar ni tocar `desembarco-dashboard/`** (está en produ, otro propósito).

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 + TS + App Router |
| UI | Tailwind CSS 4 |
| DB | Neon Postgres + Prisma 5 |
| IA | Gemini 2.5 Flash (drafts) / Pro (análisis) |
| Sheets | papaparse + CSV export |
| Ingesta | n8n self-hosted |
| Deploy | Vercel (proyecto separado) |

## Estructura

```
src/
├── app/
│   ├── layout.tsx                       ← root
│   ├── page.tsx                         ← landing
│   ├── login/page.tsx                   ← placeholder auth
│   └── dashboard/
│       ├── layout.tsx                   ← sidebar + main
│       ├── page.tsx                     ← KPIs (lee Snapshot)
│       ├── inbox/page.tsx               ← reviews pendientes
│       ├── reviews/page.tsx             ← histórico
│       ├── metricas/page.tsx            ← timeseries
│       └── admin/page.tsx               ← settings
├── lib/
│   ├── prisma.ts                        ← cliente DB
│   ├── gemini.ts                        ← drafts + análisis
│   ├── sheets.ts                        ← lectura Sheet "Maps Insights"
│   └── gbp.ts                           ← Business Profile API client
└── ...
prisma/
└── schema.prisma                        ← User, BrandTone, ResponseLog, Alert
```

## Etapas (estado)

Ver checklist en [PLAN.md § Etapas](./PLAN.md#etapas).

## Convenciones

- Server components por default; `"use client"` solo cuando hace falta state/handlers
- Server Actions con `"use server"` para mutaciones (drafts, replies)
- Lectura de Sheets con `unstable_cache` o `revalidate` por route
- Datos crudos viven en el Sheet; la DB solo guarda lo que requiere transacciones (logs IA, alertas, users)
