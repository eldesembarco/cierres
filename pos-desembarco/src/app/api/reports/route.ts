/**
 * GET /api/reports?from=<ms>&to=<ms>
 *
 * Devuelve TODAS las agregaciones de un rango en un solo round trip:
 * KPIs, ventas por hora, por canal, top productos, métodos de pago.
 *
 * Si no se mandan from/to, default = últimas 24 horas.
 * Modo postgres si POSTGRES_URL está configurado, sino memory.
 */
import { NextRequest, NextResponse } from "next/server";
import { kpis, byHour, byChannel, topProducts, byPayment } from "@/lib/reports/queries";
import { hasPostgres } from "@/lib/py/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const now = Date.now();
  const range = {
    fromMs: from ? Number(from) : now - 24 * 60 * 60 * 1000,
    toMs: to ? Number(to) : now,
  };

  if (Number.isNaN(range.fromMs) || Number.isNaN(range.toMs)) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }

  try {
    const [k, h, c, t, p] = await Promise.all([
      kpis(range),
      byHour(range),
      byChannel(range),
      topProducts(range, 10),
      byPayment(range),
    ]);
    return NextResponse.json({
      mode: hasPostgres() ? "postgres" : "memory",
      range,
      kpis: k,
      byHour: h,
      byChannel: c,
      topProducts: t,
      byPayment: p,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "query_failed", message: msg }, { status: 500 });
  }
}
