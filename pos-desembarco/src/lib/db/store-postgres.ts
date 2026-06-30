/**
 * Implementación Postgres del OrderStore.
 *
 * Pre-requisito: variable POSTGRES_URL configurada (la pone Vercel automáticamente
 * cuando linkeás un Postgres del Marketplace).
 */
import { sql } from "@vercel/postgres";
import type { StoredOrder } from "@/lib/py/types";
import { ensureSchema } from "./schema";

let schemaReady = false;
async function init() {
  if (schemaReady) return;
  await ensureSchema();
  schemaReady = true;
}

interface OrderRow {
  id: string;
  app: "pedidosya" | "rappi";
  state: string;
  received_at: string | number;
  updated_at: string | number;
  remote_id: string | null;
  py_code: string | null;
  py_token: string | null;
  rappi_order_id: string | null;
  rappi_store_id: string | null;
  country_domain: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_value: number;
  items_count: number;
  payment_method: string | null;
  rejection_reason: string | null;
  prep_time_min: number | null;
  raw: unknown;
}

function rowToOrder(r: OrderRow): StoredOrder {
  const base = {
    id: r.id,
    state: r.state as StoredOrder["state"],
    receivedAt: Number(r.received_at),
    updatedAt: Number(r.updated_at),
    remoteId: r.remote_id ?? "",
    pyCode: r.py_code ?? "",
    rejectionReason: r.rejection_reason ?? undefined,
    prepTimeMin: r.prep_time_min ?? undefined,
  };
  if (r.app === "pedidosya") {
    return {
      ...base,
      app: "pedidosya",
      pyToken: r.py_token ?? "",
      raw: (r.raw ?? {}) as StoredOrder["raw"] & { products?: unknown[] },
    } as StoredOrder;
  }
  return {
    ...base,
    app: "rappi",
    rappiOrderId: r.rappi_order_id ?? "",
    rappiStoreId: r.rappi_store_id ?? "",
    countryDomain: r.country_domain ?? "",
    raw: r.raw ?? {},
  } as StoredOrder;
}

/** Extrae denormalizados del payload — distinto schema por app */
function extractDenorm(o: StoredOrder): {
  customerName: string;
  customerPhone: string;
  totalValue: number;
  itemsCount: number;
  paymentMethod: string;
  items: Array<{ name: string; qty: number; unitPrice: number; totalPrice: number; sku?: string }>;
} {
  if (o.app === "pedidosya") {
    const c = o.raw.customer;
    const products = o.raw.products ?? [];
    const items = products.map((p) => {
      const qty = Number(p.quantity ?? 1);
      const unit = Number(p.paidPrice ?? 0);
      return {
        name: p.name ?? "—",
        qty,
        unitPrice: Math.round(unit),
        totalPrice: Math.round(unit * qty),
        sku: p.sku ?? p.remoteCode ?? undefined,
      };
    });
    return {
      customerName: [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "",
      customerPhone: c?.mobilePhone ?? "",
      totalValue: Math.round(Number(o.raw.price?.totalGross ?? items.reduce((s, i) => s + i.totalPrice, 0))),
      itemsCount: items.reduce((s, i) => s + i.qty, 0),
      paymentMethod: o.raw.payment?.type ?? "ONLINE",
      items,
    };
  }
  type RappiItem = { name?: string; quantity?: number | string; price?: number | string; sku?: string };
  type RappiUser = { name?: string; last_name?: string; phone?: string };
  type RappiRaw = {
    items?: RappiItem[];
    user?: RappiUser;
    payment_method?: string;
    total_value?: number | string;
  };
  const raw = (o.raw ?? {}) as RappiRaw;
  const items = (raw.items ?? []).map((p) => {
    const qty = Number(p.quantity ?? 1);
    const unit = Number(p.price ?? 0);
    return {
      name: p.name ?? "—",
      qty,
      unitPrice: Math.round(unit),
      totalPrice: Math.round(unit * qty),
      sku: p.sku ?? undefined,
    };
  });
  return {
    customerName: [raw.user?.name, raw.user?.last_name].filter(Boolean).join(" ") || "",
    customerPhone: raw.user?.phone ?? "",
    totalValue: Math.round(Number(raw.total_value ?? items.reduce((s, i) => s + i.totalPrice, 0))),
    itemsCount: items.reduce((s, i) => s + i.qty, 0),
    paymentMethod: raw.payment_method ?? "online",
    items,
  };
}

export const PostgresStore = {
  async put(o: StoredOrder): Promise<void> {
    await init();
    const d = extractDenorm(o);
    const raw = JSON.stringify(o.raw);
    if (o.app === "pedidosya") {
      await sql`
        INSERT INTO orders (
          id, app, state, received_at, updated_at, remote_id, py_code, py_token,
          customer_name, customer_phone, total_value, items_count, payment_method,
          rejection_reason, prep_time_min, raw
        ) VALUES (
          ${o.id}, 'pedidosya', ${o.state}, ${o.receivedAt}, ${o.updatedAt}, ${o.remoteId}, ${o.pyCode}, ${o.pyToken},
          ${d.customerName}, ${d.customerPhone}, ${d.totalValue}, ${d.itemsCount}, ${d.paymentMethod},
          ${o.rejectionReason ?? null}, ${o.prepTimeMin ?? null}, ${raw}::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          state = EXCLUDED.state,
          updated_at = EXCLUDED.updated_at,
          rejection_reason = EXCLUDED.rejection_reason,
          prep_time_min = EXCLUDED.prep_time_min,
          raw = EXCLUDED.raw
      `;
    } else {
      await sql`
        INSERT INTO orders (
          id, app, state, received_at, updated_at, remote_id, py_code,
          rappi_order_id, rappi_store_id, country_domain,
          customer_name, customer_phone, total_value, items_count, payment_method,
          rejection_reason, prep_time_min, raw
        ) VALUES (
          ${o.id}, 'rappi', ${o.state}, ${o.receivedAt}, ${o.updatedAt}, ${o.remoteId}, ${o.pyCode},
          ${o.rappiOrderId}, ${o.rappiStoreId}, ${o.countryDomain},
          ${d.customerName}, ${d.customerPhone}, ${d.totalValue}, ${d.itemsCount}, ${d.paymentMethod},
          ${o.rejectionReason ?? null}, ${o.prepTimeMin ?? null}, ${raw}::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          state = EXCLUDED.state,
          updated_at = EXCLUDED.updated_at,
          rejection_reason = EXCLUDED.rejection_reason,
          prep_time_min = EXCLUDED.prep_time_min,
          raw = EXCLUDED.raw
      `;
    }

    // Reescribir items
    await sql`DELETE FROM order_items WHERE order_id = ${o.id}`;
    for (let i = 0; i < d.items.length; i++) {
      const it = d.items[i];
      await sql`
        INSERT INTO order_items (order_id, idx, name, quantity, unit_price, total_price, sku)
        VALUES (${o.id}, ${i}, ${it.name}, ${it.qty}, ${it.unitPrice}, ${it.totalPrice}, ${it.sku ?? null})
      `;
    }
  },

  async get(id: string): Promise<StoredOrder | null> {
    await init();
    const res = await sql<OrderRow>`SELECT * FROM orders WHERE id = ${id}`;
    return res.rows[0] ? rowToOrder(res.rows[0]) : null;
  },

  async getByPyToken(token: string): Promise<StoredOrder | null> {
    await init();
    const res = await sql<OrderRow>`SELECT * FROM orders WHERE py_token = ${token} LIMIT 1`;
    return res.rows[0] ? rowToOrder(res.rows[0]) : null;
  },

  async list(opts: { limit?: number } = {}): Promise<StoredOrder[]> {
    await init();
    const lim = opts.limit ?? 200;
    const res = await sql<OrderRow>`
      SELECT * FROM orders ORDER BY received_at DESC LIMIT ${lim}
    `;
    return res.rows.map(rowToOrder);
  },

  async patch(id: string, patch: Partial<StoredOrder>): Promise<StoredOrder | null> {
    await init();
    const cur = await this.get(id);
    if (!cur) return null;
    const next = { ...cur, ...patch, updatedAt: Date.now() } as StoredOrder;
    await this.put(next);
    return next;
  },

  async delete(id: string): Promise<void> {
    await init();
    await sql`DELETE FROM orders WHERE id = ${id}`;
  },

  async clear(): Promise<void> {
    await init();
    await sql`DELETE FROM order_items`;
    await sql`DELETE FROM orders`;
  },
};
