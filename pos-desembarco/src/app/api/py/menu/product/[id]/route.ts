/**
 * PUT /api/py/menu/product/{id}
 *
 * Modify product. id = nuestro SKU interno (ej "130001"); internamente lo
 * convertimos al productId determinístico (ej "ed-prod-130001").
 *
 * Body soporta: { newPrice?, name?, description?, active? }
 *  - El handler arma el ModifyProductRequest correcto con `updatedFields` solo de los campos que mandaste.
 *
 * DELETE /api/py/menu/product/{id} → borra el producto
 */
import { NextRequest, NextResponse } from "next/server";
import { modifyProduct } from "@/lib/py/catalog/client";
import { ID } from "@/lib/py/catalog/builder";
import type { ModifyProductRequest } from "@/lib/py/catalog/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMON_PARAMS = () => ({
  chainCode: process.env.PY_CHAIN_CODE ?? "EL_DESEMBARCO",
  globalEntityId: process.env.PY_GLOBAL_ENTITY_ID ?? "FP_AR",
  platformVendorId: process.env.PY_PLATFORM_VENDOR_ID ?? "PV_DESEMBARCO_TEST",
});

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    newPrice?: number;
    name?: string;
    description?: string;
    active?: boolean;
  };

  const productId = ID.product(id);
  const updatedFields: ModifyProductRequest["product"]["updatedFields"] = [];
  const product: ModifyProductRequest["product"] = {
    productId,
    action: "upsert",
    updatedFields,
  };

  if (typeof body.newPrice === "number") {
    product.price = String(body.newPrice);
    updatedFields.push("price");
  }
  if (body.name) {
    product.names = [{ locale: "es-AR", value: body.name, action: "upsert", updatedFields: ["value"] }];
    updatedFields.push("name");
  }
  if (body.description) {
    product.descriptions = [{ locale: "es-AR", value: body.description, action: "upsert", updatedFields: ["value"] }];
    updatedFields.push("description");
  }
  if (typeof body.active === "boolean") {
    product.active = body.active;
    updatedFields.push("active");
  }
  if (updatedFields.length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const url = new URL(req.url);
  const reqBody: ModifyProductRequest = {
    processId: `mod-${Date.now()}`,
    batchId: `single-${id}`,
    timestamp: new Date().toISOString(),
    timestampLastChange: new Date().toISOString(),
    callback: `${url.origin}/api/py/menu/callback`,
    product,
  };

  const { chainCode, globalEntityId, platformVendorId } = COMMON_PARAMS();
  const res = await modifyProduct(chainCode, globalEntityId, platformVendorId, reqBody);

  if (!res.ok) {
    return NextResponse.json(
      { error: "modify_failed", status: res.status, data: res.data },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, simulated: !!res.simulated, productId, updated: updatedFields });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const productId = ID.product(id);
  const url = new URL(req.url);
  const reqBody: ModifyProductRequest = {
    processId: `del-${Date.now()}`,
    batchId: `single-delete-${id}`,
    timestamp: new Date().toISOString(),
    timestampLastChange: new Date().toISOString(),
    callback: `${url.origin}/api/py/menu/callback`,
    product: {
      productId,
      action: "delete",
      updatedFields: [],
    },
  };

  const { chainCode, globalEntityId, platformVendorId } = COMMON_PARAMS();
  const res = await modifyProduct(chainCode, globalEntityId, platformVendorId, reqBody);
  if (!res.ok) {
    return NextResponse.json(
      { error: "delete_failed", status: res.status, data: res.data },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, simulated: !!res.simulated, productId, deleted: true });
}
