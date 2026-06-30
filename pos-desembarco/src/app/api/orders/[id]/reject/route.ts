import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/py/store";
import { rejectOrder as rejectOrderPY, type RejectReason } from "@/lib/py/client";
import { rejectOrder as rejectOrderRappi } from "@/lib/rappi/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    reason?: RejectReason;
    message?: string;
  };
  const reason = body.reason ?? "OTHER";
  const message = body.message ?? "Rechazado por el restaurante";

  const store = getStore();
  const order = await store.get(id);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (order.state !== "received") {
    return NextResponse.json({ error: "invalid_state", current: order.state }, { status: 409 });
  }

  try {
    if (order.app === "pedidosya") {
      const result = await rejectOrderPY(
        order.pyToken,
        reason,
        message,
        order.raw.callbackUrls?.orderRejectedUrl
      );
      if (!result.ok) {
        return NextResponse.json(
          { error: "remote_rejected", status: result.status, data: result.data },
          { status: 502 }
        );
      }
    } else {
      const result = await rejectOrderRappi(order.countryDomain, order.rappiOrderId, message);
      if (!result.ok) {
        return NextResponse.json(
          { error: "remote_rejected", status: result.status, data: result.data },
          { status: 502 }
        );
      }
    }
    const updated = await store.patch(id, {
      state: "rejected",
      rejectionReason: `${reason}: ${message}`,
    });
    return NextResponse.json({ ok: true, order: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "remote_call_failed", message: msg }, { status: 502 });
  }
}
