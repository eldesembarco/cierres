"use client";

import { useState, useMemo } from "react";
import { Search, Check, Printer, Bike, ReceiptText, Minus, Plus, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inboxApps, APP_LABEL, type App, type EstadoPedido, type PedidoApp } from "@/lib/data";
import { fmtAR, tiempoDesde } from "@/lib/format";
import { ComandaModal } from "./ComandaModal";
import { ReadyButton } from "./ReadyButton";
import {
  usePYOrders,
  simulatePYOrder,
  simulateRappiOrder,
  acceptPYOrder,
  rejectPYOrder,
  readyPYOrder,
  clearPYOrders,
} from "@/lib/py/use-py-orders";
import type { StoredOrder, PYOrderStateLocal } from "@/lib/py/types";
import { addKitchenOrder } from "@/lib/kitchen-orders";

const ACTIVOS: EstadoPedido[] = ["nuevo", "preparacion", "listo"];

const PY_TO_ESTADO: Record<PYOrderStateLocal, EstadoPedido> = {
  received: "nuevo",
  accepted: "preparacion",
  preparing: "preparacion",
  ready: "listo",
  picked_up: "entregado",
  completed: "entregado",
  rejected: "cancelado",
  cancelled: "cancelado",
};

/** Tipo extendido del PedidoApp para info live: cobro al rider, comentarios, timing, etc. */
type LivePedidoApp = PedidoApp & {
  __real?: true;
  __cashCollect?: number;     // > 0 si hay que cobrarle efectivo al rider (solo PY)
  __customerComment?: string;
  __acceptedAt?: number;      // ms timestamp cuando lo aceptamos (para gating Marcar Listo)
  __prepTimeMin?: number;     // minutos de prep que prometimos al aceptar
};

function fmtPrice(n: number): string {
  if (!n || Number.isNaN(n)) return "";
  return "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Adapta un pedido (PY o Rappi) al shape PedidoApp para reusar la UI. */
function storedOrderToPedidoApp(o: StoredOrder): LivePedidoApp {
  if (o.app === "pedidosya") {
    const items = (o.raw.products ?? []).map((p) => {
      const mods: string[] = [];
      // Toppings/agregados con precio cuando aplica
      for (const t of p.selectedToppings ?? []) {
        const tp = Number(t.price ?? 0);
        const qty = Number(t.quantity ?? 1);
        const label = t.name + (qty > 1 ? ` ×${qty}` : "");
        mods.push(tp > 0 ? `${label} +${fmtPrice(tp * qty)}` : label);
      }
      // Comentario del cliente sobre el item
      if (p.comment) mods.push(`📝 ${p.comment}`);
      return {
        nombre: p.name ?? "—",
        qty: Number(p.quantity ?? 1),
        precio: Number(p.paidPrice ?? 0),
        mods: mods.length ? mods : undefined,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.precio * i.qty, 0);
    type PYRawExtra = { price?: { collectFromCustomer?: string }; comments?: { customerComment?: string } };
    const ex = o.raw as PYRawExtra;
    const collect = Number(ex.price?.collectFromCustomer ?? 0);
    return {
      id: o.id,
      app: "pedidosya",
      cliente: [o.raw.customer?.firstName, o.raw.customer?.lastName].filter(Boolean).join(" ") || "—",
      hora: new Date(o.receivedAt).toTimeString().slice(0, 5),
      estado: PY_TO_ESTADO[o.state],
      pago: o.raw.payment?.type ?? "ONLINE",
      dir: [o.raw.delivery?.address?.street, o.raw.delivery?.address?.number, o.raw.delivery?.address?.city]
        .filter(Boolean).join(", ") || "—",
      items,
      subtotal,
      descVendor: 0,
      descApp: 0,
      total: Number(o.raw.price?.totalGross ?? subtotal),
      __real: true,
      __cashCollect: collect > 0 ? collect : undefined,
      __customerComment: ex.comments?.customerComment,
      __acceptedAt: o.acceptedAt,
      __prepTimeMin: o.prepTimeMin,
    };
  }
  // Rappi: la doc oficial usa `subitems[]` (no toppings) — incluye toppings + variaciones + bebidas
  type RappiSubitem = { name?: string; quantity?: number | string; price?: number | string; type?: string; sku?: string };
  type RappiItem = {
    name?: string; quantity?: number | string; price?: number | string; comments?: string;
    subitems?: RappiSubitem[];
    toppings?: RappiSubitem[];   // fallback por si llega así
  };
  type RappiAddr = { street_name?: string; street_number?: string; district?: string; complement?: string };
  type RappiUser = { name?: string; last_name?: string };
  type RappiRaw = {
    items?: RappiItem[]; user?: RappiUser; address?: RappiAddr;
    payment_method?: string; total_value?: number | string;
    comments?: string;
  };
  const r = (o.raw ?? {}) as RappiRaw;
  const items = (r.items ?? []).map((p) => {
    const mods: string[] = [];
    const subs = p.subitems ?? p.toppings ?? [];
    for (const s of subs) {
      const sp = Number(s.price ?? 0);
      const qty = Number(s.quantity ?? 1);
      const label = (s.name ?? "—") + (qty > 1 ? ` ×${qty}` : "");
      mods.push(sp > 0 ? `${label} +${fmtPrice(sp * qty)}` : label);
    }
    if (p.comments) mods.push(`📝 ${p.comments}`);
    return {
      nombre: p.name ?? "—",
      qty: Number(p.quantity ?? 1),
      precio: Number(p.price ?? 0),
      mods: mods.length ? mods : undefined,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.precio * i.qty, 0);
  return {
    id: o.id,
    app: "rappi",
    cliente: [r.user?.name, r.user?.last_name].filter(Boolean).join(" ") || "—",
    hora: new Date(o.receivedAt).toTimeString().slice(0, 5),
    estado: PY_TO_ESTADO[o.state],
    pago: r.payment_method ?? "online",
    dir: [r.address?.street_name, r.address?.street_number, r.address?.district, r.address?.complement]
      .filter(Boolean).join(", ") || "—",
    items,
    subtotal,
    descVendor: 0,
    descApp: 0,
    total: Number(r.total_value ?? subtotal),
    __real: true,
    // En Rappi NUNCA se cobra al repartidor (decisión del usuario)
    __cashCollect: undefined,
    __customerComment: r.comments,
    __acceptedAt: o.acceptedAt,
    __prepTimeMin: o.prepTimeMin,
  };
}

const appColor: Record<App | "all", string> = {
  all: "var(--foreground)",
  pedidosya: "var(--color-app-pedidosya)",
  rappi: "var(--color-app-rappi)",
  mp: "var(--color-app-mp)",
};

const estadoStyle: Record<EstadoPedido, { cls: string; label: string }> = {
  nuevo:       { cls: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",       label: "Nuevo" },
  preparacion: { cls: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200", label: "Preparando" },
  listo:       { cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200", label: "Listo" },
  entregado:   { cls: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",  label: "Entregado" },
  cancelado:   { cls: "bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-500 line-through", label: "Cancelado" },
};

export function AppsScreen() {
  const [vista, setVista] = useState<"activos" | "historial">("activos");
  const [filtro, setFiltro] = useState<App | "all">("all");
  const [sel, setSel] = useState<string>("PY-8821");
  const [comanda, setComanda] = useState<PedidoApp | null>(null);
  const [overrides, setOverrides] = useState<Record<string, EstadoPedido>>({});
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // pedidos reales del server (polling cada 4s)
  const { orders: realOrders, refresh: refreshReal } = usePYOrders();

  const realPedidos = useMemo(() => realOrders.map(storedOrderToPedidoApp), [realOrders]);

  const view = useMemo(() => {
    const demo = inboxApps.map((p) => (overrides[p.id] ? { ...p, estado: overrides[p.id] } : p));
    // los reales arriba, demo abajo
    return [...realPedidos, ...demo];
  }, [overrides, realPedidos]);

  const activos = view.filter((p) => ACTIVOS.includes(p.estado));
  const historial = view.filter((p) => !ACTIVOS.includes(p.estado));
  const fuente = vista === "activos" ? activos : historial;
  const list = filtro === "all" ? fuente : fuente.filter((p) => p.app === filtro);
  const selDetail = view.find((p) => p.id === sel) ?? list[0];

  const isReal = (p: PedidoApp) => (p as PedidoApp & { __real?: true }).__real === true;

  const showToast = (text: string) => {
    const ts = Date.now();
    setToast({ id: ts, text });
    setTimeout(() => setToast((t) => (t?.id === ts ? null : t)), 2200);
  };

  const setEstado = (id: string, next: EstadoPedido, label: string) => {
    setOverrides((o) => ({ ...o, [id]: next }));
    showToast(label);
  };

  const onSimular = async (app: "pedidosya" | "rappi" = "pedidosya") => {
    setBusy("sim");
    const order = app === "pedidosya" ? await simulatePYOrder() : await simulateRappiOrder();
    setBusy(null);
    if (order) {
      setSel(order.id);
      showToast(`Pedido ${app === "pedidosya" ? "PY" : "Rappi"} · ${order.id}`);
      refreshReal();
    } else {
      showToast(`Error simulando ${app}`);
    }
  };

  const onLimpiar = async () => {
    if (!confirm("Borrar TODOS los pedidos PY persistidos en el server?")) return;
    await clearPYOrders();
    refreshReal();
    showToast("Pedidos PY limpiados");
  };

  const filtros: { key: App | "all"; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pedidosya", label: "PedidosYa" },
    { key: "rappi", label: "Rappi" },
    { key: "mp", label: "MP Envíos" },
  ];

  return (
    <main className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b">
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          {(["activos", "historial"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={
                "px-3 h-8 rounded text-sm font-semibold transition " +
                (vista === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {v === "activos" ? "Activos" : "Historial"}
              <span className={"ml-1.5 text-[10px] tabular " + (vista === v ? "text-muted-foreground" : "")}>
                {v === "activos" ? activos.length : historial.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 ml-2">
          {filtros.map((f) => {
            const count = (fuente.filter((p) => f.key === "all" || p.app === f.key)).length;
            const active = filtro === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                style={{ borderColor: active ? appColor[f.key] : undefined, color: active ? appColor[f.key] : undefined }}
                className={
                  "px-2.5 h-8 rounded-full border text-xs font-medium transition flex items-center gap-1.5 " +
                  (active ? "bg-card font-semibold" : "hover:bg-muted")
                }
              >
                <span>{f.label}</span>
                <span className="tabular text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSimular("pedidosya")}
            disabled={busy === "sim"}
            className="border-pink-500/50 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-900/20"
            title="Simula un Dispatch Order de PedidosYa"
          >
            <Sparkles size={14} /> Sim PY
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSimular("rappi")}
            disabled={busy === "sim"}
            className="border-red-500/50 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Simula un NEW_ORDER de Rappi"
          >
            <Sparkles size={14} /> Sim Rappi
          </Button>
        </div>
        {realPedidos.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onLimpiar} title="Borrar pedidos PY persistidos">
            <RefreshCw size={14} /> Limpiar ({realPedidos.length})
          </Button>
        )}

        <div className="relative w-60">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Buscar por ID, cliente o producto…"
            className="w-full h-8 pl-8 pr-3 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* KPIs (solo activos) */}
      {vista === "activos" && (
        <div className="grid grid-cols-3 gap-px bg-border border-b">
          <Kpi value={activos.filter((p) => p.estado === "nuevo").length} label="Nuevos" />
          <Kpi value={activos.filter((p) => p.estado === "preparacion").length} label="Preparando" color="text-amber-600 dark:text-amber-400" />
          <Kpi value={activos.filter((p) => p.estado === "listo").length} label="Listos" color="text-emerald-600 dark:text-emerald-400" />
        </div>
      )}

      {/* Lista + detalle */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_460px] min-h-0">
        <div className="flex flex-col min-h-0 border-r">
          <div className="grid grid-cols-[120px_120px_1fr_2fr_110px] gap-2 px-4 h-9 items-center text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b bg-muted/50">
            <div>App</div>
            <div>ID · Hora</div>
            <div>Cliente</div>
            <div>Detalle</div>
            <div>Estado</div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-y">
            {list.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {vista === "historial" ? "Aún no hay pedidos cerrados." : "No hay pedidos activos."}
              </div>
            )}
            {list.map((p) => (
              <PedidoRow
                key={p.id}
                p={p}
                selected={p.id === sel}
                onClick={() => setSel(p.id)}
              />
            ))}
          </div>
        </div>

        <div className="overflow-y-auto scroll-y bg-card">
          {selDetail && (
            <PedidoDetail
              p={selDetail}
              onComanda={() => setComanda(selDetail)}
              onAceptar={async (p) => {
                if (isReal(p)) {
                  setBusy(p.id);
                  const ok = await acceptPYOrder(p.id, 25);
                  setBusy(null);
                  if (ok) {
                    showToast(`Aceptado · ${p.id}`);
                    refreshReal();
                    setComanda(p);
                    // pushear al KDS con el origen correcto
                    addKitchenOrder({
                      origen: p.app === "rappi" ? "rappi" : "pedidosya",
                      cliente: p.cliente,
                      items: p.items.map((i) => ({ nombre: i.nombre, qty: i.qty, mods: i.mods })),
                    });
                  } else {
                    showToast(`Error aceptando · ${p.id}`);
                  }
                } else {
                  setEstado(p.id, "preparacion", `Aceptado · ${p.id}`);
                  setComanda(p);
                }
              }}
              onMarcarListo={async (p) => {
                if (isReal(p)) {
                  setBusy(p.id);
                  const ok = await readyPYOrder(p.id);
                  setBusy(null);
                  showToast(ok ? `Listo · ${p.id}` : `Error · ${p.id}`);
                  if (ok) refreshReal();
                } else {
                  setEstado(p.id, "listo", `Listo para retirar · ${p.id}`);
                }
              }}
              onEntregar={(p) => {
                // entregar al cadete: PY se entera por su lado cuando el rider toca el botón;
                // localmente solo marcamos como entregado para limpiar la UI
                setEstado(p.id, "entregado", `Entregado al cadete · ${p.id}`);
              }}
              onRechazar={async (p) => {
                if (isReal(p)) {
                  setBusy(p.id);
                  const ok = await rejectPYOrder(p.id, "OTHER", "Rechazado desde POS");
                  setBusy(null);
                  showToast(ok ? `Rechazado · ${p.id}` : `Error · ${p.id}`);
                  if (ok) refreshReal();
                } else {
                  setEstado(p.id, "cancelado", `Pedido rechazado · ${p.id}`);
                }
              }}
              busy={busy === selDetail?.id}
            />
          )}
        </div>
      </div>

      {comanda && <ComandaModal pedido={comanda} onClose={() => setComanda(null)} />}

      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2"
        >
          <Check size={16} /> {toast.text}
        </div>
      )}
    </main>
  );
}

function Kpi({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="bg-card px-5 py-3 flex items-center gap-3">
      <div className={"tabular text-3xl font-black " + (color ?? "")}>{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
    </div>
  );
}

function PedidoRow({ p, selected, onClick }: { p: PedidoApp; selected: boolean; onClick: () => void }) {
  const detalle = p.items.map((i) => `${i.qty}× ${i.nombre}`).join(" · ");
  const estado = estadoStyle[p.estado];
  const live = p as LivePedidoApp;
  const isReal = live.__real === true;
  const cashCollect: number = p.app === "pedidosya" ? (live.__cashCollect ?? 0) : 0;
  return (
    <button
      onClick={onClick}
      className={
        "w-full grid grid-cols-[120px_120px_1fr_2fr_110px] gap-2 px-4 h-14 items-center text-sm border-b text-left transition " +
        (selected ? "bg-accent" : "hover:bg-muted/50")
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1 h-6 rounded-full shrink-0" style={{ background: appColor[p.app] }} />
        <span className="text-xs font-bold truncate" style={{ color: appColor[p.app] }}>
          {APP_LABEL[p.app]}
        </span>
        {isReal && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500 text-black font-black tracking-widest">
            LIVE
          </span>
        )}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-bold text-xs tabular truncate">{p.id}</span>
        <span className="text-[10px] tabular text-muted-foreground">{p.hora}</span>
      </div>
      <div className="truncate">{p.cliente}</div>
      <div className="truncate text-xs text-muted-foreground" title={detalle}>{detalle}</div>
      <div className="flex items-center gap-1.5">
        <span className={"inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-[11px] font-medium " + estado.cls}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {estado.label}
        </span>
        {cashCollect > 0 && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 h-6 rounded-full text-[10px] font-black bg-amber-500 text-black animate-pulse"
            title={`Cobrar $${cashCollect.toLocaleString("es-AR")} al repartidor`}
          >
            💵
          </span>
        )}
      </div>
    </button>
  );
}

interface DetailProps {
  p: PedidoApp;
  onComanda: () => void;
  onAceptar: (p: PedidoApp) => void;
  onMarcarListo: (p: PedidoApp) => void;
  onEntregar: (p: PedidoApp) => void;
  onRechazar: (p: PedidoApp) => void;
  busy?: boolean;
}

function PedidoDetail({ p, onComanda, onAceptar, onMarcarListo, onEntregar, onRechazar, busy }: DetailProps) {
  const live = p as LivePedidoApp;
  const isReal = live.__real === true;
  const cashCollect = live.__cashCollect ?? 0;
  const customerComment = live.__customerComment;
  // Sólo PY usa cobro al rider; en Rappi/MP nunca se le cobra
  const showCashAlert = p.app === "pedidosya" && cashCollect > 0;
  const estado = estadoStyle[p.estado];
  return (
    <div className="p-5 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center px-2 h-7 rounded text-xs font-bold uppercase tracking-wider text-white"
            style={{ background: appColor[p.app] }}
          >
            {APP_LABEL[p.app]}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <div className="font-bold text-xl">Pedido {p.id}</div>
              {isReal && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-black font-black tracking-widest">
                  LIVE
                </span>
              )}
              {busy && <span className="text-xs text-muted-foreground animate-pulse">enviando…</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              Recibido {p.hora} · hace {tiempoDesde(p.hora)} min
            </div>
          </div>
        </div>
        <span className={"inline-flex items-center gap-1.5 px-2 h-6 rounded-full text-[11px] font-medium " + estado.cls}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {estado.label}
        </span>
      </div>

      {showCashAlert && (
        <div
          role="alert"
          className="flex items-start gap-3 p-3 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100"
        >
          <span className="text-2xl leading-none">💵</span>
          <div className="flex-1 min-w-0">
            <div className="font-black text-sm uppercase tracking-wider">⚠️ COBRAR AL REPARTIDOR</div>
            <div className="text-sm mt-0.5">
              El cliente pagó en efectivo. <strong>El rider tiene que entregarte <span className="tabular">{fmtAR(cashCollect)}</span></strong> al retirar.
            </div>
            <div className="text-[11px] mt-1 opacity-80">
              No entregues el pedido sin el efectivo en mano. PedidosYa NO te paga este monto si no se cobra.
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card label="Cliente" value={p.cliente} sub="+54 9 11 5234 8821" />
        <Card
          label="Pago"
          value={p.pago}
          sub={showCashAlert ? `Cobrar ${fmtAR(cashCollect)} al rider` : `✓ ${fmtAR(p.total)} acreditado`}
          subColor={showCashAlert ? "text-amber-700 dark:text-amber-300 font-bold" : "text-emerald-600 dark:text-emerald-400"}
        />
      </div>

      {customerComment && (
        <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-900/20 px-3 py-2 text-sm">
          <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-bold mr-2">
            Nota cliente:
          </span>
          {customerComment}
        </div>
      )}

      <div className="flex flex-col">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Items del pedido ({p.items.reduce((s, i) => s + i.qty, 0)})
        </div>
        <div className="rounded-lg border divide-y">
          {p.items.map((it, i) => (
            <div key={i} className="flex items-start gap-3 p-3 text-sm">
              <span className="tabular font-bold text-amber-600 dark:text-amber-400 w-7 shrink-0 pt-0.5">
                {it.qty}×
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{it.nombre}</div>
                {it.mods && it.mods.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {it.mods.map((m, k) => (
                      <li key={k} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-amber-600 dark:text-amber-400 font-bold shrink-0">+</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="tabular text-sm shrink-0 pt-0.5">{fmtAR(it.precio * it.qty)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 mt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular">{fmtAR(p.subtotal)}</span>
          </div>
          {p.descVendor !== 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Descuento de la casa</span>
              <span className="tabular">{fmtAR(p.descVendor)}</span>
            </div>
          )}
          {p.descApp !== 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{p.descApp < 0 ? `Descuento ${APP_LABEL[p.app]}` : `Recargo ${APP_LABEL[p.app]}`}</span>
              <span className="tabular">{(p.descApp > 0 ? "+" : "") + fmtAR(p.descApp)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t">
            <span>Total</span>
            <span className="tabular">{fmtAR(p.total)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        {p.estado === "nuevo" && (
          <>
            <Button variant="outline" size="lg" className="flex-1" onClick={() => onRechazar(p)}>
              Rechazar
            </Button>
            <div className="flex flex-col items-center gap-1 px-2 justify-center text-xs text-muted-foreground">
              Listo en
              <div className="flex items-center gap-1">
                <button className="w-6 h-6 rounded border hover:bg-muted flex items-center justify-center"><Minus size={12} /></button>
                <span className="tabular text-sm font-semibold w-14 text-center">25 min</span>
                <button className="w-6 h-6 rounded border hover:bg-muted flex items-center justify-center"><Plus size={12} /></button>
              </div>
            </div>
            <Button size="lg" className="flex-[2] bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => onAceptar(p)}>
              <Check /> Aceptar e imprimir comanda
            </Button>
          </>
        )}
        {p.estado === "preparacion" && (
          <>
            <Button variant="outline" size="lg" className="flex-1" onClick={onComanda}>
              <Printer /> Ver comanda
            </Button>
            <ReadyButton
              acceptedAt={(p as LivePedidoApp).__acceptedAt}
              prepTimeMin={(p as LivePedidoApp).__prepTimeMin}
              onClick={() => onMarcarListo(p)}
              busy={busy}
              className="flex-[2] h-11"
              label="Marcar como listo"
            />
          </>
        )}
        {p.estado === "listo" && (
          <>
            <Button variant="outline" size="lg" className="flex-1" onClick={onComanda}>
              <Printer /> Reimprimir
            </Button>
            <Button size="lg" className="flex-[2] bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => onEntregar(p)}>
              <Bike /> Entregado al cadete
            </Button>
          </>
        )}
        {(p.estado === "entregado" || p.estado === "cancelado") && (
          <>
            <Button variant="outline" size="lg" className="flex-1">
              <ReceiptText /> Comprobante
            </Button>
            <Button variant="outline" size="lg" className="flex-1" onClick={onComanda}>
              <Printer /> Reimprimir comanda
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="font-bold text-sm mt-0.5">{value}</div>
      {sub && <div className={"text-xs mt-1 " + (subColor ?? "text-muted-foreground")}>{sub}</div>}
    </div>
  );
}
