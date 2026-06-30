/**
 * Server-side store de pedidos PY.
 *
 * Hoy: in-memory por instancia (Node module global). Funciona en single-region preview
 * y suficiente para integration testing con PY staging.
 *
 * Mañana: cuando agreguen Vercel KV (Upstash Redis) al proyecto, swapeamos la implementación
 * sin tocar callers. La interfaz queda igual.
 *
 * Por qué no KV ya: requiere `vercel storage create` interactivo + env vars en el dashboard.
 * El user puede configurarlo y este módulo detecta `process.env.KV_REST_API_URL` para activar.
 */

import type { StoredOrder } from "./types";

interface OrderStore {
  put(order: StoredOrder): Promise<void>;
  get(id: string): Promise<StoredOrder | null>;
  getByPyToken(token: string): Promise<StoredOrder | null>;
  list(opts?: { limit?: number }): Promise<StoredOrder[]>;
  patch(id: string, patch: Partial<StoredOrder>): Promise<StoredOrder | null>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

class MemoryStore implements OrderStore {
  private byId = new Map<string, StoredOrder>();
  private byPyToken = new Map<string, string>();

  async put(order: StoredOrder) {
    this.byId.set(order.id, order);
    if (order.app === "pedidosya") {
      this.byPyToken.set(order.pyToken, order.id);
    }
  }
  async get(id: string) { return this.byId.get(id) ?? null; }
  async getByPyToken(token: string) {
    const id = this.byPyToken.get(token);
    return id ? this.byId.get(id) ?? null : null;
  }
  async list(opts: { limit?: number } = {}) {
    const all = [...this.byId.values()].sort((a, b) => b.receivedAt - a.receivedAt);
    return opts.limit ? all.slice(0, opts.limit) : all;
  }
  async patch(id: string, patch: Partial<StoredOrder>) {
    const cur = this.byId.get(id);
    if (!cur) return null;
    // El cast es seguro: solo permitimos modificar campos comunes (state, prepTimeMin, etc.)
    // — nunca cambiamos `app` ni los discriminadores específicos.
    const next = { ...cur, ...patch, updatedAt: Date.now() } as StoredOrder;
    this.byId.set(id, next);
    return next;
  }
  async delete(id: string) {
    const cur = this.byId.get(id);
    if (!cur) return;
    if (cur.app === "pedidosya") this.byPyToken.delete(cur.pyToken);
    this.byId.delete(id);
  }
  async clear() { this.byId.clear(); this.byPyToken.clear(); }
}

// global singleton — sobrevive HMR en dev
declare global {
  // eslint-disable-next-line no-var
  var __pyStore: OrderStore | undefined;
}

/** True si tenemos Postgres configurado (Vercel inyecta POSTGRES_URL automáticamente
 * cuando se linkea un Postgres Marketplace). */
export function hasPostgres(): boolean {
  return !!process.env.POSTGRES_URL;
}

export function getStore(): OrderStore {
  if (globalThis.__pyStore) return globalThis.__pyStore;
  if (hasPostgres()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PostgresStore } = require("@/lib/db/store-postgres") as typeof import("@/lib/db/store-postgres");
    globalThis.__pyStore = PostgresStore as OrderStore;
  } else {
    globalThis.__pyStore = new MemoryStore();
  }
  return globalThis.__pyStore as OrderStore;
}

/** Genera nuestro ID interno: ED-A1B2C3 */
export function newOrderId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `ED-${s}`;
}
