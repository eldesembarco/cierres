/**
 * GET /api/admin/init-db
 *
 * Crea las tablas de orders + order_items en Postgres si todavía no existen.
 * Idempotente. Llamar una vez después de configurar POSTGRES_URL.
 */
import { NextResponse } from "next/server";
import { hasPostgres } from "@/lib/py/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasPostgres()) {
    return NextResponse.json(
      { ok: false, mode: "memory", message: "POSTGRES_URL not configured — running in-memory" },
      { status: 200 }
    );
  }
  try {
    const { ensureSchema } = await import("@/lib/db/schema");
    await ensureSchema();
    return NextResponse.json({ ok: true, mode: "postgres", message: "Schema ready" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
