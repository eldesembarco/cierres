/**
 * Acepta un pedido PY: POST /api/orders/{id}/accept
 *
 * Flujo:
 *  1. Lee el pedido del store (debe estar en state `received`)
 *  2. Llama al middleware de PY: POST /v2/order/status/{token} con order_accepted
 *     (usando callbackUrls.orderAcceptedUrl si vino en el payload)
 *  3. Marca el pedido como `accepted` localmente
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/py/store";
import { acceptOrder as acceptOrderPY } from "@/lib/py/client";
import { takeOrder as takeOrderRappi } from "@/lib/rappi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = getStore();
  const order = await store.get(id);
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.state !== "received") {
    return NextResponse.json(
      { error: "invalid_state", current: order.state },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { prepTimeMin?: number };
  const prep = body.prepTimeMin ?? 25;

  try {
    if (order.app === "pedidosya") {
      const result = await acceptOrderPY(
        order.pyToken,
        order.raw.callbackUrls?.orderAcceptedUrl,
        prep
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: "remote_rejected", status: result.status, data: result.data },
          { status: 502 }
        );
      }
    } else {
      // Rappi
      const result = await takeOrderRappi(order.countryDomain, order.rappiOrderId, prep);
      if (!result.ok) {
        return NextResponse.json(
          { error: "remote_rejected", status: result.status, data: result.data },
          { status: 502 }
        );
      }
    }
    const updated = await store.patch(id, {
      state: "accepted",
      prepTimeMin: prep,
      acceptedAt: Date.now(),
    });
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "remote_call_failed", message: msg }, { status: 502 });
  }
}
