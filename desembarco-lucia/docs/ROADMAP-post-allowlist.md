# Roadmap post-allowlist · Google Business Profile API

Doc de referencia: cuando Google apruebe el allowlist (caso `#3-8005000041197`), estas son las funcionalidades que se desbloquean y el orden en que las vamos a implementar.

## Estado actual de las APIs

| API | Estado actual | Qué bloquea |
|---|---|---|
| **My Business Account Management** | ⛔ Quota=0 | Listar accounts y locations del usuario |
| **My Business Business Information** | ⛔ Quota=0 | Leer/editar info de fichas (horarios, atributos, fotos) |
| **Business Profile Performance** | ⛔ Quota=0 | Métricas: vistas, búsquedas, llamadas, direcciones, clicks web |
| **My Business v4 (legacy)** | ⛔ Quota=0 | Reviews + responder a reviews |
| **Gemini API (vía AI Studio)** | ✅ funcionando | — (solo afecta drafts) |

Hoy todo eso devuelve `429 RATE_LIMIT_EXCEEDED · quota_limit_value: 0`.

## Qué se desbloquea con la aprobación

### 🟢 Inmediato (sin trabajo extra de código)

1. **`/api/gbp/discover` empieza a funcionar**
   - Lista los 4 locales del piloto con sus `placeId` y `location_name` reales
   - El smoke test que ya tenés en `src/app/api/gbp/discover/route.ts`
   - URL: https://desembarco-lucia.vercel.app/api/gbp/discover

2. **El botón "Enviar a Google"** del Inbox y del Dashboard funciona realmente
   - Hoy genera log `APPROVED` pero el GBP call falla
   - Después del allowlist, los `APPROVED` pasan a `SENT` y la review queda respondida en Google Maps

### 🟡 Etapa 1 (1-2 días de implementación)

3. **Workflow n8n de discovery** (one-shot)
   - Pega contra `listAccounts` + `listLocations`
   - Popula place_id, location_name, dirección, categoría en hoja `Locales`
   - Doc completa en `docs/n8n-discovery-workflow.md`

4. **Workflow n8n de ingesta diaria de reviews** (cron 03:30)
   - `accounts.locations.reviews.list` por cada local
   - Upsert por `review_id` en hoja `Reviews`
   - Detecta reviews nuevas → trigger webhook al Next para revalidar dashboard
   - Reemplaza el seed manual del dashboard de produ

5. **Cron de envío de aprobados a Google** (cron 04:00)
   - Pickea `ResponseLog` con `action = APPROVED` y `sentAt = null`
   - Llama `replyToReview()` por cada uno
   - Marca `action = SENT` cuando OK
   - Esto envía las auto-respuestas que el batch del classifier dejó pendientes

### 🟠 Etapa 2 (2-3 días)

6. **Métricas reales en `/dashboard/metricas`**
   - Cron diario 03:00 → `fetchMultiDailyMetricsTimeSeries` por cada local
   - 10 métricas: vistas Maps/Search, llamadas, direcciones, clicks web, conversaciones, bookings, food orders
   - Series temporales (hasta 18 meses históricos)
   - Hoja `Metricas` se llena automáticamente
   - Reemplaza el placeholder actual del tab "Métricas"

7. **Snapshot recalculado nocturno**
   - Cron 04:00 que recalcula la hoja `Snapshot`
   - El dashboard home pasa a leer de `Snapshot` (más rápido que recalcular on-the-fly cada request)
   - KPIs: rating promedio, reviews 30d, vistas 30d, llamadas 30d, comparativa mes vs mes

### 🟣 Etapa 3 (1 semana)

8. **Análisis batch con Gemini Pro**
   - `/dashboard/metricas` con tab "Análisis"
   - Toma las últimas 100 reviews por marca
   - Gemini Pro detecta:
     - Top 3 temas positivos recurrentes
     - Top 3 temas negativos recurrentes
     - Sentiment trend (mejorando/estable/empeorando)
     - Acciones sugeridas para el equipo operativo
   - Re-genera 1 vez por semana (o on-demand)

9. **Alertas tempranas**
   - Cron diario 04:30 detecta:
     - 3+ reviews ≤ 2★ del mismo tema esta semana
     - Caída de vistas >20% mes vs mes anterior
     - Reviews sin responder hace +24h
     - Variación abrupta de rating promedio
   - Crea registros en tabla `Alert`
   - Banner en dashboard home + (futuro) email/Telegram al CM

### 🔵 Etapa 4 (cuando crezca el piloto)

10. **Edición de fichas desde el panel**
    - Endpoint `accounts.locations.patch` para actualizar horarios, atributos, descripción
    - Útil para campañas de marketing que necesitan modificar info en bulk
    - UI en `/dashboard/admin/locales/[id]/edit`

11. **Posts y ofertas**
    - `accounts.locations.localPosts.create`
    - Publicar posts en el perfil de Maps (ofertas, novedades, eventos)
    - Calendario semanal de posts por marca

12. **Q&A management**
    - `accounts.locations.questions.list`
    - Cola separada para preguntas en Google
    - Drafts IA igual que con reviews

## Resumen de impacto

Hoy el panel **funciona como mockup ejecutable**: tiene la UI real, los providers IA reales, los datos de las 622 reviews scrapeadas (no de la API oficial).

Cuando llegue el allowlist:
- Se conecta a la fuente de verdad oficial de Google
- Ingesta automática diaria
- Métricas que hoy no existen
- Auto-respuestas reales (no solo aprobadas en DB)
- Análisis y alertas en producción

## Cómo consultar el estado del caso

Detalle en `docs/GBP-allowlist-status.md`. Resumen:

- **Caso ID**: `3-8005000041197`
- **Tiempo declarado**: 7-10 días hábiles
- **Cómo te enteras**:
  - Email a `polejavetzky@eldesembarco.com` (Google manda confirmación cuando aprueba/rechaza)
  - O probar `/api/gbp/discover` periódicamente — si pasa de 429 a 200, está aprobado
- **Si tarda más de 10 días**: hay un proceso de follow-up documentado
