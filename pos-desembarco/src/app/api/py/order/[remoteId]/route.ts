/**
 * Webhook: Dispatch Order
 *
 * Endpoint que PedidosYa / Delivery Hero llama para mandarnos un pedido nuevo.
 *   POST /api/py/order/{remoteId}
 *
 * Spec: https://integration-middleware.stg.restaurant-partners.com/apidocs/pos-plugin-api
 *       (operationId: "Dispatch Order")
 *
 * Comportamiento:
 *  1. Validamos auth (Bearer)
 *  2. Persistimos el pedido en estado `received` con un id interno (ED-XXXXXX)
 *  3. Devolvemos 200 con `remoteOrderId` para que PY pueda referenciarnos en updates futuros
 *  4. La aceptación / rechazo es ASÍNCRONA — la decide la pantalla /apps via callback
 *     a `POST /v2/order/status/{token}` del middleware de PY
 *
 * IMPORTANTE: tenemos que responder 200/202 en pocos segundos. Si no, PY reintenta hasta 10
 * veces con backoff (30s a 240s). Idempotency: usamos el `token` del payload como llave para
 * deduplicar; si llega dos veces el mismo token devolvemos el mismo remoteOrderId.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore, newOrderId } from "@/lib/py/store";
import { checkInboundAuth } from "@/lib/py/auth";
import type { PYOrderRaw, StoredOrder } from "@/lib/py/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ remoteId: string }> }
) {
  const { remoteId } = await ctx.params;

  // Auth
  const auth = checkInboundAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
  }

  // Body
  let payload: PYOrderRaw;
  try {
    payload = (await req.json()) as PYOrderRaw;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "JSON parse error" },
      { status: 400 }
    );
  }

  if (!payload || typeof payload !== "object" || !payload.token) {
    return NextResponse.json(
      { error: "invalid_request", message: "missing required field: token" },
      { status: 400 }
    );
  }

  const store = getStore();

  // Idempotency: si ya recibimos este token, devolvemos el mismo remoteOrderId
  const existing = await store.getByPyToken(payload.token);
  if (existing) {
    return NextResponse.json({ remoteOrderId: existing.id }, { status: 200 });
  }

  const order: StoredOrder = {
    id: newOrderId(),
    app: "pedidosya",
    pyCode: payload.code ?? payload.token.slice(0, 8),
    pyToken: payload.token,
    remoteId,
    state: "received",
    receivedAt: Date.now(),
    updatedAt: Date.now(),
    raw: payload,
  };

  await store.put(order);

  console.log(`[py:dispatch] Received order ${order.id} (token=${order.pyToken}) for remoteId=${remoteId}`);

  return NextResponse.json({ remoteOrderId: order.id }, { status: 200 });
}
