/**
 * Queries de reportes. Funcionan tanto sobre Postgres como sobre MemoryStore.
 * En memoria: filter/reduce sobre el array de StoredOrder.
 * En Postgres: SQL agregado con GROUP BY.
 */

import { sql } from "@vercel/postgres";
import { getStore, hasPostgres } from "@/lib/py/store";
import type { DeliveryApp, LocalState, StoredOrder } from "@/lib/py/types";

export interface DateRange {
  fromMs: number;
  toMs: number;
}

// Para reportes contamos todo lo que NO está rechazado/cancelado: incluye received
// (pedidos que están entrando) hasta completed. Excluye solo rejected/cancelled.
const TICKET_INCLUDED_STATES: LocalState[] = ["received", "accepted", "preparing", "ready", "picked_up", "completed"];
const isTicket = (state: string) => (TICKET_INCLUDED_STATES as string[]).includes(state);

// ============================================================
// KPIs: facturado, tickets, ticket promedio, propinas (mock)
// ============================================================
export interface KpisResult {
  facturado: number;
  tickets: number;
  ticketPromedio: number;
  propinas: number;
}

export async function kpis(range: DateRange): Promise<KpisResult> {
  if (hasPostgres()) {
    const res = await sql<{ facturado: string; tickets: string }>`
      SELECT
        COALESCE(SUM(total_value), 0)::text AS facturado,
        COUNT(*)::text AS tickets
      FROM orders
      WHERE received_at BETWEEN ${range.fromMs} AND ${range.toMs}
        AND state IN ('received','accepted','preparing','ready','picked_up','completed')
    `;
    const r = res.rows[0] ?? { facturado: "0", tickets: "0" };
    const facturado = Number(r.facturado);
    const tickets = Number(r.tickets);
    return {
      facturado,
      tickets,
      ticketPromedio: tickets > 0 ? Math.round(facturado / tickets) : 0,
      propinas: Math.round(facturado * 0.085), // estimado, no lo expone uniforme
    };
  }
  const orders = await getStore().list({ limit: 10_000 });
  const filtered = orders.filter(
    (o) => o.receivedAt >= range.fromMs && o.receivedAt <= range.toMs && isTicket(o.state)
  );
  const facturado = filtered.reduce((s, o) => s + extractTotal(o), 0);
  const tickets = filtered.length;
  return {
    facturado,
    tickets,
    ticketPromedio: tickets > 0 ? Math.round(facturado / tickets) : 0,
    propinas: Math.round(facturado * 0.085),
  };
}

// ============================================================
// Ventas por hora
// ============================================================
export interface HourBucket { hour: number; total: number; tickets: number }

export async function byHour(range: DateRange): Promise<HourBucket[]> {
  if (hasPostgres()) {
    const res = await sql<{ hour: string; total: string; tickets: string }>`
      SELECT
        EXTRACT(HOUR FROM TO_TIMESTAMP(received_at / 1000)) AS hour,
        COALESCE(SUM(total_value), 0)::text AS total,
        COUNT(*)::text AS tickets
      FROM orders
      WHERE received_at BETWEEN ${range.fromMs} AND ${range.toMs}
        AND state IN ('received','accepted','preparing','ready','picked_up','completed')
      GROUP BY hour
      ORDER BY hour
    `;
    return res.rows.map((r) => ({ hour: Number(r.hour), total: Number(r.total), tickets: Number(r.tickets) }));
  }
  const orders = await getStore().list({ limit: 10_000 });
  const map = new Map<number, { total: number; tickets: number }>();
  for (const o of orders) {
    if (o.receivedAt < range.fromMs || o.receivedAt > range.toMs) continue;
    if (!isTicket(o.state)) continue;
    const h = new Date(o.receivedAt).getHours();
    const cur = map.get(h) ?? { total: 0, tickets: 0 };
    cur.total += extractTotal(o);
    cur.tickets += 1;
    map.set(h, cur);
  }
  return [...map.entries()]
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => a.hour - b.hour);
}

// ============================================================
// Ventas por canal (donut)
// ============================================================
export interface ChannelSlice { app: DeliveryApp; total: number; tickets: number }

export async function byChannel(range: DateRange): Promise<ChannelSlice[]> {
  if (hasPostgres()) {
    const res = await sql<{ app: string; total: string; tickets: string }>`
      SELECT app, COALESCE(SUM(total_value), 0)::text AS total, COUNT(*)::text AS tickets
      FROM orders
      WHERE received_at BETWEEN ${range.fromMs} AND ${range.toMs}
        AND state IN ('received','accepted','preparing','ready','picked_up','completed')
      GROUP BY app
      ORDER BY total DESC
    `;
    return res.rows.map((r) => ({ app: r.app as DeliveryApp, total: Number(r.total), tickets: Number(r.tickets) }));
  }
  const orders = await getStore().list({ limit: 10_000 });
  const map = new Map<DeliveryApp, { total: number; tickets: number }>();
  for (const o of orders) {
    if (o.receivedAt < range.fromMs || o.receivedAt > range.toMs) continue;
    if (!isTicket(o.state)) continue;
    const cur = map.get(o.app) ?? { total: 0, tickets: 0 };
    cur.total += extractTotal(o);
    cur.tickets += 1;
    map.set(o.app, cur);
  }
  return [...map.entries()].map(([app, v]) => ({ app, ...v })).sort((a, b) => b.total - a.total);
}

// ============================================================
// Top productos
// ============================================================
export interface TopProduct { name: string; qty: number; total: number }

export async function topProducts(range: DateRange, limit = 10): Promise<TopProduct[]> {
  if (hasPostgres()) {
    const res = await sql<{ name: string; qty: string; total: string }>`
      SELECT
        i.name AS name,
        COALESCE(SUM(i.quantity), 0)::text AS qty,
        COALESCE(SUM(i.total_price), 0)::text AS total
      FROM order_items i
      JOIN orders o ON o.id = i.order_id
      WHERE o.received_at BETWEEN ${range.fromMs} AND ${range.toMs}
        AND o.state IN ('received','accepted','preparing','ready','picked_up','completed')
      GROUP BY i.name
      ORDER BY total DESC
      LIMIT ${limit}
    `;
    return res.rows.map((r) => ({ name: r.name, qty: Number(r.qty), total: Number(r.total) }));
  }
  const orders = await getStore().list({ limit: 10_000 });
  const map = new Map<string, { qty: number; total: number }>();
  for (const o of orders) {
    if (o.receivedAt < range.fromMs || o.receivedAt > range.toMs) continue;
    if (!isTicket(o.state)) continue;
    for (const it of extractItems(o)) {
      const cur = map.get(it.name) ?? { qty: 0, total: 0 };
      cur.qty += it.qty;
      cur.total += it.total;
      map.set(it.name, cur);
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// ============================================================
// Métodos de pago
// ============================================================
export interface PaymentSlice { method: string; total: number; tickets: number; pct: number }

export async function byPayment(range: DateRange): Promise<PaymentSlice[]> {
  let rows: { method: string; total: number; tickets: number }[];
  if (hasPostgres()) {
    const res = await sql<{ method: string; total: string; tickets: string }>`
      SELECT
        COALESCE(payment_method, 'desconocido') AS method,
        COALESCE(SUM(total_value), 0)::text AS total,
        COUNT(*)::text AS tickets
      FROM orders
      WHERE received_at BETWEEN ${range.fromMs} AND ${range.toMs}
        AND state IN ('received','accepted','preparing','ready','picked_up','completed')
      GROUP BY method
      ORDER BY total DESC
    `;
    rows = res.rows.map((r) => ({ method: r.method, total: Number(r.total), tickets: Number(r.tickets) }));
  } else {
    const orders = await getStore().list({ limit: 10_000 });
    const map = new Map<string, { total: number; tickets: number }>();
    for (const o of orders) {
      if (o.receivedAt < range.fromMs || o.receivedAt > range.toMs) continue;
      if (!isTicket(o.state)) continue;
      const m = extractPayment(o);
      const cur = map.get(m) ?? { total: 0, tickets: 0 };
      cur.total += extractTotal(o);
      cur.tickets += 1;
      map.set(m, cur);
    }
    rows = [...map.entries()].map(([method, v]) => ({ method, ...v }));
    rows.sort((a, b) => b.total - a.total);
  }
  const grand = rows.reduce((s, r) => s + r.total, 0) || 1;
  return rows.map((r) => ({ ...r, pct: Math.round((r.total / grand) * 100) }));
}

// ============================================================
// Helpers de extracción (memory-mode)
// ============================================================
function extractTotal(o: StoredOrder): number {
  if (o.app === "pedidosya") {
    return Math.round(Number(o.raw.price?.totalGross ?? 0));
  }
  type RappiRaw = { total_value?: number | string };
  return Math.round(Number((o.raw as RappiRaw)?.total_value ?? 0));
}

function extractItems(o: StoredOrder): Array<{ name: string; qty: number; total: number }> {
  if (o.app === "pedidosya") {
    return (o.raw.products ?? []).map((p) => {
      const qty = Number(p.quantity ?? 1);
      const unit = Number(p.paidPrice ?? 0);
      return { name: p.name ?? "—", qty, total: qty * unit };
    });
  }
  type RappiItem = { name?: string; quantity?: number | string; price?: number | string };
  type RappiRaw = { items?: RappiItem[] };
  const raw = (o.raw ?? {}) as RappiRaw;
  return (raw.items ?? []).map((p) => {
    const qty = Number(p.quantity ?? 1);
    const unit = Number(p.price ?? 0);
    return { name: p.name ?? "—", qty, total: qty * unit };
  });
}

function extractPayment(o: StoredOrder): string {
  if (o.app === "pedidosya") return o.raw.payment?.type ?? "ONLINE";
  type RappiRaw = { payment_method?: string };
  return (o.raw as RappiRaw)?.payment_method ?? "online";
}
