"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Printer, Check, Wallet, CreditCard, QrCode, Banknote, Send,
  Plus, Trash2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtAR } from "@/lib/format";

interface POSItem {
  id: string;
  nombre: string;
  qty: number;
  precio: number;
  mods: string[];
}

const FALLBACK_ITEMS: POSItem[] = [
  { id: "030002", qty: 2, nombre: "1/2 Pinta Clásica", precio: 4000, mods: [] },
  { id: "130020", qty: 1, nombre: "Desembarco", precio: 21800, mods: ["Sin cebolla", "Cocción jugosa"] },
  { id: "140012", qty: 1, nombre: "Papas Desembarco", precio: 13400, mods: [] },
  { id: "140002", qty: 1, nombre: "Picada para dos", precio: 33000, mods: [] },
  { id: "140004", qty: 2, nombre: "Triángulos de muzzarella", precio: 16400, mods: [] },
  { id: "150003", qty: 1, nombre: "Mila Napolitana (Carne)", precio: 25400, mods: [] },
  { id: "130001", qty: 1, nombre: "Bajoncito", precio: 14000, mods: [] },
];

type Pago = "efectivo" | "debito" | "credito" | "mp" | "modo";
const PAGO_LABEL: Record<Pago, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  mp: "Mercado Pago",
  modo: "Modo / Transfer",
};
const PAGO_ICON: Record<Pago, React.ComponentType<{ size?: number; className?: string }>> = {
  efectivo: Banknote, debito: CreditCard, credito: CreditCard, mp: QrCode, modo: Wallet,
};
const PAGOS_LIST: Pago[] = ["efectivo", "debito", "credito", "mp", "modo"];

type SplitMode = "single" | "personas" | "metodos";

interface Split {
  /** id local para el key de React */
  uid: number;
  /** monto en pesos enteros */
  amount: number;
  method: Pago;
}

let _uid = 0;
const newUid = () => ++_uid;

export function CobroScreen() {
  const router = useRouter();
  const [items, setItems] = useState<POSItem[]>(FALLBACK_ITEMS);
  const [fromPOS, setFromPOS] = useState(false);
  const [propina, setPropina] = useState(10);

  const [mode, setMode] = useState<SplitMode>("single");
  const [partes, setPartes] = useState(1);
  const [pagoUnico, setPagoUnico] = useState<Pago>("efectivo");
  const [splits, setSplits] = useState<Split[]>([{ uid: newUid(), amount: 0, method: "efectivo" }]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pos-cobrar");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setItems(parsed.items);
          setFromPOS(true);
        }
      }
    } catch {}
  }, []);

  const subtotal = items.reduce((s, i) => s + i.qty * i.precio, 0);
  const servicio = Math.round(subtotal * 0.10);
  const total = subtotal + servicio;
  const propinaMonto = Math.round(subtotal * propina / 100);
  const totalConPropina = total + propinaMonto;
  const porParte = partes > 0 ? Math.round(totalConPropina / partes) : 0;

  // Suma de splits y diferencia con el total a cobrar
  const sumSplits = useMemo(() => splits.reduce((s, x) => s + (x.amount || 0), 0), [splits]);
  const restante = totalConPropina - sumSplits;
  const splitsBalanced = restante === 0 && splits.every((s) => s.amount > 0);

  // Cuando entra a modo "métodos" por primera vez: pre-llena con efectivo + restante
  useEffect(() => {
    if (mode === "metodos" && splits.length === 1 && splits[0].amount === 0) {
      setSplits([
        { uid: newUid(), amount: Math.round(totalConPropina / 2), method: "efectivo" },
        { uid: newUid(), amount: totalConPropina - Math.round(totalConPropina / 2), method: "debito" },
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const addSplit = () => {
    setSplits((s) => [...s, { uid: newUid(), amount: Math.max(0, restante), method: "efectivo" }]);
  };
  const removeSplit = (uid: number) => {
    setSplits((s) => (s.length > 1 ? s.filter((x) => x.uid !== uid) : s));
  };
  const updateSplit = (uid: number, patch: Partial<Split>) => {
    setSplits((s) => s.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));
  };
  /** Distribuye automáticamente lo restante entre las partes vacías o todas */
  const balancearSplits = () => {
    const n = splits.length;
    if (n === 0) return;
    const base = Math.floor(totalConPropina / n);
    const resto = totalConPropina - base * n;
    setSplits((s) =>
      s.map((x, i) => ({ ...x, amount: base + (i === 0 ? resto : 0) }))
    );
  };

  const origenLabel = fromPOS ? "Mostrador #1042" : "Mesa 12";
  const itemsCount = items.reduce((s, i) => s + i.qty, 0);

  const confirmar = () => {
    if (fromPOS) {
      try {
        localStorage.removeItem("pos-cobrar");
        localStorage.removeItem("pos-ticket-v1");
      } catch {}
    }
    let detalle = "";
    if (mode === "metodos") {
      detalle =
        "\n\nSplits:\n" +
        splits
          .map((s, i) => `  Parte ${i + 1}: ${PAGO_LABEL[s.method]} · ${fmtAR(s.amount)}`)
          .join("\n");
    } else if (mode === "personas") {
      detalle = `\n${partes} partes de ${fmtAR(porParte)} c/u con ${PAGO_LABEL[pagoUnico]}`;
    } else {
      detalle = `\n${PAGO_LABEL[pagoUnico]}`;
    }
    alert(`Cobro confirmado · ${fmtAR(totalConPropina)}${detalle}`);
    router.push(fromPOS ? "/pos" : "/salon");
  };

  const canConfirm =
    mode === "single" ? true :
    mode === "personas" ? partes >= 1 :
    splitsBalanced;

  return (
    <main className="flex-1 overflow-y-auto scroll-y bg-background">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={16} /> {origenLabel}
          </Button>
          <h1 className="text-2xl font-bold">Cerrar cuenta</h1>
          <span className="ml-2 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 font-medium">
            {fromPOS ? `${itemsCount} ítems · pedido del POS` : "M. Cruz · 4 comensales · 1h 24m"}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr_400px] gap-5">
          {/* ============= Ticket preview ============= */}
          <div className="rounded-xl bg-white dark:bg-stone-100 dark:text-stone-900 border p-6 shadow-sm font-mono text-sm">
            <div className="text-center pb-4 border-b border-dashed border-stone-300">
              <div className="text-2xl font-black tracking-tight">EL DESEMBARCO</div>
              <div className="text-[11px] text-stone-500 mt-1">cervecería · cocina</div>
              <div className="text-[10px] text-stone-500 mt-2">
                Av. Cabildo 2890 · CABA<br />CUIT 30-71234567-8
              </div>
            </div>
            <div className="py-3 text-[11px] text-stone-600 leading-relaxed">
              <div>{fromPOS ? "Mostrador · take-away" : "Mesa 12 · 4 cubiertos"}</div>
              <div>Mozo: M. Cruz</div>
              <div>4/5/2026 · 21:24</div>
            </div>
            <div className="border-t border-dashed border-stone-300 py-3 space-y-1.5">
              {items.map((i, k) => (
                <div key={k} className="flex gap-2 text-xs">
                  <span className="tabular w-6 shrink-0">{i.qty}×</span>
                  <div className="flex-1 min-w-0">
                    <div>{i.nombre}</div>
                    {i.mods.length > 0 && (
                      <div className="text-[10px] text-stone-500 italic">{i.mods.join(", ")}</div>
                    )}
                  </div>
                  <span className="tabular shrink-0">{fmtAR(i.qty * i.precio)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-stone-300 pt-3 space-y-1 text-xs">
              <Row k="Subtotal" v={fmtAR(subtotal)} />
              <Row k="Servicio (10%)" v={fmtAR(servicio)} />
              <div className="flex justify-between font-black text-base pt-2 border-t border-stone-300 mt-2">
                <span>TOTAL</span>
                <span className="tabular">{fmtAR(total)}</span>
              </div>
            </div>
            <div className="text-center text-[10px] text-stone-500 mt-4 pt-3 border-t border-dashed border-stone-300">
              ¡Gracias por elegirnos!<br />www.eldesembarco.com.ar
            </div>
          </div>

          {/* ============= Centro: dividir + propina ============= */}
          <div className="space-y-5">
            {/* Modo de cobro */}
            <div className="rounded-xl bg-card border p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Cómo se paga
              </div>
              <div className="grid grid-cols-3 gap-2 p-1 bg-muted rounded-lg mb-4">
                <ModeBtn active={mode === "single"} onClick={() => setMode("single")} icon={<Banknote size={14} />}>
                  Un solo pago
                </ModeBtn>
                <ModeBtn active={mode === "personas"} onClick={() => setMode("personas")} icon={<Users size={14} />}>
                  Dividir igual
                </ModeBtn>
                <ModeBtn active={mode === "metodos"} onClick={() => setMode("metodos")} icon={<CreditCard size={14} />}>
                  Por método
                </ModeBtn>
              </div>

              {mode === "single" && (
                <div className="text-sm text-muted-foreground">
                  Una sola transacción de <strong className="text-foreground">{fmtAR(totalConPropina)}</strong>{" "}
                  con el método elegido a la derecha.
                </div>
              )}

              {mode === "personas" && (
                <>
                  <div className="text-xs text-muted-foreground mb-2">Cuántas personas pagan</div>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPartes(p)}
                        className={
                          "h-14 rounded-md border font-bold text-lg transition " +
                          (partes === p ? "border-primary bg-accent" : "hover:bg-muted")
                        }
                      >
                        {p === 5 ? "5+" : p}
                      </button>
                    ))}
                  </div>
                  {partes > 1 && (
                    <div className="px-3 py-2 bg-muted rounded text-sm flex justify-between">
                      <span className="text-muted-foreground">Cada uno paga</span>
                      <span className="tabular font-bold">{fmtAR(porParte)}</span>
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Todos pagan con el mismo método (elegir a la derecha).
                  </div>
                </>
              )}

              {mode === "metodos" && (
                <>
                  <div className="text-xs text-muted-foreground mb-2">
                    Definí cuánto paga cada uno y con qué método. Útil cuando el grupo divide distinto
                    (ej. uno en efectivo, otro en débito).
                  </div>
                  <div className="space-y-2">
                    {splits.map((s, idx) => (
                      <div key={s.uid} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <select
                          value={s.method}
                          onChange={(e) => updateSplit(s.uid, { method: e.target.value as Pago })}
                          className="h-9 px-2 rounded border bg-background text-sm w-[140px]"
                        >
                          {PAGOS_LIST.map((p) => (
                            <option key={p} value={p}>{PAGO_LABEL[p]}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-sm text-muted-foreground">$</span>
                          <input
                            type="number"
                            min={0}
                            step={100}
                            value={s.amount || ""}
                            onChange={(e) => updateSplit(s.uid, { amount: Number(e.target.value) || 0 })}
                            className="h-9 px-2 rounded border bg-background text-sm tabular w-full text-right font-semibold"
                            placeholder="0"
                          />
                        </div>
                        <button
                          onClick={() => removeSplit(s.uid)}
                          disabled={splits.length === 1}
                          className="w-8 h-8 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center shrink-0"
                          aria-label="Quitar parte"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm" onClick={addSplit} className="flex-1">
                      <Plus size={14} /> Agregar parte
                    </Button>
                    <Button variant="outline" size="sm" onClick={balancearSplits} className="flex-1">
                      Balancear
                    </Button>
                  </div>
                  <div
                    className={
                      "mt-3 px-3 py-2 rounded text-sm flex items-center justify-between " +
                      (splitsBalanced
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100"
                        : restante > 0
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
                        : "bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100")
                    }
                  >
                    <span className="font-semibold">
                      {splitsBalanced
                        ? "✓ Cuadra"
                        : restante > 0
                        ? `Falta asignar`
                        : "Excede el total"}
                    </span>
                    <span className="tabular font-bold">
                      {fmtAR(sumSplits)} / {fmtAR(totalConPropina)}
                      {restante !== 0 && ` (${restante > 0 ? "−" : "+"}${fmtAR(Math.abs(restante))})`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Propina */}
            <div className="rounded-xl bg-card border p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                Propina sugerida
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[0, 5, 10, 15, 20].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPropina(p)}
                    className={
                      "h-14 rounded-md border font-bold transition " +
                      (propina === p ? "border-primary bg-accent" : "hover:bg-muted")
                    }
                  >
                    {p === 0 ? "Sin" : `${p}%`}
                  </button>
                ))}
              </div>
              {propina > 0 && (
                <div className="mt-3 px-3 py-2 bg-muted rounded text-sm flex justify-between">
                  <span className="text-muted-foreground">Propina ({propina}%)</span>
                  <span className="tabular font-bold">{fmtAR(propinaMonto)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ============= Métodos / Confirmación ============= */}
          <div className="rounded-xl bg-card border p-5 flex flex-col">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              {mode === "metodos" ? "Resumen de splits" : "Método de pago"}
            </div>

            {mode !== "metodos" ? (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PAGOS_LIST.map((k) => {
                  const Icon = PAGO_ICON[k];
                  const active = pagoUnico === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setPagoUnico(k)}
                      className={
                        "flex flex-col items-center justify-center gap-1.5 h-20 rounded-md border transition " +
                        (active ? "border-primary bg-accent text-foreground" : "hover:bg-muted")
                      }
                    >
                      <Icon size={22} className="opacity-80" />
                      <span className="text-xs font-semibold">{PAGO_LABEL[k]}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5 mb-4">
                {splits.map((s, idx) => {
                  const Icon = PAGO_ICON[s.method];
                  return (
                    <div key={s.uid} className="flex items-center gap-2 px-3 py-2 rounded border bg-muted/30 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <Icon size={14} className="opacity-70 shrink-0" />
                      <span className="flex-1 truncate">{PAGO_LABEL[s.method]}</span>
                      <span className="tabular font-semibold">{fmtAR(s.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t pt-4 mt-auto space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular">{fmtAR(total)}</span>
              </div>
              {propina > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Propina ({propina}%)</span>
                  <span className="tabular">{fmtAR(propinaMonto)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t">
                <span className="text-sm">Total a cobrar</span>
                <span className="tabular text-2xl font-black text-foreground">
                  {fmtAR(totalConPropina)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <Button variant="outline" size="lg" className="h-12">
                <Printer /> Pre-cuenta
              </Button>
              <Button
                size="lg"
                className="h-12 col-span-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold disabled:opacity-50"
                onClick={confirmar}
                disabled={!canConfirm}
              >
                <Check /> Confirmar cobro
              </Button>
            </div>
            {!canConfirm && mode === "metodos" && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-2 text-center">
                Ajustá los montos para que sumen exactamente {fmtAR(totalConPropina)}
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground">
              <Send size={14} /> Enviar ticket por WhatsApp / Email
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-stone-600">
      <span>{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}

function ModeBtn({
  active, onClick, icon, children,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center justify-center gap-1.5 h-9 rounded text-xs font-semibold transition " +
        (active ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
