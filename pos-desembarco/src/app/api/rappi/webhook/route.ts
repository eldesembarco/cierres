/**
 * Webhook receiver de Rappi.
 *
 *   POST /api/rappi/webhook
 *
 * Headers entrantes:
 *   Rappi-Signature: t=<timestamp>,sign=<hmac-sha256-hex>
 *   Content-Type: application/json
 *
 * El body trae un campo `event` que dispatchea por tipo:
 *  - NEW_ORDER                  → persistimos el pedido como received
 *  - ORDER_EVENT_CANCEL         → marcamos cancelled localmente
 *  - ORDER_OTHER_EVENT          → eventos del lifecycle (ready_for_pick_up, etc.)
 *  - PING                       → respondemos { status: "OK" }
 *  - MENU_APPROVED/REJECTED     → log (informativo)
 *  - STORE_CONNECTIVITY         → log (informativo)
 *  - ORDER_RT_TRACKING          → tracking del rider (lat/lng) — log por ahora
 *  - STORE_PROVISIONING_STATUS  → confirmación de alta de tienda
 *
 * Doc: https://dev-portal.rappi.com/es/webhook-events/
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore, newOrderId } from "@/lib/py/store";
import { verifyRappiSignature } from "@/lib/rappi/signature";
import type { RappiOrderRaw, RappiWebhookEvent } from "@/lib/rappi/types";
import type { StoredOrder } from "@/lib/py/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingBody {
  event?: RappiWebhookEvent;
  // Estos shapes varían según el event; los ignoramos a nivel TS
  [k: string]: unknown;
}

const COUNTRY_DOMAIN = process.env.RAPPI_COUNTRY_DOMAIN ?? "https://services.rappi.com.ar";

export async function POST(req: NextRequest) {
  // 1. Tomar el body como STRING crudo (necesario para validar firma — antes de parsear)
  const raw = await req.text();

  // 2. Verificar firma HMAC (si hay secret configurado; en dev sin secret bypassamos)
  const secret = process.env.RAPPI_WEBHOOK_SECRET ?? "";
  if (secret) {
    const sig = verifyRappiSignature(raw, req.headers.get("rappi-signature"), secret);
    if (!sig.ok) {
      console.warn(`[rappi:webhook] signature check failed: ${sig.reason}`);
      return NextResponse.json({ error: "unauthorized", reason: sig.reason }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "RAPPI_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  // 3. Parsear JSON
  let body: IncomingBody;
  try {
    body = JSON.parse(raw) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = body.event;
  if (!event) {
    return NextResponse.json({ error: "missing event field" }, { status: 400 });
  }

  // 4. Dispatch por tipo
  switch (event) {
    case "PING": {
      // Liveness check de Rappi
      return NextResponse.json({ status: "OK", description: "pos-desembarco alive" });
    }

    case "NEW_ORDER": {
      return handleNewOrder(body);
    }

    case "ORDER_EVENT_CANCEL": {
      return handleOrderCancel(body);
    }

    case "ORDER_OTHER_EVENT": {
      return handleOrderLifecycle(body);
    }

    case "ORDER_RT_TRACKING":
    case "MENU_APPROVED":
    case "MENU_REJECTED":
    case "STORE_CONNECTIVITY":
    case "STORE_PROVISIONING_STATUS":
      console.log(`[rappi:webhook] ${event}`, body);
      return NextResponse.json({ ok: true });

    default:
      console.warn(`[rappi:webhook] unknown event: ${event}`);
      return NextResponse.json({ ok: true, ignored: event });
  }
}

async function handleNewOrder(body: IncomingBody): Promise<NextResponse> {
  // El payload de NEW_ORDER es la misma data que getOrders. Lo modelamos como RappiOrderRaw.
  const raw = body as unknown as RappiOrderRaw;
  const orderId = String(raw.order_id ?? "");
  const storeId = String(raw.store_id ?? "");
  if (!orderId) {
    return NextResponse.json({ error: "missing order_id" }, { status: 400 });
  }

  const store = getStore();

  // Idempotency: si el mismo order_id ya está, devolvemos OK sin duplicar
  const existing = (await store.list()).find(
    (o) => o.app === "rappi" && o.rappiOrderId === orderId
  );
  if (existing) {
    console.log(`[rappi:webhook] NEW_ORDER duplicado ${orderId} → ${existing.id}`);
    return NextResponse.json({ ok: true, remoteOrderId: existing.id, duplicate: true });
  }

  const order: StoredOrder = {
    id: newOrderId(),
    app: "rappi",
    rappiOrderId: orderId,
    rappiStoreId: storeId,
    countryDomain: COUNTRY_DOMAIN,
    pyCode: orderId.slice(-8),
    remoteId: storeId || "DESEMBARCO_DEFAULT",
    state: "received",
    receivedAt: Date.now(),
    updatedAt: Date.now(),
    raw,
  };

  await store.put(order);
  console.log(`[rappi:webhook] NEW_ORDER ${orderId} (store=${storeId}) → ${order.id}`);

  return NextResponse.json({ ok: true, remoteOrderId: order.id });
}

async function handleOrderCancel(body: IncomingBody): Promise<NextResponse> {
  const orderId = String((body.order_id as string | number | undefined) ?? "");
  if (!orderId) return NextResponse.json({ error: "missing order_id" }, { status: 400 });

  const store = getStore();
  const all = await store.list();
  const local = all.find((o) => o.app === "rappi" && o.rappiOrderId === orderId);
  if (!local) {
    console.warn(`[rappi:webhook] cancel para order desconocido: ${orderId}`);
    return NextResponse.json({ ok: true, ignored: "not_found" });
  }

  const cancelEvent = String(body.event ?? body.cancel_reason ?? "");
  await store.patch(local.id, {
    state: "cancelled",
    rejectionReason: `rappi:${cancelEvent || "cancelled"}`,
  });
  console.log(`[rappi:webhook] cancel ${orderId} (${cancelEvent})`);
  return NextResponse.json({ ok: true });
}

async function handleOrderLifecycle(body: IncomingBody): Promise<NextResponse> {
  const orderId = String((body.order_id as string | number | undefined) ?? "");
  const subEvent = String(body.event_name ?? body.event ?? "");
  if (!orderId) return NextResponse.json({ error: "missing order_id" }, { status: 400 });

  const store = getStore();
  const local = (await store.list()).find(
    (o) => o.app === "rappi" && o.rappiOrderId === orderId
  );
  if (!local) {
    return NextResponse.json({ ok: true, ignored: "not_found" });
  }

  // Mapping: hand_to_domiciliary → picked_up; close_order → completed
  let nextState = local.state;
  if (subEvent === "hand_to_domiciliary") nextState = "picked_up";
  else if (subEvent === "close_order") nextState = "completed";
  else if (subEvent === "ready_for_pick_up") nextState = "ready";

  if (nextState !== local.state) {
    await store.patch(local.id, { state: nextState });
    console.log(`[rappi:webhook] lifecycle ${orderId}: ${subEvent} → ${nextState}`);
  }
  return NextResponse.json({ ok: true });
}
