/**
 * Health check para que PedidosYa pueda verificar que el plugin está vivo y con SSL.
 * Sin auth — es solo un ping. Devuelve metadata útil para debugging.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pos-desembarco",
    integration: "delivery-hero-py",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
