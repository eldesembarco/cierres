/**
 * POST /api/dev/simulate-rappi-order
 *
 * Inserta un pedido Rappi fake en el store sin pasar por el webhook (sin firma HMAC).
 */
import { NextRequest, NextResponse } from "next/server";
import { getStore, newOrderId } from "@/lib/py/store";
import type { StoredOrder } from "@/lib/py/types";
import type { RappiOrderRaw } from "@/lib/rappi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Items con subitems realistas según el schema oficial de Rappi.
 * Ej: el endpoint GET /orders devuelve `items[].subitems[]` con name + price + quantity.
 */
const SAMPLE_ITEMS: Array<{
  name: string; quantity: number; price: number;
  subitems?: Array<{ name: string; price: number; quantity?: number; type?: string; sku?: string }>;
  comments?: string;
}> = [
  {
    name: "Bajoncito", quantity: 1, price: 14000,
    subitems: [
      { name: "Extra cheddar", price: 1400, quantity: 1, type: "TOPPING", sku: "TOP-CHE" },
      { name: "Sin pickles", price: 0, quantity: 1, type: "MODIFIER" },
      { name: "Coca Cola Zero 500ml", price: 3700, quantity: 1, type: "PRODUCT", sku: "BEB-CCZ" },
    ],
    comments: "Cocción a punto",
  },
  {
    name: "Vicio Doble", quantity: 1, price: 17800,
    subitems: [
      { name: "Panceta extra", price: 1600, quantity: 1, type: "TOPPING" },
      { name: "Aros de cebolla", price: 1500, quantity: 1, type: "TOPPING" },
    ],
  },
  {
    name: "Cheese Simple", quantity: 2, price: 11500,
    subitems: [{ name: "Sin tomate", price: 0, quantity: 1, type: "MODIFIER" }],
  },
  {
    name: "Doble Cheese", quantity: 1, price: 21800,
    subitems: [{ name: "Huevo", price: 1100, quantity: 1, type: "TOPPING" }],
  },
  { name: "Papas Desembarco", quantity: 1, price: 13400 },
  { name: "Mila Napolitana (Carne)", quantity: 1, price: 25400 },
  {
    name: "Combo Argento", quantity: 1, price: 8000,
    subitems: [
      { name: "Cheese simple", price: 0, quantity: 1, type: "PRODUCT" },
      { name: "Estuche de papas", price: 0, quantity: 1, type: "PRODUCT" },
      { name: "Coca Cola Zero 500ml", price: 0, quantity: 1, type: "PRODUCT" },
    ],
  },
];

const SAMPLE_USERS = [
  { name: "Vale", last_name: "Martínez" },
  { name: "Pedro", last_name: "González" },
  { name: "Florencia", last_name: "Aguirre" },
  { name: "Diego", last_name: "Pérez" },
  { name: "Camila", last_name: "Suárez" },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    items?: Array<{ name: string; quantity: number; price?: number }>;
    storeId?: string;
  };

  const orderId = `RP-${Math.floor(40000 + Math.random() * 9999)}`;
  const storeId = body.storeId ?? process.env.RAPPI_STORE_ID ?? "DESEMBARCO_001";
  const items = body.items
    ? body.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price ?? 10000 }))
    : Array.from({ length: 1 + Math.floor(Math.random() * 3) }).map(() => pick(SAMPLE_ITEMS));

  const subtotal = items.reduce((s, i) => {
    const itemSubs = ("subitems" in i ? i.subitems ?? [] : []) as Array<{ price: number; quantity?: number }>;
    const subitemsTotal = itemSubs.reduce((ss, s) => ss + (s.price ?? 0) * (s.quantity ?? 1), 0);
    return s + ((Number(i.price) ?? 0) + subitemsTotal) * Number(i.quantity);
  }, 0);
  const user = pick(SAMPLE_USERS);

  // Rappi siempre paga online — dejamos `payment_method` como "online" siempre.
  const raw: RappiOrderRaw = {
    order_id: orderId,
    store_id: storeId,
    state: "WEBHOOK",
    delivery_method: "delivery",
    user: { ...user, phone: "+5491155551234" },
    address: {
      street_name: "Av. Cabildo",
      street_number: "2890",
      district: "CABA",
      latitude: -34.5613,
      longitude: -58.4555,
    },
    items,
    payment_method: "online",
    cooking_time: 25,
    total_value: subtotal,
    created_at: new Date().toISOString(),
    comments: Math.random() < 0.25 ? "Llegar al departamento por la puerta de servicio." : undefined,
  };

  const store = getStore();
  const stored: StoredOrder = {
    id: newOrderId(),
    app: "rappi",
    rappiOrderId: orderId,
    rappiStoreId: String(storeId),
    countryDomain: process.env.RAPPI_COUNTRY_DOMAIN ?? "https://services.rappi.com.ar",
    pyCode: orderId,
    remoteId: String(storeId),
    state: "received",
    receivedAt: Date.now(),
    updatedAt: Date.now(),
    raw,
  };
  await store.put(stored);

  return NextResponse.json({ ok: true, order: stored });
}
