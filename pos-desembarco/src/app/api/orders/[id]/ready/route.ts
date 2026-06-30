import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/py/store";
import { markPreparationCompleted } from "@/lib/py/client";
import { readyForPickup } from "@/lib/rappi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const store = getStore();
  const order = await store.get(id);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (order.state !== "accepted" && order.state !== "preparing") {
    return NextResponse.json({ error: "invalid_state", current: order.state }, { status: 409 });
  }

  try {
    if (order.app === "pedidosya") {
      const result = await markPreparationCompleted(
        order.pyToken,
        order.raw.callbackUrls?.preparationCompletedUrl
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: "remote_rejected", status: result.status, data: result.data },
          { status: 502 }
        );
      }
    } else {
      const result = await readyForPickup(order.countryDomain, order.rappiOrderId);
      if (!result.ok) {
        return NextResponse.json(
          { error: "remote_rejected", status: result.status, data: result.data },
          { status: 502 }
        );
      }
    }
    const updated = await store.patch(id, { state: "ready" });
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "remote_call_failed", message: msg }, { status: 502 });
  }
}
