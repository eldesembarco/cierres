/**
 * Lista de pedidos PY persistidos en el server.
 * Usado por el cliente (pantalla /apps) para polling.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/py/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const orders = await getStore().list({ limit: 200 });
  return NextResponse.json({ orders });
}

/**
 * DELETE /api/orders → limpia todos los pedidos PY (dev/QA).
 */
export async function DELETE() {
  await getStore().clear();
  return NextResponse.json({ ok: true });
}
