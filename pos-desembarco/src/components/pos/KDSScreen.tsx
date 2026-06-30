"use client";

import { useState, useMemo, useEffect } from "react";
import { Flame, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pedidosCocina, ORIGEN_LABEL, type EstadoPedido, type PedidoCocina } from "@/lib/data";
import { tiempoDesde } from "@/lib/format";
import { useKitchenOrders, minutosDesdeTs, type KitchenOrder } from "@/lib/kitchen-orders";
import { ReadyButton } from "./ReadyButton";

/**
 * Para el botón "Marcar listo" en cocina necesitamos un acceptedAt timestamp.
 * Si el pedido es "live" (vino del simulator/POS) usamos su `ts`; sino derivamos
 * desde el HH:MM `desde` asumiendo que es de hoy (cocina default).
 */
function getAcceptedAtMs(pedido: PedidoCocina | KitchenOrder, isLive?: boolean, ts?: number): number {
  if (isLive && ts) return ts;
  const [h, m] = pedido.desde.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return Date.now() - 10 * 60_000;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const FLOW: Record<EstadoPedido, EstadoPedido | undefined> = {
  nuevo: "preparacion",
  preparacion: "listo",
  listo: "entregado",
  entregado: undefined,
  cancelado: undefined,
};

const cols: { key: EstadoPedido; label: string; color: string }[] = [
  { key: "nuevo",       label: "Nuevos",         color: "var(--brand-rojo)" },
  { key: "preparacion", label: "En preparación", color: "var(--brand-amarillo)" },
  { key: "listo",       label: "Listos",         color: "var(--brand-bottle)" },
];

const stripeByOrigen: Record<string, string> = {
  mesa: "border-l-amber-500",
  pedidosya: "border-l-pink-500",
  rappi: "border-l-red-500",
  mp: "border-l-sky-500",
  propio: "border-l-emerald-700",
};

type ViewOrder = (PedidoCocina | KitchenOrder) & { __live?: boolean; __ts?: number; __isNewlyArrived?: boolean };

export function KDSScreen() {
  const [overrides, setOverrides] = useState<Record<string, EstadoPedido>>({});
  const [leaving, setLeaving] = useState<string | null>(null);
  const [live, liveActions] = useKitchenOrders();
  const [arrived, setArrived] = useState<Set<string>>(new Set());

  // Marcar pedidos vivos como "recién llegados" para animarlos
  useEffect(() => {
    const newest = live.find((o) => !arrived.has(o.id));
    if (!newest) return;
    setArrived((s) => new Set([...s, newest.id]));
    const t = setTimeout(() => {
      // sacar del set después de la animación
      setArrived((s) => { const ns = new Set(s); ns.delete(newest.id); return ns; });
    }, 1500);
    return () => clearTimeout(t);
  }, [live, arrived]);

  const view: ViewOrder[] = useMemo(() => {
    const staticView: ViewOrder[] = pedidosCocina
      .map((p) => (overrides[p.id] ? { ...p, estado: overrides[p.id] } : p))
      .filter((p) => p.estado !== "entregado");
    const liveView: ViewOrder[] = live.map((o) => ({
      ...o,
      __live: true,
      __ts: o.ts,
      __isNewlyArrived: arrived.has(o.id),
    }));
    return [...liveView, ...staticView]; // los recientes arriba
  }, [overrides, live, arrived]);

  const bump = (p: ViewOrder) => {
    const next = FLOW[p.estado];
    if (!next) return;
    if (next === "entregado") {
      setLeaving(p.id);
      setTimeout(() => {
        if (p.__live) liveActions.setEstado(p.id, "entregado");
        else setOverrides((o) => ({ ...o, [p.id]: "entregado" }));
        setLeaving(null);
      }, 220);
      return;
    }
    if (p.__live) liveActions.setEstado(p.id, next);
    else setOverrides((o) => ({ ...o, [p.id]: next }));
  };

  const liveCount = live.length;
  const [now, setNow] = useState("21:24");
  useEffect(() => {
    const tick = () => setNow(new Date().toTimeString().slice(0, 5));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 px-5 py-4 gap-4">
      <div className="flex items-center gap-6 text-sm">
        <Stat label="nuevos" color="var(--brand-rojo)" value={view.filter((p) => p.estado === "nuevo").length} />
        <Stat label="en prep" color="var(--brand-amarillo)" value={view.filter((p) => p.estado === "preparacion").length} />
        <Stat label="listos" color="var(--brand-bottle)" value={view.filter((p) => p.estado === "listo").length} />
        {liveCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {liveCount} simulado{liveCount > 1 ? "s" : ""}
            <button
              onClick={() => liveActions.clear()}
              className="ml-2 text-white/40 hover:text-white underline-offset-2 hover:underline"
            >
              limpiar
            </button>
          </div>
        )}
        <div className="flex-1" />
        <div className="tabular text-lg font-bold">{now}</div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {cols.map((col) => (
          <div key={col.key} className="flex flex-col rounded-lg bg-[#1a1714] border border-white/5 min-h-0">
            <div
              className="flex items-center gap-2 px-3 h-10 border-b border-white/5 border-t-2"
              style={{ borderTopColor: col.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
              <span className="text-xs font-bold uppercase tracking-wider">{col.label}</span>
              <span className="ml-auto tabular text-xs text-white/50">
                {view.filter((p) => p.estado === col.key).length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto scroll-y p-3 space-y-3">
              {view
                .filter((p) => p.estado === col.key)
                .map((p) => (
                  <KDSCard
                    key={p.id}
                    pedido={p}
                    onBump={() => bump(p)}
                    leaving={leaving === p.id}
                    arriving={p.__isNewlyArrived}
                    overrideMins={p.__live && p.__ts ? minutosDesdeTs(p.__ts) : undefined}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="tabular text-base font-bold">{value}</span>
      <span className="text-white/60 text-xs uppercase tracking-wider">{label}</span>
    </div>
  );
}

function KDSCard({ pedido, onBump, leaving, arriving, overrideMins }: { pedido: ViewOrder; onBump: () => void; leaving: boolean; arriving?: boolean; overrideMins?: number }) {
  const mins = overrideMins ?? tiempoDesde(pedido.desde);
  const isUrgent = mins >= 15;
  const isWarn = mins >= 8 && mins < 15;
  const stripe = stripeByOrigen[pedido.origen] ?? "border-l-stone-500";

  return (
    <div
      className={
        "rounded-lg bg-[#25201a] border border-white/8 border-l-[6px] flex flex-col transition relative " +
        stripe + " " +
        (leaving ? "opacity-0 scale-95 translate-x-5 pointer-events-none" : "opacity-100") + " " +
        (arriving ? "ring-2 ring-amber-400 animate-pulse" : "")
      }
      style={{ transitionDuration: "220ms" }}
    >
      {pedido.__live && (
        <span className="absolute -top-1.5 right-3 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 text-black">
          NUEVO
        </span>
      )}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <span
          className={
            "inline-flex items-center px-2 h-6 rounded text-[10px] font-bold uppercase tracking-wider " +
            (pedido.origen === "mesa" ? "bg-amber-500/20 text-amber-300" :
             pedido.origen === "pedidosya" ? "bg-pink-500/20 text-pink-300" :
             pedido.origen === "rappi" ? "bg-red-500/20 text-red-300" :
             pedido.origen === "mp" ? "bg-sky-500/20 text-sky-300" :
             "bg-emerald-700/20 text-emerald-300")
          }
        >
          {pedido.origen === "mesa"
            ? (pedido.mesa && pedido.mesa > 0 ? `MESA ${pedido.mesa}` : "MOSTRADOR")
            : ORIGEN_LABEL[pedido.origen]}
        </span>
        <span className="text-xs font-bold text-white/70">{pedido.id}</span>
        <span
          className={
            "ml-auto tabular text-2xl font-bold " +
            (isUrgent ? "text-red-400 animate-pulse" : isWarn ? "text-amber-300" : "text-white/80")
          }
        >
          {mins}&apos;
        </span>
      </div>
      <div className="px-3 text-xs text-white/50 mt-1.5 flex items-center justify-between">
        <span>{pedido.origen === "mesa" ? `Mozo: ${pedido.mozo ?? "—"}` : `Cliente: ${pedido.cliente ?? "—"}`}</span>
        <span className="tabular">{pedido.desde}</span>
      </div>
      <div className="px-3 py-3 border-t border-white/5 mt-2 flex flex-col gap-2">
        {pedido.items.map((it, i) => (
          <div key={i} className="flex gap-2 items-start text-sm">
            <span className="tabular font-bold text-amber-400 shrink-0 w-6">{it.qty}×</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium leading-snug">{it.nombre}</div>
              {it.mods && it.mods.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {it.mods.map((m, k) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/70">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 pt-2">
        {pedido.estado === "nuevo" && (
          <Button onClick={onBump} className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            <Flame size={16} /> Empezar a preparar
          </Button>
        )}
        {pedido.estado === "preparacion" && (
          <ReadyButton
            acceptedAt={getAcceptedAtMs(pedido, pedido.__live, pedido.__ts)}
            prepTimeMin={25}
            onClick={onBump}
            className="w-full h-11"
            label="Marcar listo"
          />
        )}
        {pedido.estado === "listo" && (
          <Button onClick={onBump} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
            <Check size={16} /> Entregado
          </Button>
        )}
      </div>
    </div>
  );
}
