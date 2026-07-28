# WA Requerimientos → Trello

Sistema punta a punta: requerimientos que llegan por **WhatsApp** se convierten
automáticamente en **tickets de Trello**, clasificados con IA (Gemini).

## Cómo se usa (para humanos)

En **cualquier chat** de WhatsApp (grupo o directo del número vinculado), mandar
un mensaje que empiece con `#req`, `#ticket` o `#requerimiento`:

```
#req Se rompió la freidora chica de Palermo, pierde aceite. Urgente
```

- Puede ir **con foto** (equipo roto, pantalla de error): se adjunta a la card
  y Gemini la usa de contexto.
- Los mensajes propios (Pablo) también generan ticket (FORWARD_SELF=true).
- El resto de los mensajes se descarta silenciosamente en n8n.

La card sale en el board **Requerimientos** → lista **Entrantes**, con:
`🔴/🟡/🟢 [Local] Título` + descripción redactada + solicitante/chat/categoría.

## Arquitectura

```
WhatsApp ── bridge Go local (whatsapp-mcp-vgp, tarea "WhatsAppBridge")
                │  POST cada mensaje/reacción (header X-Bridge-Token)
                ▼
n8n (n8n.srv1312396.hstgr.cloud) workflow "WA Requerimientos → Trello"  [G3YDTzNlb8i1x1Z4]
   Webhook /webhook/wa-requerimientos
   → Filtrar y Normalizar (token + router: ticket | continuacion | reaccion + dedupe)
   ├─ ticket:       Gemini (Vertex) → card Trello + adjunto → confirmación ✅ por WhatsApp
   ├─ continuacion: foto suelta <5min del último ticket del remitente
   │                → se ADJUNTA a esa card + aviso 📎 con opción 👎
   └─ reaccion 👎:  (ventana 15min) mueve la foto a un ticket NUEVO
                    (baja adjunto, crea card vía Gemini vision, borra el viejo)

Salida WhatsApp (confirmaciones/avisos):
   workflow inserta filas en Data Table `wa_outbox` (W7rPitDcioXfqBfb, append-only)
   → poller local "WhatsAppOutbox" (wa-outbox-poller.ps1, cada 5s, puntero en
     bridge/outbox-lastid.txt) → bridge /api/send → WhatsApp
```

Reglas de UX:
- Grupo SOPORTE SISTEMAS: todo mensaje = ticket. Otros chats: prefijo `#req`.
- Foto + texto en el MISMO mensaje (caption) = un solo ticket con adjunto.
- Foto suelta hasta 5 min después de tu ticket = se adjunta a ese ticket; el
  bot avisa y con reaccionar 👎 a la foto se separa en ticket propio.
- Toda card creada se confirma en el chat con el link de Trello.

## Workflow 2: Trello Sync (mesa de ayuda + resueltos)

Workflow `LHbJVS18ZULzqToG` — cron cada 1 min (ejecuciones exitosas NO se
guardan; errores sí). Flujo operado por Pablo arrastrando cards:

- Card en **"Enviar a Mesa Tango"** → email a `mesadeayuda@seincomp.com.ar`
  (Seincomp) con el requerimiento + TODOS los adjuntos, **desde
  `lrecchini@eldesembarco.com`** (cred OAuth `f1LNQxtkdbexNoiC` "Gmail account 3"),
  la card pasa a **"Enviado a mesa de ayuda"** con comentario 📧 de auditoría.
- Card en **"Enviar a Mesa Ayres IT"** → mismo circuito. ⚠️ PENDIENTE: casilla
  real de Ayres IT — hoy apunta a `polejavetzky@eldesembarco.com` (placeholder).
  Cambiar en el mapa `MESAS` del nodo `Preparar Email`.
- Card en **"Resuelto"** → notifica ✅ por WhatsApp al chat de origen (parsea
  `**Chat:**` de la descripción; cards manuales sin ese campo no notifican),
  comenta 🔔 en la card. Dedupe de notificaciones en staticData (`notified`).

## Workflow 3: Respuestas de mesa de ayuda

Workflow `JPYTBT00v78HcBsB` — Gmail Trigger (cada 1 min) sobre la bandeja de
**lrecchini@eldesembarco.com**: query `(from:seincomp.com.ar OR subject:"[El
Desembarco]") -from:lrecchini@...`. Por cada respuesta: busca el link
`trello.com/c/XXX` en el cuerpo (viene de la "Referencia interna" del mail
original), detecta el nro de ticket (`ticket|caso|#NNN`) y **comenta la card**
(🎫 + remitente + asunto + resumen). La respuesta queda naturalmente en la
bandeja de Luciano (ya no hay reenvío).

## Identidad de correo (lrecchini@eldesembarco.com)

- Los mails salen y las respuestas se leen con la credencial OAuth
  **"Gmail account 3"** (`f1LNQxtkdbexNoiC`), cuenta `lrecchini@eldesembarco.com`.
- Infra Google detrás: proyecto GCP **n8n-mail-desembarco** (bajo la cuenta
  lrecchini, org eldesembarco.com), Gmail API habilitada, consent screen
  interna "n8n Desembarco", cliente OAuth "n8n lrecchini" con redirect
  `https://n8n.srv1312396.hstgr.cloud/rest/oauth2-credential/callback`.
- Usuario n8n **lrecchini@eldesembarco.com** (member) creado vía invite API;
  la credencial se creó bajo ese usuario y se transfirió al proyecto
  "Sistemas Desembarco" vía `PUT /api/v1/credentials/:id/transfer`.
- Gotcha: el panel de navegador de Claude bloquea popups → el flujo "Sign in
  with Google" se resolvió interceptando `window.open` y navegando la URL de
  consentimiento en la misma pestaña. NO navegar a mano `/rest/...` de n8n
  logueado: invalida la sesión del UI.

Columnas del board: Entrantes → En curso → Enviar a Mesa Tango → Enviar a Mesa
Ayres IT → Enviado a mesa de ayuda → Resuelto.
IDs listas: Tango `6a689b2b078eec227dc02ea5`, Ayres `6a689bcabc131c785ef97206`,
Enviado `6a689b2c92e20b65c9e467c0`, Resuelto `6a688f083afd2addaf2f570e`.

## IDs / referencias

| Qué | Valor |
|---|---|
| Workflow n8n | `G3YDTzNlb8i1x1Z4` (activo) |
| Webhook | `POST https://n8n.srv1312396.hstgr.cloud/webhook/wa-requerimientos` |
| Board Trello "Requerimientos" | `6a688f05702942bef18337d2` · https://trello.com/b/CV7Shf3A |
| Lista Entrantes | `6a688f0999af992e29aedfc4` |
| Lista En curso | `6a688f08659493dcbea04372` |
| Lista Hecho | `6a688f083afd2addaf2f570e` |
| Credencial Trello en n8n | `MUcIdiWUZ1Vhdf2h` (cuenta **gabrielasosa20** / Luciano Recchini) |
| Power-Up Trello | "WA Requerimientos n8n" (admin en trello.com/power-ups/admin de esa cuenta) |
| Bridge | `C:\Users\ferra\dev\whatsapp-mcp-vgp\whatsapp-bridge\whatsapp-bridge.exe` |
| Tarea programada | `WhatsAppBridge` (al logon, loop de reinicio) |
| Tarea poller salida | `WhatsAppOutbox` (al logon; `wa-outbox-poller.ps1`, log `bridge/outbox.log`) |
| Data Table outbox | `wa_outbox` = `W7rPitDcioXfqBfb` (API `/api/v1/data-tables/.../rows`) |
| Log bridge | `wa-requerimientos/bridge/bridge.log` |
| Token bridge | `whatsapp-bridge/store/.bridge-token` (mismo valor hardcodeado en nodo "Filtrar y Normalizar") |

## Configuración

- **Agregar un grupo "siempre ticket"** (todo mensaje del grupo genera card sin
  `#req`): editar el nodo `Filtrar y Normalizar` del workflow y agregar el JID
  del grupo al array `ALWAYS_CHATS`. Configurado: grupo **"SOPORTE SISTEMAS"**
  (`120363410062969047@g.us`).
- **Cambiar lista destino**: query param `idList` del nodo `Crear Card Trello`.
- **Prompt/categorías**: nodo `Armar Prompt Gemini`.

## Operación / troubleshooting

- **¿Llegan mensajes?** `bridge/bridge.log` debe mostrar `✓ Webhook sent for
  message from ...` por cada mensaje entrante.
- **Bridge caído**: la tarea `WhatsAppBridge` lo reinicia en loop (10s). Ver
  estado: `Get-ScheduledTask WhatsAppBridge`. Arranque manual:
  `Start-ScheduledTask WhatsAppBridge`.
- **WhatsApp deslogueado** (log dice "Device logged out, please scan QR"):
  regenerar QR y escanear:
  1. Reiniciar la tarea (para forzar QR fresco): `Stop-ScheduledTask WhatsAppBridge; Stop-Process -Name whatsapp-bridge -Force; Start-ScheduledTask WhatsAppBridge`
  2. `python bridge/qr_to_svg.py bridge/bridge.log bridge/qr-pairing.svg`
  3. Abrir el SVG y escanear desde WhatsApp → Dispositivos vinculados. El QR
     vence en ~60s; si venció, repetir (el bridge imprime uno nuevo por intento).
- **Ticket no salió**: revisar ejecuciones del workflow en n8n (se guardan
  todas). El dedupe puede descartar reintentos del mismo mensaje el mismo día.
- **Tickets duplicados tras reinicio de n8n**: el dedupe vive en staticData del
  workflow; se resetea al desactivar/activar. Riesgo bajo.

## Historia / decisiones

- Bridge: fork `whatsapp-mcp-vgp` con soporte de webhook saliente (push, sin
  polling). El MCP de WhatsApp de Claude lee la misma SQLite.
- Gemini vía Vertex AI con la credencial existente de Facturas (mismo patrón
  HTTP Request + responseSchema).
- La cuenta Trello es la de infraestructura (gabrielasosa20), no la personal de
  Pablo. Si los tickets deben verse desde otra cuenta, invitarla al board.
- Prueba E2E 2026-07-28: cards de prueba `TEST-E2E-001/002` (freidora Palermo,
  cartel Recoleta con adjunto) creadas OK.
- QA v2 2026-07-28 (3 casos, payloads simulados hacia el chat propio): (1) ticket
  texto + confirmación ✅ enviada; (2) foto suelta adjuntada al ticket previo +
  aviso 📎; (3) reacción 👎 movió la foto a card nueva (Gemini vision tituló
  desde la imagen) y la borró de la vieja. Cards QA archivadas.
- Gotcha QA: curl desde Bash/Windows destroza emojis inline (`👎`→`??`) — para
  simular reacciones usar `--data-binary @archivo`. El bridge real no sufre esto.

## Fase 2 (ideas)

- Confirmación automática por WhatsApp al solicitante (requiere túnel n8n→bridge
  local, patrón TangoBridge) o mail vía Gmail.
- Labels de Trello por categoría/prioridad (hoy va en título/desc).
- Grupo WhatsApp dedicado "Requerimientos" en ALWAYS_CHATS.
