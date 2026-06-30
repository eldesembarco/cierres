"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Search, X, Minus, Plus, Users, ShoppingBag, CreditCard, Flame, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categorias, productos, type CategoriaId, type Producto } from "@/lib/data";
import { fmtAR } from "@/lib/format";
import { ModificadoresSheet, type AddItemInput } from "./ModificadoresSheet";
import { addKitchenOrder } from "@/lib/kitchen-orders";

interface TicketItem {
  id: string;
  nombre: string;
  qty: number;
  precio: number;
  mods: string[];
}

const STORAGE_KEY = "pos-ticket-v1";
const DEFAULT_TICKET: TicketItem[] = [
  { id: "030002", nombre: "1/2 Pinta Clásica",    qty: 2, precio:  4000, mods: [] },
  { id: "130020", nombre: "Desembarco",           qty: 1, precio: 21800, mods: ["Sin cebolla", "Cocción jugosa"] },
  { id: "140012", nombre: "Papas Desembarco",     qty: 1, precio: 13400, mods: [] },
  { id: "020009", nombre: "Coca Cola 500cc",      qty: 1, precio:  3700, mods: [] },
];

function loadTicket(): TicketItem[] {
  if (typeof window === "undefined") return DEFAULT_TICKET;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TICKET;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_TICKET;
  } catch { return DEFAULT_TICKET; }
}

const tagClass: Record<string, string> = {
  POPULAR:   "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  DESTACADA: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  VEGGIE:    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  RECARGA:   "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  COMBO:     "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  PROMO:     "bg-pink-100 text-pink-900 dark:bg-pink-900/40 dark:text-pink-200",
  "SIN TACC": "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
  "PARA 2":  "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
};

export function POSScreen() {
  const [mounted, setMounted] = useState(false);
  const [cat, setCat] = useState<CategoriaId>("tiradas");
  const [q, setQ] = useState("");
  const [ticket, setTicket] = useState<TicketItem[]>(DEFAULT_TICKET);
  const [modProducto, setModProducto] = useState<Producto | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Hidratar localStorage solo en cliente para evitar SSR mismatch
  useEffect(() => {
    setTicket(loadTicket());
    setMounted(true);
  }, []);

  // Persistir cambios — solo después de montar para no pisar el default antes de cargar
  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ticket)); } catch {}
  }, [ticket, mounted]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const inField = !!tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA");
      if (!inField && (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && inField && tgt === searchRef.current) {
        setQ("");
        (tgt as HTMLInputElement).blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const productosVisibles = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return productos.filter((p) =>
      lq
        ? p.nombre.toLowerCase().includes(lq) || (p.desc ?? "").toLowerCase().includes(lq) || p.id.includes(lq)
        : p.cat === cat
    );
  }, [cat, q]);

  const subtotal = ticket.reduce((s, i) => s + i.precio * i.qty, 0);
  const servicio = Math.round(subtotal * 0.10);
  const total = subtotal + servicio;
  const itemsCount = ticket.reduce((s, i) => s + i.qty, 0);

  const addItem = useCallback((p: Producto) => {
    if (p.sizes || (p.modifs && p.modifs.length > 0) || (p.agregados && p.agregados.length > 0)) {
      setModProducto(p);
      return;
    }
    setTicket((t) => {
      const ex = t.find((i) => i.id === p.id && !i.mods.length);
      if (ex) return t.map((i) => (i === ex ? { ...i, qty: i.qty + 1 } : i));
      return [...t, { id: p.id, nombre: p.nombre, qty: 1, precio: p.precio, mods: [] }];
    });
  }, []);

  const onAddFromSheet = useCallback((item: AddItemInput) => {
    setTicket((arr) => [
      ...arr,
      { id: item.id, nombre: item.nombre, qty: item.qty, precio: item.precio, mods: item.mods },
    ]);
    setModProducto(null);
  }, []);

  const setQty = (idx: number, d: number) =>
    setTicket((t) =>
      t.map((i, k) => (k === idx ? { ...i, qty: Math.max(0, i.qty + d) } : i)).filter((i) => i.qty > 0)
    );

  const clearTicket = () => {
    if (ticket.length === 0) return;
    if (confirm("¿Vaciar el pedido actual?")) setTicket([]);
  };

  const cobrar = () => {
    if (ticket.length === 0) return;
    try {
      localStorage.setItem(
        "pos-cobrar",
        JSON.stringify({ items: ticket, ts: Date.now(), origen: "Mostrador #1042" })
      );
    } catch {}
    window.location.href = "/cobro";
  };

  const [enviadoFlash, setEnviadoFlash] = useState<string | null>(null);
  const enviarACocina = () => {
    if (ticket.length === 0) return;
    const order = addKitchenOrder({
      origen: "mesa",
      mesa: 0, // mostrador
      mozo: "Mostrador",
      items: ticket.map((i) => ({ nombre: i.nombre, qty: i.qty, mods: i.mods })),
    });
    setEnviadoFlash(order.id);
    setTimeout(() => setEnviadoFlash(null), 2400);
  };

  return (
    <>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* IZQUIERDA: catálogo */}
        <section className="flex flex-col flex-1 min-w-0 border-r">
          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar productos, código, atajo…  ( / )"
                className="pl-10 pr-10 h-11"
                aria-label="Buscar productos"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-muted text-muted-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="px-5 pt-2 pb-3 flex gap-2 overflow-x-auto scroll-y" role="tablist" aria-label="Categorías">
            {categorias.map((c) => {
              const active = c.id === cat && !q;
              return (
                <button
                  key={c.id}
                  onClick={() => { setCat(c.id); setQ(""); }}
                  role="tab"
                  aria-selected={active}
                  className={
                    "shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-sm transition " +
                    (active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border hover:bg-muted")
                  }
                >
                  <span className="text-base leading-none">{c.icon}</span>
                  <span className="font-medium">{c.nombre}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto scroll-y px-5 pb-5">
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {productosVisibles.length === 0 && q && (
                <div className="col-span-full rounded-xl border border-dashed bg-card text-center py-12 px-6">
                  <div className="text-3xl opacity-50">🔍</div>
                  <div className="font-semibold mt-2">Sin resultados para &ldquo;{q}&rdquo;</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Probá con otro término o limpiá la búsqueda
                  </div>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setQ("")}>
                    <X size={14} /> Limpiar
                  </Button>
                </div>
              )}
              {productosVisibles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="group flex flex-col text-left rounded-xl border bg-card hover:border-primary hover:shadow-md transition overflow-hidden"
                >
                  <div className="aspect-[5/3] bg-gradient-to-br from-amber-50 to-amber-100 dark:from-stone-800 dark:to-stone-900 flex items-center justify-center text-3xl">
                    {(categorias.find((c) => c.id === p.cat) ?? {}).icon}
                  </div>
                  <div className="flex flex-col flex-1 p-3 gap-1">
                    <div className="text-[10px] tabular text-muted-foreground">{p.id}</div>
                    <div className="text-sm font-semibold leading-snug line-clamp-2">{p.nombre}</div>
                    {p.desc && (
                      <div className="text-xs text-muted-foreground leading-snug line-clamp-2">{p.desc}</div>
                    )}
                    <div className="flex items-center justify-between gap-1 mt-auto pt-2">
                      <span className="tabular text-sm font-bold">{fmtAR(p.precio)}</span>
                      {p.tag && (
                        <span className={"text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider " + (tagClass[p.tag] ?? "bg-muted text-muted-foreground")}>
                          {p.tag}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* DERECHA: ticket */}
        <aside className="flex flex-col w-[400px] shrink-0 bg-card">
          <div className="flex items-center justify-between px-5 h-14 border-b">
            <div>
              <div className="font-bold">Pedido nuevo</div>
              <div className="text-xs text-muted-foreground">
                Mostrador · #1042 · {itemsCount} {itemsCount === 1 ? "ítem" : "ítems"}
              </div>
            </div>
            <Button variant="ghost" size="sm" disabled={ticket.length === 0} onClick={clearTicket}>
              <X size={14} /> Vaciar
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto scroll-y">
            {ticket.length === 0 && (
              <div className="text-center text-muted-foreground py-12 px-6 text-sm">
                Tocá productos para agregarlos al pedido
              </div>
            )}
            {ticket.map((i, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-3 items-start px-5 py-3 border-b">
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-snug">
                    <span className="tabular text-xs text-muted-foreground mr-1.5">{i.id}</span>
                    {i.nombre}
                  </div>
                  {i.mods.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {i.mods.map((m, k) => (
                        <span key={k}>· {m} </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 self-center">
                  <button
                    onClick={() => setQty(idx, -1)}
                    className="w-7 h-7 rounded border hover:bg-muted flex items-center justify-center"
                    aria-label="Disminuir"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="tabular text-sm font-semibold w-5 text-center">{i.qty}</span>
                  <button
                    onClick={() => setQty(idx, +1)}
                    className="w-7 h-7 rounded border hover:bg-muted flex items-center justify-center"
                    aria-label="Aumentar"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="tabular text-sm font-bold self-center">{fmtAR(i.precio * i.qty)}</div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular">{fmtAR(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Servicio (10%)</span>
              <span className="tabular">{fmtAR(servicio)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-1 border-t">
              <span>Total</span>
              <span className="tabular">{fmtAR(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 pt-2 border-t">
            <Button variant="outline" size="lg" className="h-11">
              <Users /> Mesa
            </Button>
            <Button variant="outline" size="lg" className="h-11">
              <ShoppingBag /> Take-away
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 col-span-2 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={enviarACocina}
              disabled={ticket.length === 0}
            >
              {enviadoFlash ? (
                <><Check /> Enviado · {enviadoFlash}</>
              ) : (
                <><Flame /> Enviar a cocina</>
              )}
            </Button>
            <Button
              size="lg"
              className="h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold col-span-2"
              onClick={cobrar}
              disabled={ticket.length === 0}
            >
              <CreditCard /> Cobrar {fmtAR(total)}
            </Button>
          </div>
        </aside>
      </div>

      <ModificadoresSheet
        producto={modProducto}
        onClose={() => setModProducto(null)}
        onAdd={onAddFromSheet}
      />
    </>
  );
}
