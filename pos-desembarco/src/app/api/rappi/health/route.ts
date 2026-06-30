/**
 * Health check para Rappi. Sin auth.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "pos-desembarco",
    integration: "rappi",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
