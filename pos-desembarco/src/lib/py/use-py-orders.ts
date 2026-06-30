"use client";

import { useEffect, useState, useCallback } from "react";
import type { StoredOrder } from "./types";

/**
 * Hook reactivo para los pedidos PY persistidos en el server.
 * Polling cada 4s. En el futuro se puede swapear por SSE sin tocar callers.
 */
export function usePYOrders(intervalMs = 4000) {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders: StoredOrder[] };
      setOrders(data.orders);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { orders, loading, error, refresh };
}

export async function simulatePYOrder(): Promise<StoredOrder | null> {
  const res = await fetch("/api/dev/simulate-py-order", { method: "POST" });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok: boolean; order: StoredOrder };
  return data.order;
}

export async function simulateRappiOrder(): Promise<StoredOrder | null> {
  const res = await fetch("/api/dev/simulate-rappi-order", { method: "POST" });
  if (!res.ok) return null;
  const data = (await res.json()) as { ok: boolean; order: StoredOrder };
  return data.order;
}

export async function acceptPYOrder(id: string, prepTimeMin = 25) {
  const res = await fetch(`/api/orders/${id}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prepTimeMin }),
  });
  return res.ok;
}

export async function rejectPYOrder(id: string, reason = "OTHER", message = "Rechazado") {
  const res = await fetch(`/api/orders/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, message }),
  });
  return res.ok;
}

export async function readyPYOrder(id: string) {
  const res = await fetch(`/api/orders/${id}/ready`, { method: "POST" });
  return res.ok;
}

export async function clearPYOrders() {
  const res = await fetch("/api/orders", { method: "DELETE" });
  return res.ok;
}
