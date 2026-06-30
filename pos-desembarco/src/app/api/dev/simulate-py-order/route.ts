/**
 * POST /api/dev/simulate-py-order
 *
 * Simula que PedidosYa nos manda un pedido. Inserta directo en el store sin pasar
 * por la auth del webhook. Útil para QA y demos antes de tener la integración real.
 *
 * Body opcional: { customer?: string, items?: [{ name, qty }], total?: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { getStore, newOrderId } from "@/lib/py/store";
import type { PYOrderRaw, StoredOrder } from "@/lib/py/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Catálogo con toppings/agregados realistas para que el simulador genere variaciones ricas
const SAMPLE_PRODUCTS: Array<{
  name: string; qty: number; price: string; comment?: string;
  toppings?: Array<{ name: string; price: string; quantity?: string }>;
}> = [
  {
    name: "Bajoncito", qty: 1, price: "14000",
    toppings: [
      { name: "Extra cheddar", price: "1400" },
      { name: "Cebolla caramelizada", price: "1300" },
    ],
    comment: "Sin pickles por favor",
  },
  {
    name: "Vicio Doble", qty: 1, price: "17800",
    toppings: [{ name: "Panceta extra", price: "1600" }],
  },
  {
    name: "Cheese Simple", qty: 2, price: "11500",
    toppings: [{ name: "Huevo", price: "1100" }],
  },
  {
    name: "Doble Cheese", qty: 1, price: "21800",
    toppings: [
      { name: "Aros de cebolla", price: "1500" },
      { name: "Medallón extra", price: "3200" },
    ],
  },
  {
    name: "Papas Desembarco", qty: 1, price: "13400",
  },
  {
    name: "Combo Argento", qty: 1, price: "8000",
    toppings: [
      { name: "Coca Cola Zero 500ml", price: "0" },
      { name: "Cheese simple — cocción jugosa", price: "0" },
    ],
  },
  {
    name: "1/2 Pinta Clásica", qty: 2, price: "4000",
  },
  {
    name: "Coca Cola 500cc", qty: 1, price: "3700",
  },
];

const SAMPLE_NAMES = [
  ["Joaquín", "Rodriguez"],
  ["Vale", "Martínez"],
  ["Sebastián", "López"],
  ["Lucas", "Lautaro"],
  ["Carla", "Fernández"],
  ["Tomás", "Benvenuto"],
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    items?: Array<{ name: string; qty: number; price?: string }>;
    customer?: string;
    /** force el modo de pago: "CASH" | "ONLINE" (default: 1 de cada 3 sale CASH) */
    paymentType?: "CASH" | "ONLINE";
  };

  const store = getStore();
  const id = newOrderId();
  const token = `STG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const code = `PY-${Math.floor(8000 + Math.random() * 1000)}`;

  // pick 2-4 productos al azar si no nos pasan items, con sus toppings
  const items = body.items
    ? body.items.map((i) => ({ name: i.name, quantity: String(i.qty), paidPrice: i.price ?? "10000" }))
    : Array.from({ length: 2 + Math.floor(Math.random() * 3) })
        .map(() => pickRandom(SAMPLE_PRODUCTS))
        .map((p) => {
          const toppingsTotal = (p.toppings ?? []).reduce((s, t) => s + Number(t.price), 0);
          return {
            name: p.name,
            quantity: String(p.qty),
            paidPrice: String(Number(p.price) + toppingsTotal),
            unitPrice: p.price,
            selectedToppings: p.toppings,
            comment: p.comment ?? undefined,
            categoryName: undefined,
          };
        });

  const subtotal = items.reduce((s, i) => s + Number(i.paidPrice ?? "0") * Number(i.quantity), 0);

  const [first, last] = body.customer
    ? body.customer.split(" ", 2).concat([""]).slice(0, 2)
    : pickRandom(SAMPLE_NAMES);

  // Payment: por defecto 1 de cada 3 sale en efectivo (CASH) para que se vea el flow
  const paymentType = body.paymentType ?? (Math.random() < 0.33 ? "CASH" : "ONLINE");
  const isCash = paymentType === "CASH";

  const raw: PYOrderRaw = {
    token,
    code,
    expeditionType: "delivery",
    expeditionTime: new Date(Date.now() + 35 * 60_000).toISOString(),
    customer: { firstName: first, lastName: last, mobilePhone: "+5491155551234" },
    delivery: {
      address: { street: "Av. Cabildo", number: "2890", city: "CABA", postalCode: "1428" },
      riderPickupTime: new Date(Date.now() + 25 * 60_000).toISOString(),
    },
    products: items,
    payment: { type: paymentType, status: isCash ? "PENDING" : "PAID" },
    price: {
      totalGross: String(subtotal),
      subTotal: String(subtotal),
      // Si es efectivo, PY indica cuánto cobrar en mano al rider
      collectFromCustomer: isCash ? String(subtotal) : undefined,
    },
    comments: {
      customerComment: Math.random() < 0.3 ? "Tocar timbre 2 veces, no usar bocina." : undefined,
    },
    callbackUrls: {
      orderAcceptedUrl: `https://integration-middleware.stg.restaurant-partners.com/v2/order/status/${token}`,
      orderRejectedUrl: `https://integration-middleware.stg.restaurant-partners.com/v2/order/status/${token}`,
      preparationCompletedUrl: `https://integration-middleware.stg.restaurant-partners.com/v2/orders/${token}/preparation-completed`,
    },
  };

  const order: StoredOrder = {
    id,
    app: "pedidosya",
    pyCode: code,
    pyToken: token,
    remoteId: process.env.PY_REMOTE_ID ?? "POS_DESEMBARCO_TEST",
    state: "received",
    receivedAt: Date.now(),
    updatedAt: Date.now(),
    raw,
  };

  await store.put(order);

  return NextResponse.json({ ok: true, order });
}
