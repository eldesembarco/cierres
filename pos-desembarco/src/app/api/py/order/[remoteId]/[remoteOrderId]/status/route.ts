/**
 * Webhook: Update Order Status (de PY a nosotros)
 *
 *   PUT /api/py/order/{remoteId}/{remoteOrderId}/status
 *
 * PY usa este endpoint para avisarnos de cambios fuera de nuestro control:
 *  - cancelación por el cliente
 *  - cancelación automática (timeout)
 *  - rider asignado (auto-accepted en flujo indirecto)
 *  - order_picked_up (cuando es delivery propio del vendor confirmado por DH)
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/py/store";
import { checkInboundAuth } from "@/lib/py/auth";
import type { PYOrderStateLocal } from "@/lib/py/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusBody {
  status?: string;
  reason?: string;
}

const PY_TO_LOCAL: Record<string, PYOrderStateLocal> = {
  // según el spec del middleware: order_accepted | order_rejected | order_picked_up | cancelled
  cancelled: "cancelled",
  CANCELLED: "cancelled",
  picked_up: "picked_up",
  order_picked_up: "picked_up",
};

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ remoteId: string; remoteOrderId: string }> }
) {
  const { remoteOrderId } = await ctx.params;

  const auth = checkInboundAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: StatusBody;
  try {
    body = (await req.json()) as StatusBody;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const status = body.status ?? "";
  const localState = PY_TO_LOCAL[status];
  if (!localState) {
    console.warn(`[py:status-update] Unknown status "${status}" for order ${remoteOrderId}`);
    return NextResponse.json({ error: "unknown_status", status }, { status: 400 });
  }

  const store = getStore();
  const updated = await store.patch(remoteOrderId, {
    state: localState,
    rejectionReason: body.reason,
  });

  if (!updated) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  console.log(`[py:status-update] ${remoteOrderId} → ${localState}`);
  return NextResponse.json({ ok: true });
}
