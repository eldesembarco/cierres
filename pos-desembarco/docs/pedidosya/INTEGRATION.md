# Integración PedidosYa / Delivery Hero

POS El Desembarco implementa el **flujo directo** del Plugin API de Delivery Hero. El Cocina KDS y la pantalla Apps tienen control completo sobre aceptar / rechazar / marcar listo / despachar.

## Arquitectura

```
PedidosYa stg/prod                  POS El Desembarco
─────────────────                   ─────────────────
                                                          ┌──── /apps (UI)
                                                          ↓        polling 4s
                                                       ┌─────────┐
   ─── POST /order/{rid} ───►  /api/py/order/[rid] ──► │  store  │ ◄── /cocina
                                                       │ in-mem  │
   ◄── POST /v2/login ────       lib/py/client.ts  ──► └─────────┘
   ◄── POST /v2/order/                ▲
        status/{token} ──             │ las acciones de la UI
                                      └── llaman al middleware
```

### Endpoints que NOSOTROS exponemos (Plugin API)

PedidosYa va a llamar estos. Todos requieren `Authorization: Bearer <token>` excepto health.

| Método | Path | Operación |
|---|---|---|
| GET | `/api/py/health` | Health check (sin auth) |
| POST | `/api/py/order/[remoteId]` | Dispatch Order — recibimos pedido nuevo |
| PUT | `/api/py/order/[remoteId]/[remoteOrderId]/status` | Status update (cancelaciones, picked_up) |
| _pending_ | `/api/py/availability/[remoteId]` | Vendor availability |
| _pending_ | `/api/py/menu/[remoteId]` | Trigger menu import |

### Endpoints del middleware que NOSOTROS llamamos

| Método | Path | Cuándo |
|---|---|---|
| POST | `/v2/login` | Para obtener JWT (cacheado, refresh automático) |
| POST | `/v2/order/status/{orderToken}` | Aceptar / rechazar pedido |
| POST | `/v2/orders/{orderToken}/preparation-completed` | Marcar como listo |

### Endpoints internos (UI ↔ server)

| Método | Path | Llamado por |
|---|---|---|
| GET | `/api/orders` | Polling de la pantalla `/apps` |
| DELETE | `/api/orders` | Botón "Limpiar" en `/apps` |
| POST | `/api/orders/[id]/accept` | Botón "Aceptar" |
| POST | `/api/orders/[id]/reject` | Botón "Rechazar" |
| POST | `/api/orders/[id]/ready` | Botón "Marcar listo" |
| POST | `/api/dev/simulate-py-order` | Botón "Simular pedido PY" |

## Variables de entorno

Configuralas en Vercel Dashboard → Project Settings → Environment Variables.

| Var | Descripción | Origen |
|---|---|---|
| `PY_INBOUND_SECRET` | Token Bearer que PY usa para llamarnos. Si está vacío en dev, los webhooks aceptan sin auth | Lo definimos nosotros y lo informamos a Marcos |
| `PY_USERNAME` | Username de la cuenta de plugin POS | Nos lo da Marcos |
| `PY_PASSWORD` | Password en claro (originalmente cifrado con la PGP) | Lo desciframos con la privada |
| `PY_REMOTE_ID` | ID del restaurant en nuestro sistema | Definido por nosotros, ej `POS_DESEMBARCO_TEST` |
| `PY_MIDDLEWARE_URL` | URL base del middleware. Default `https://integration-middleware.stg.restaurant-partners.com` | Cambiar a prod cuando salgamos vivos |

## Lo que tenés que mandarle a Marcos

### Datos generales

```
- PGP Key (RSA 1024) PÚBLICA: ver secrets/public-key.asc
- Webhook URL: https://pos-desembarco.vercel.app/api/py/order/{remoteId}
- Health URL:  https://pos-desembarco.vercel.app/api/py/health
- Email contacto emergencia: <COMPLETAR — sugerencia: polejavetzky@eldesembarco.com>
- Bearer secret PY_INBOUND_SECRET: <generar uno random fuerte y guardarlo>
```

### Datos del usuario de pruebas

```
Nombre:    <COMPLETAR>
Apellido:  <COMPLETAR>
País:      Argentina
Mail:      <COMPLETAR — Gmail real, no registrado en PY antes>
Teléfono:  <COMPLETAR — formato +5491155551234>
```

> El mail puede ser tuyo o uno de testing tipo `eldesembarco.qa@gmail.com`. Si querés usar uno de tu dominio (no Gmail), Marcos te pide que armes la GPG aparte; con la PGP que ya generamos alcanza.

## Setup paso a paso

### 1. Mandar la pública a Marcos

```bash
cat secrets/public-key.asc
```

Copiá el bloque entero (`-----BEGIN PGP PUBLIC KEY BLOCK-----` hasta el `-----END-----`) y respondele al mail con eso, los datos de contacto y el usuario de pruebas.

### 2. Recibir y descifrar el password

Marcos te va a mandar un archivo cifrado con tu pública. Para descifrar:

```bash
GNUPGHOME="secrets/.gnupg-py" gpg --decrypt password-cifrado.asc
```

### 3. Generar un Bearer secret para PY

```bash
openssl rand -hex 32
```

Guardalo. Va a `PY_INBOUND_SECRET` en Vercel y se lo mandás a Marcos.

### 4. Configurar env vars en Vercel

```bash
vercel env add PY_INBOUND_SECRET production
vercel env add PY_USERNAME production
vercel env add PY_PASSWORD production
vercel env add PY_REMOTE_ID production
```

O desde el dashboard. Después redeploy.

### 5. Probar

```bash
# Health (sin auth)
curl https://pos-desembarco.vercel.app/api/py/health

# Dispatch order de prueba (con auth)
curl -X POST https://pos-desembarco.vercel.app/api/py/order/POS_DESEMBARCO_TEST \
  -H "Authorization: Bearer $PY_INBOUND_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"token":"TEST-001","code":"PY-9999","expeditionType":"delivery","products":[{"name":"Bajoncito","quantity":"1","paidPrice":"14000"}]}'
```

Después abrís `/apps` y ves el pedido con badge **LIVE**. Aceptarlo dispara la llamada al middleware.

## Modo simulación (sin PY)

Para demo / QA sin webhook real configurado:

1. Abrís `/apps`
2. Click **"Simular pedido PY"** arriba a la derecha
3. El endpoint `/api/dev/simulate-py-order` inserta un pedido al store con datos al azar (Bajoncito + papas + cerveza, cliente random, etc)
4. El pedido aparece como **LIVE** y podés probar aceptar / listo / etc

> Al aceptar un pedido simulado, el cliente intenta llamar al middleware real. En staging eso falla porque no hay credenciales, pero el state local cambia igual y se pushea al KDS. Para tests end-to-end con middleware real, configurar `PY_USERNAME` / `PY_PASSWORD` y deshabilitar `simulate` (porque el `pyToken` simulado no es real).

## Próximos pasos

- [ ] Setup de credenciales con Marcos
- [ ] Cambiar storage in-memory a Vercel KV (Upstash) para soportar múltiples instancias serverless
- [ ] Implementar webhook de availability (vendor open/close)
- [ ] Implementar trigger de menu import + endpoint de submit catalog
- [ ] Verificación JWT real (validar firma con pubkey de PY) en lugar del Bearer secret simple
- [ ] Out-of-stock product modification (`POST /v2/order/{token}/modifications/product`)
- [ ] Adjust preparation time UI

## Referencia rápida del flujo

```
1. PY  →  POST /api/py/order/POS_DESEMBARCO_TEST   (con Bearer)
              { token: "abc", code: "PY-1234", products: [...] }

   We  →  store.put(order) ; respond 200 { remoteOrderId: "ED-A1B2C3" }

2. UI  →  GET /api/orders                          (polling 4s)
              { orders: [...] }

3. UI click "Aceptar":
   UI  →  POST /api/orders/ED-A1B2C3/accept
              { prepTimeMin: 25 }

   We  →  POST /v2/login → JWT (cacheado)
   We  →  POST /v2/order/status/abc                (con Bearer JWT)
              { status: "order_accepted", remainingTimeInMinutes: 25 }

   We  →  store.patch("ED-A1B2C3", { state: "accepted" })
   We  →  respond 200 { ok: true, order }

4. PY (más tarde, cuando rider llega):
   PY  →  PUT /api/py/order/POS_DESEMBARCO_TEST/ED-A1B2C3/status
              { status: "order_picked_up" }
   We  →  store.patch(state="picked_up")
```
