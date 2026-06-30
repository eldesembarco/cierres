"use client";

import { useEffect, useState, useCallback } from "react";
import type { ItemPedido, Origen, EstadoPedido } from "./data";

const STORAGE_KEY = "kds-orders-v1";
const EVENT_NAME = "kds-orders-changed";

export interface KitchenOrder {
  id: string;
  origen: Origen;
  estado: EstadoPedido;
  desde: string;            // HH:MM
  items: ItemPedido[];
  mesa?: number;
  mozo?: string;
  cliente?: string;
  /** marca de tiempo cliente para que el KDS pueda calcular minutos transcurridos vs Date.now() */
  ts: number;
}

function read(): KitchenOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function write(orders: KitchenOrder[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    // notificar listeners en la misma tab; storage event nativo solo cruza tabs
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {}
}

function genId(prefix: string) {
  return `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export interface AddOrderInput {
  origen: Origen;
  items: ItemPedido[];
  mesa?: number;
  mozo?: string;
  cliente?: string;
}

export function addKitchenOrder(input: AddOrderInput): KitchenOrder {
  const prefix = input.origen === "mesa" ? "T" : input.origen === "pedidosya" ? "PY" : input.origen === "rappi" ? "RP" : input.origen === "mp" ? "MP" : "P";
  const order: KitchenOrder = {
    id: genId(prefix),
    origen: input.origen,
    estado: "nuevo",
    desde: nowHHMM(),
    items: input.items,
    mesa: input.mesa,
    mozo: input.mozo,
    cliente: input.cliente,
    ts: Date.now(),
  };
  write([order, ...read()]);
  return order;
}

export function setKitchenOrderEstado(id: string, estado: EstadoPedido) {
  const orders = read().map((o) => (o.id === id ? { ...o, estado } : o));
  write(orders.filter((o) => o.estado !== "entregado"));
}

export function clearKitchenOrders() {
  write([]);
}

/**
 * Hook reactivo: re-lee del store cuando cambia, también desde otras tabs.
 */
export function useKitchenOrders(): [KitchenOrder[], { add: (i: AddOrderInput) => KitchenOrder; setEstado: typeof setKitchenOrderEstado; clear: typeof clearKitchenOrders }] {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

  useEffect(() => {
    setOrders(read());
    const onChange = () => setOrders(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setOrders(read());
    };
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const add = useCallback((i: AddOrderInput) => addKitchenOrder(i), []);

  return [orders, { add, setEstado: setKitchenOrderEstado, clear: clearKitchenOrders }];
}

/**
 * Calcula minutos transcurridos desde un timestamp de creación del pedido.
 * Usa Date.now() — los pedidos generados por el usuario tienen reloj real, no el mock 21:24.
 */
export function minutosDesdeTs(ts: number): number {
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}
