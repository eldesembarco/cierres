/**
 * GET /api/py/menu/preview
 *
 * Devuelve el JSON del catálogo que se subiría a PY (sin hacer la submit real).
 * Útil para QA / inspección antes de pushear.
 */
import { NextResponse } from "next/server";
import { productos, categorias } from "@/lib/data";
import { buildCatalog, filterDeliveryProductos } from "@/lib/py/catalog/builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const callbackUrl = url.searchParams.get("callback") ??
    `${url.origin}/api/py/menu/callback`;
  const vendor = url.searchParams.get("vendor") ??
    process.env.PY_REMOTE_ID ??
    "POS_DESEMBARCO_TEST";

  const result = buildCatalog(filterDeliveryProductos(productos), categorias, {
    vendors: [vendor],
    callbackUrl,
  });

  return NextResponse.json({
    stats: result.stats,
    warnings: result.warnings,
    catalog: result.catalog,
  });
}
