/**
 * PUT /api/py/menu/availability/{sku}
 *
 * Toggle on/off de un producto puntual (out-of-stock).
 * Body: { available: boolean, reason?: string }
 *
 * Para batch (varios SKUs a la vez), usar PUT /api/py/menu/availability con body { items: [...] }.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateAvailability } from "@/lib/py/catalog/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ sku: string }> }
) {
  const { sku } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    available?: boolean;
    reason?: "OUT_OF_STOCK" | "TEMPORARILY_UNAVAILABLE" | "OTHER";
  };

  if (typeof body.available !== "boolean") {
    return NextResponse.json({ error: "missing 'available' boolean" }, { status: 400 });
  }

  const chainCode = process.env.PY_CHAIN_CODE ?? "EL_DESEMBARCO";
  const vendor = process.env.PY_REMOTE_ID ?? "POS_DESEMBARCO_TEST";

  const res = await updateAvailability(chainCode, vendor, {
    items: [
      {
        remoteCode: sku,
        available: body.available,
        ...(body.reason && !body.available ? { reason: body.reason } : {}),
      },
    ],
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "availability_failed", status: res.status, data: res.data },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, simulated: !!res.simulated, sku, available: body.available });
}
