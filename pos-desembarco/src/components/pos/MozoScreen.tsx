"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Users, ChevronRight, Check, ReceiptText, MoreHorizontal, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { categorias, productos, mesas, type CategoriaId, type Producto, type Mesa, type EstadoMesa } from "@/lib/data";
import { fmtAR } from "@/lib/format";
import { ModificadoresSheet, type AddItemInput } from "./ModificadoresSheet";
import { addKitchenOrder } from "@/lib/kitchen-orders";

interface MozoItem {
  id: string;
  nombre: string;
  qty: number;
  precio: number;
  mods: string[];
  enviado: boolean;
}

const STORAGE_KEY = "mozo-pedido-v1";
const DEFAULT_PEDIDO: MozoItem[] = [
  { id: "030002", nombre: "1/2 Pinta Clásica",  qty: 2, precio:  4000, mods: [], enviado: true },
  { id: "140002", nombre: "Picada para dos",    qty: 1, precio: 33000, mods: [], enviado: true },
  { id: "140004", nombre: "Triángulos de muzzarella", qty: 2, precio: 16400, mods: [], enviado: false },
];

const estadoMiniColor: Record<EstadoMesa, { fill: string; stroke: string }> = {
  libre: { fill: "var(--brand-bottle-soft)", stroke: "var(--brand-bottle)" },
  ocupada: { fill: "var(--brand-amber-soft)", stroke: "var(--brand-amber-deep)" },
  esperando: { fill: "var(--brand-amarillo-soft)", stroke: "#8a6a1f" },
  porPagar: { fill: "var(--brand-rojo-soft)", stroke: "var(--brand-rojo)" },
  reservada: { fill: "var(--muted)", stroke: "var(--muted-foreground)" },
};

export function MozoScreen() {
  const [mounted, setMounted] = useState(false);
  const [cat, setCat] = useState<CategoriaId>("burgers");
  const [q, setQ] = useState("");
  const [pedido, setPedido] = useState<MozoItem[]>(DEFAULT_PEDIDO);
  const [modProducto, setModProducto] = useState<Producto | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPedido(parsed);
      }
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pedido)); } catch {}
  }, [pedido, mounted]);

  const filtered = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return productos.filter((p) =>
      lq
        ? p.nombre.toLowerCase().includes(lq) || (p.desc ?? "").toLowerCase().includes(lq)
        : p.cat === cat
    );
  }, [cat, q]);

  const subtotal = pedido.reduce((s, i) => s + i.precio * i.qty, 0);
  const sinEnviar = pedido.filter((i) => !i.enviado);

  const onTapProducto = (p: Producto) => {
    if (p.sizes || (p.modifs && p.modifs.length > 0) || (p.agregados && p.agregados.length > 0)) {
      setModProducto(p);
      return;
    }
    setPedido((arr) => [
      ...arr,
      { id: p.id, nombre: p.nombre, qty: 1, precio: p.precio, mods: [], enviado: false },
    ]);
  };

  const onAddFromSheet = (item: AddItemInput) => {
    setPedido((arr) => [
      ...arr,
      { id: item.id, nombre: item.nombre, qty: item.qty, precio: item.precio, mods: item.mods, enviado: false },
    ]);
    setModProducto(null);
  };

  const [enviadoFlash, setEnviadoFlash] = useState<string | null>(null);
  const enviarACocina = () => {
    if (sinEnviar.length === 0) return;
    const order = addKitchenOrder({
      origen: "mesa",
      mesa: 5,
      mozo: "M. Cruz",
      items: sinEnviar.map((i) => ({ nombre: i.nombre, qty: i.qty, mods: i.mods })),
    });
    setPedido((arr) => arr.map((i) => (i.enviado ? i : { ...i, enviado: true })));
    setEnviadoFlash(order.id);
    setTimeout(() => setEnviadoFlash(null), 2400);
  };

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Subhead con info de mesa */}
      <div className="flex items-center gap-3 px-5 h-14 border-b bg-card">
        <Button variant="ghost" size="sm" onClick={() => setShowMap(true)} className="h-10">
          <ArrowLeft size={16} /> Salón
        </Button>
        <div className="flex flex-col">
          <span className="text-xl font-black leading-tight">Mesa 5</span>
          <span className="text-[11px] text-muted-foreground">4 sillas · abierta 20:30 · M. Cruz</span>
        </div>
        <span className="ml-2 inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 text-[11px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-current" /> Ocupada
        </span>

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => setShowMap(true)}>
          <Store size={14} /> Cambiar de mesa
        </Button>
        <Button variant="outline" size="sm">
          <Users size={14} /> Comensales: 4
        </Button>
        <Button variant="ghost" size="icon" aria-label="Más">
          <MoreHorizontal />
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-0">
        {/* Catálogo */}
        <section className="flex flex-col min-w-0 border-r">
          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar producto…"
                className="pl-9 h-11"
              />
            </div>
          </div>

          <div className="px-5 pt-2 pb-3 flex gap-2 overflow-x-auto scroll-y">
            {categorias.map((c) => {
              const active = c.id === cat && !q;
              return (
                <button
                  key={c.id}
                  onClick={() => { setCat(c.id); setQ(""); }}
                  className={
                    "shrink-0 inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full border text-sm transition " +
                    (active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted")
                  }
                >
                  <span className="text-base leading-none">{c.icon}</span>
                  <span className="font-medium">{c.nombre}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto scroll-y px-5 pb-5">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
            >
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onTapProducto(p)}
                  className="flex flex-col text-left rounded-xl border bg-card hover:border-primary hover:shadow-md p-3 gap-1 transition"
                >
                  <div className="text-[10px] tabular text-muted-foreground">{p.id}</div>
                  <div className="text-sm font-semibold leading-snug line-clamp-2">{p.nombre}</div>
                  {p.desc && (
                    <div className="text-xs text-muted-foreground leading-snug line-clamp-2">{p.desc}</div>
                  )}
                  <div className="flex items-center justify-between gap-1 mt-auto pt-2">
                    <span className="tabular text-sm font-bold">{fmtAR(p.precio)}</span>
                    {(p.sizes || p.modifs) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold uppercase">
                        Opciones
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Pedido en curso */}
        <aside className="flex flex-col bg-card">
          <div className="px-5 h-14 flex items-center justify-between border-b">
            <div>
              <div className="font-bold">Pedido mesa 5</div>
              <div className="text-[11px] text-muted-foreground">
                {pedido.length} ítems · {sinEnviar.length} sin enviar
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-y">
            {pedido.length === 0 && (
              <div className="text-center text-muted-foreground py-12 px-6 text-sm">
                Tocá productos para agregarlos
              </div>
            )}
            {pedido.map((i, idx) => (
              <div
                key={idx}
                className={"flex items-start gap-3 px-5 py-3 border-b " + (i.enviado ? "opacity-60" : "")}
              >
                <span className="tabular w-6 shrink-0 font-bold text-sm">{i.qty}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-snug">
                    <span className="tabular text-xs text-muted-foreground mr-1.5">{i.id}</span>
                    {i.nombre}
                  </div>
                  {i.mods.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">{i.mods.join(" · ")}</div>
                  )}
                  {i.enviado && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                      <Check size={10} /> enviado a cocina
                    </div>
                  )}
                </div>
                <span className="tabular text-sm font-bold shrink-0">{fmtAR(i.precio * i.qty)}</span>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular">{fmtAR(subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>Total mesa</span>
              <span className="tabular">{fmtAR(subtotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1.6fr] gap-2 p-3 border-t">
            <Button variant="outline" size="lg" className="h-12">
              <ReceiptText /> Pedir cuenta
            </Button>
            <Button
              size="lg"
              className="h-12 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
              onClick={enviarACocina}
              disabled={sinEnviar.length === 0}
            >
              {enviadoFlash ? (
                <><Check /> Enviado · {enviadoFlash}</>
              ) : (
                <><Check /> Enviar a cocina ({sinEnviar.length})</>
              )}
            </Button>
          </div>
        </aside>
      </div>

      <ModificadoresSheet
        producto={modProducto}
        onClose={() => setModProducto(null)}
        onAdd={onAddFromSheet}
      />

      <Sheet open={showMap} onOpenChange={setShowMap}>
        <SheetContent side="bottom" className="max-h-[92vh]">
          <SheetHeader className="text-left mb-4">
            <SheetTitle>Mapa de salón · cambiar mesa</SheetTitle>
          </SheetHeader>
          <MiniMapa mesas={mesas} mesaActiva={5} onPick={() => setShowMap(false)} />
        </SheetContent>
      </Sheet>
    </main>
  );
}

function MiniMapa({ mesas, mesaActiva, onPick }: { mesas: Mesa[]; mesaActiva: number; onPick: (id: number) => void }) {
  const W = 1380, H = 940;
  const [scale, setScale] = useState(1);
  const wrapRef = (el: HTMLDivElement | null) => {
    if (el && scale === 1) {
      const w = el.clientWidth;
      setScale(Math.min(w / W, 0.45));
    }
  };

  return (
    <div ref={wrapRef} className="overflow-hidden bg-muted/30 rounded-lg p-3">
      <div className="relative origin-top-left" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {mesas.map((m) => {
          const c = estadoMiniColor[m.estado];
          const activa = m.id === mesaActiva;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className="absolute flex flex-col items-center justify-center font-black"
              style={{
                left: m.x, top: m.y, width: m.w, height: m.h,
                background: c.fill,
                border: `${activa ? 4 : 3}px solid ${activa ? "var(--foreground)" : c.stroke}`,
                borderRadius: m.tipo === "alta" ? "50%" : 12,
                color: "var(--foreground)",
              }}
            >
              <div className="text-4xl leading-none">{m.id}</div>
              {(m.total ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground mt-1">{fmtAR(m.total ?? 0)}</div>
              )}
              {activa && <div className="text-[10px] mt-1 font-bold text-amber-600">ACTIVA</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
