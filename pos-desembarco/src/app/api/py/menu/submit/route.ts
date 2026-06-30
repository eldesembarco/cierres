/**
 * POST /api/py/menu/submit
 *
 * Buildea el catálogo desde nuestra data interna y lo pushea al middleware de PY.
 * Si no hay creds → modo simulación (devuelve OK con el catálogo que se HABRÍA enviado).
 *
 * Body opcional:
 *   { vendor?: string, callback?: string, chainCode?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { productos, categorias } from "@/lib/data";
import { buildCatalog, filterDeliveryProductos } from "@/lib/py/catalog/builder";
import { submitCatalog } from "@/lib/py/catalog/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    vendor?: string;
    callback?: string;
    chainCode?: string;
  };

  const url = new URL(req.url);
  const vendor = body.vendor ?? process.env.PY_REMOTE_ID ?? "POS_DESEMBARCO_TEST";
  const chainCode = body.chainCode ?? process.env.PY_CHAIN_CODE ?? "EL_DESEMBARCO";
  const callbackUrl = body.callback ?? `${url.origin}/api/py/menu/callback`;

  const built = buildCatalog(filterDeliveryProductos(productos), categorias, {
    vendors: [vendor],
    callbackUrl,
  });

  try {
    const res = await submitCatalog(chainCode, built.catalog);
    if (!res.ok) {
      return NextResponse.json(
        { error: "submit_failed", status: res.status, data: res.data },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      simulated: !!res.simulated,
      stats: built.stats,
      warnings: built.warnings,
      remoteResponse: res.data,
      catalogId: built.catalog.catalogId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "exception", message: msg }, { status: 500 });
  }
}
