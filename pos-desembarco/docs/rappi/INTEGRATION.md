# Integración Rappi (Restaurants Public API)

POS El Desembarco se integra al API de Rappi para Restaurantes vía OAuth2 client_credentials + webhooks firmados con HMAC-SHA256.

> **No es self-service**. Aunque Rappi llama "self-onboarding" al portal, la doc oficial dice claramente que un Technical Account Manager (TAM) debe crear la entidad `Integration` y el `clientId` en Auth0 *antes* de que podamos hacer cualquier cosa programáticamente.

## Cómo conseguir el TAM

Tres caminos:

1. **Si ya operás en Rappi como restaurante** — pedile al ejecutivo de cuenta comercial que te conecte con el TAM
2. **Si no estás en Rappi todavía** — `partners@rappi.com` o el formulario de "Sé Partner" en https://partners.rappi.com (varía por país)
3. **Atajo argentino** — abrir caso por panel de partners pidiendo "integración API directa con TAM"

Cuando obtengas:

```
client_id     = <viene del TAM, lo registra en Auth0>
client_secret = <idem>
webhook_secret = <para validar la firma de los webhooks de Rappi>
store_id      = <ID que Rappi asigna a la sucursal>
```

## Diferencias clave con PedidosYa

| | PedidosYa | Rappi |
|---|---|---|
| Auth outbound | JWT username/password | OAuth2 `client_credentials` |
| Header auth | `Authorization: Bearer …` | **`x-authorization: Bearer …`** (no estándar) |
| Token TTL | indefinido | 1 semana |
| Auth inbound | Bearer secret simple | HMAC-SHA256 con `Rappi-Signature: t=…,sign=…` |
| Webhook events | 1 (Dispatch Order) + status | 9 eventos |
| Timeout aceptar/rechazar | varía | **6 minutos exactos** |
| Endpoints aceptar/listo | `/v2/order/status/{token}` | `/orders/{id}/take/{cookingTime}`, `/reject`, `/ready-for-pickup` |
| Domain AR (prod) | n/a | `https://services.rappi.com.ar` |

## Endpoints expuestos (los que Rappi llama)

| Método | Path | Descripción |
|---|---|---|
| GET | `/api/rappi/health` | Health check (sin auth) |
| POST | `/api/rappi/webhook` | Único endpoint para todos los 9 eventos. Switch interno por `event` |

## Endpoints del API de Rappi que llamamos

| Método | Path | Cuándo |
|---|---|---|
| POST | `/restaurants/auth/v1/token/login/integrations` | Para obtener access_token (cacheado, refresh anticipado a los 6.5 días) |
| PUT | `/api/v2/restaurants-integrations-public-api/orders/{id}/take/{cookingTime}` | Aceptar pedido |
| PUT | `/api/v2/restaurants-integrations-public-api/orders/{id}/reject` | Rechazar (con cuidado — abuso deshabilita la tienda) |
| POST | `/api/v2/restaurants-integrations-public-api/orders/{id}/ready-for-pickup` | Listo para retirar |
| GET | `/api/v2/restaurants-integrations-public-api/orders` | Fallback si el webhook falla (transición de READY → SENT como side effect) |

## Eventos webhook que recibimos

| Evento | Acción |
|---|---|
| `NEW_ORDER` | Persistimos el pedido en `received` |
| `ORDER_EVENT_CANCEL` | Marcamos `cancelled` localmente |
| `ORDER_OTHER_EVENT` | Lifecycle: `ready_for_pick_up`, `hand_to_domiciliary` (→ `picked_up`), `close_order` (→ `completed`) |
| `PING` | Liveness check — respondemos `{ status: "OK" }` |
| `MENU_APPROVED` / `MENU_REJECTED` | Log informativo |
| `STORE_CONNECTIVITY` | Log informativo |
| `ORDER_RT_TRACKING` | Log informativo (lat/lng del rider) |
| `STORE_PROVISIONING_STATUS` | Confirmación de alta |

## Verificación HMAC

Header: `Rappi-Signature: t=<unix-timestamp>,sign=<hmac-sha256-hex>`

Cálculo:
```
expected = hmac_sha256(secret, `${t}.${rawBody}`).hex()
```

`rawBody` debe ser exactamente como llegó (antes de cualquier `JSON.parse`). Replay protection: rechazamos timestamps con más de 5 minutos de delta.

## Variables de entorno

| Var | Descripción |
|---|---|
| `RAPPI_CLIENT_ID` | OAuth client_id del TAM |
| `RAPPI_CLIENT_SECRET` | OAuth client_secret |
| `RAPPI_WEBHOOK_SECRET` | Secret para verificar HMAC de los webhooks |
| `RAPPI_COUNTRY_DOMAIN` | Default `https://services.rappi.com.ar` |
| `RAPPI_USE_DEV` | `"true"` para usar el sandbox `microservices.dev.rappi.com` |
| `RAPPI_STORE_ID` | ID de la sucursal (usado por el simulador) |

## Setup paso a paso (post TAM)

### 1. Configurar env vars en Vercel

```bash
vercel env add RAPPI_CLIENT_ID production
vercel env add RAPPI_CLIENT_SECRET production
vercel env add RAPPI_WEBHOOK_SECRET production
vercel env add RAPPI_COUNTRY_DOMAIN production   # opcional, default services.rappi.com.ar
```

### 2. Pasarle al TAM

- Webhook URL: `https://pos-desembarco.vercel.app/api/rappi/webhook`
- Health URL:  `https://pos-desembarco.vercel.app/api/rappi/health`
- Eventos a habilitar: TODOS (NEW_ORDER es crítico, los demás son informativos pero útiles para auditoría)

### 3. Probar

```bash
# Health
curl https://pos-desembarco.vercel.app/api/rappi/health

# PING (con firma — usar un script para calcular el HMAC)
# Más fácil: dejar al TAM mandar el primer PING desde su lado.

# Modo simulación (sin firma, solo para QA local):
curl -X POST https://pos-desembarco.vercel.app/api/dev/simulate-rappi-order
```

### 4. Probar take/reject/ready

Una vez que llegue un NEW_ORDER real, abrir `/apps`, seleccionarlo (badge **LIVE**), y tocar Aceptar → debería disparar el call al middleware de Rappi.

## Flujo end-to-end documentado

```
1. Usuario hace pedido en app Rappi
   → Rappi:  POST /api/rappi/webhook
              { event: "NEW_ORDER", order_id: 123, store_id: 999, items: [...] }
              Rappi-Signature: t=1234567890,sign=abc...

   We      → verificar HMAC; persistir como received con id ED-XXXXXX; respond 200

2. UI poll /api/orders cada 4s → pedido aparece en /apps con badge LIVE (rosa para Rappi)

3. Operador toca "Aceptar" en /apps:
   We      → POST /v2/login (cache 1 semana) → access_token
   We      → PUT services.rappi.com.ar/api/v2/.../orders/123/take/25
              x-authorization: Bearer ...
   Rappi   → 200 { message: "Order successfully taken" }
   We      → store.patch(state="accepted")
   UI      → push al KDS → pedido aparece en /cocina con borde rojo (Rappi)

4. Cocina prepara, toca "Marcar listo" en /cocina o /apps:
   We      → POST .../orders/123/ready-for-pickup
   Rappi   → 200; notifica al rider

5. Rider llega y retira:
   Rappi   → POST /api/rappi/webhook  { event: "ORDER_OTHER_EVENT", event_name: "hand_to_domiciliary" }
   We      → state="picked_up"

6. Rappi   → POST /api/rappi/webhook  { event: "ORDER_OTHER_EVENT", event_name: "close_order" }
   We      → state="completed"
```

## Próximos pasos

- [ ] Conseguir TAM y credenciales
- [ ] Endpoints de provisioning de tiendas (`/v2/stores/integration-status`, `/provisioning`, `/deprovisioning`)
- [ ] Endpoint para subir el menú (Managing Menus)
- [ ] Manejo de timeouts: alarma a las 5 minutos si un pedido sigue en `received`
- [ ] Auto-disable check: monitorear los rejects para no entrar en penalización
- [ ] Soporte multi-store: hoy `RAPPI_COUNTRY_DOMAIN` es global; si tenemos sucursales en países distintos, cada `StoredOrder` ya guarda su `countryDomain`
