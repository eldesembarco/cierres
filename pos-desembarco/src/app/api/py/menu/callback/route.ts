/**
 * POST /api/py/menu/callback
 *
 * Endpoint que PY llama cuando termina de procesar un catalog import.
 * Por ahora solo loggeamos. Más adelante: persistir el resultado en DB y
 * mostrar en /admin/menu el estado del último import.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkInboundAuth } from "@/lib/py/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = checkInboundAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  console.log("[py:menu:callback]", JSON.stringify(body)?.slice(0, 500));
  return NextResponse.json({ ok: true });
}
