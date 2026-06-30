# Monitor Servicios

Panel ultra-simple para ver si servicios externos están UP/DOWN. Sin backend propio, sin DB.

## Cómo usar

Abrí `index.html` en el navegador (doble click o arrastrá al browser). Eso es todo.

- Pollea cada 30s al webhook n8n
- Muestra UP en verde / DOWN en rojo (a tamaño desproporcionado, a propósito)
- Muestra latencia y hora del último chequeo

## Stack

- **Front**: HTML estático único (sin build, sin deps). `index.html`.
- **Back**: workflow n8n `Monitor Servicios - GET /monitor` (id `bIv2puKaLkx6rmo4`).
  - Webhook público: `https://n8n.srv1312396.hstgr.cloud/webhook/monitor`
  - Hace fetch GET con timeout 8s a cada servicio configurado
  - Cualquier respuesta < 500 = UP (incluye 401/403/404 — la máquina respondió)
  - Timeout / DNS fail / connection refused = DOWN
  - Devuelve `{ok, checked_at, all_up, services: [{name, url, up, status, latency_ms, error}]}`
  - CORS `*` para que cualquier front lo consuma

## Agregar servicios

Editá el array `services` en el nodo "Chequear Servicios" del workflow. Ejemplo:

```js
const services = [
  { name: 'Servidor Desembarco (sytes.net)', url: 'http://desembarco.sytes.net/' },
  { name: 'API Facturas', url: 'https://n8n.srv1312396.hstgr.cloud/healthz' },
];
```

El front muestra hoy sólo el primero (status gigante). Para varios servicios habría que iterar `data.services` y renderizar tarjetas — siguiente versión.

## Deploy a Vercel (opcional)

Si querés URL pública para abrir desde el celular:
```
cd monitor-servicios
vercel deploy --prod
```

## TODOs futuros

- v2: cron que escribe historial a Sheets, gráfico de uptime últimas 24h
- v2: alerta Telegram/email cuando cae
- v2: soportar N servicios en el front (grid de tarjetas)
