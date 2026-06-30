# LucIA Extension · Auto-paste flow (v0.2)

## Cómo funciona el nuevo botón

En el popup de la extensión, cada borrador ahora tiene **3 botones**:

| Botón | Cuándo aparece | Acción |
|---|---|---|
| 📋 Copiar | siempre | Copia al portapapeles (flow viejo, sigue funcionando) |
| ✦ Auto-pegar (dorado) | reseña PENDING (1-4★ o 5★ con red flags) | Guarda en cola + abre Business Profile → pega solo + espera tu click en "Publicar" |
| 🚀 Auto-publicar (rojo) | reseña APPROVED (5★ positiva auto-aprobada) | Guarda en cola + abre Business Profile → pega + publica solo después de 2s |

## Flujo completo (5★ positiva)

1. Apify trae reseña → n8n → LucIA → DB
2. LucIA detecta 5★ positiva sin red flags → genera draft + estado `APPROVED`
3. Abrís la extensión → ves el botón rojo **🚀 Auto-publicar**
4. Click → se guarda en queue + abre nueva pestaña a `business.google.com/reviews`
5. El content script `business-auto.js` escanea el DOM, encuentra la reseña matcheada por nombre del reviewer
6. Resalta la card con borde dorado, clickea "Responder", pega el draft, espera 2s, clickea "Publicar"
7. Llama `/api/extension/mark-sent` → log queda como SENT en LucIA
8. Toast confirma `✓ Publicado · <reviewerName>`

## Flujo completo (1-4★ o pendiente)

Mismo que el anterior pero:
- El draft se pega automáticamente, pero **NO** se clickea Publicar
- El botón Publicar de Google queda resaltado con glow naranja pulsante
- Vos lo revisás (podés editarlo antes), click manual a Publicar
- LucIA detecta el click → mark-sent automático

## Matching: cómo une un draft con la reseña en pantalla

Clave compuesta: `${brand}::${reviewerName normalizado}::${rating}`

Si no matchea exacto, intenta variantes:
1. Mismo brand + nombre + rating
2. Mismo brand + nombre (sin rating)
3. Solo nombre + rating
4. Solo nombre (sin nada más)
5. Si solo hay 1 draft en cola, lo usa con cualquier reseña del DOM (último recurso)

Si Google no muestra el nombre exacto o cambió, el matching puede fallar. Abrir DevTools y mirar console.log `[lucia-auto]` para debug.

## Si Google cambia el DOM y deja de funcionar

Los selectores fragiles están en `business-auto.js`:

- `findReviewCards()` — qué cuenta como "review card"
- `findReplyButton()` — cómo encontrar el botón Responder
- `findPublishButton()` — cómo encontrar Publicar/Send
- `extractReviewerName()` — de dónde sacamos el nombre
- `extractRating()` — de dónde sacamos las estrellas
- `extractTextarea()` — dónde aparece el campo de texto

Cada uno tiene heurísticas con fallback. Si rompe, abrir DevTools en business.google.com, inspeccionar un review card real, y ajustar los selectores.

## Por qué este approach (vs API)

- ✅ No requiere GBP API approval
- ✅ El CM mantiene el control en el caso PENDING
- ✅ Auto-publish solo para 5★ ya pre-aprobadas por LucIA (bajo riesgo)
- ✅ Funciona desde la sesión del CM, no hace masive scraping
- ⚠️ Frágil si Google cambia DOM
- ⚠️ Solo funciona mientras el CM tiene Business Profile abierto en su navegador

## Seguridad

- Drafts viven en `chrome.storage.session` → se borran al cerrar Chrome
- No se envía nada a Google con tu cuenta sin tu intervención (auto-publish requiere que ya tengas Business Profile abierto y logueado)
- Si auto-publish va a hacer algo malo, tenés 2s para cerrar la pestaña/cancelar
