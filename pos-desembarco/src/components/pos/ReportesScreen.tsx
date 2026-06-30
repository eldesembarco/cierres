"use client";

import { useEffect, useState } from "react";
import { Download, Printer, TrendingUp, Receipt, Users, DollarSign, RefreshCw, Database, MemoryStick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtAR } from "@/lib/format";

interface KpisData { facturado: number; tickets: number; ticketPromedio: number; propinas: number }
interface HourBucket { hour: number; total: number; tickets: number }
interface ChannelSlice { app: "pedidosya" | "rappi"; total: number; tickets: number }
interface TopProduct { name: string; qty: number; total: number }
interface PaymentSlice { method: string; total: number; tickets: number; pct: number }

interface ReportsResponse {
  mode: "postgres" | "memory";
  range: { fromMs: number; toMs: number };
  kpis: KpisData;
  byHour: HourBucket[];
  byChannel: ChannelSlice[];
  topProducts: TopProduct[];
  byPayment: PaymentSlice[];
}

const APP_LABEL: Record<string, { label: string; color: string }> = {
  pedidosya: { label: "PedidosYa", color: "#fa0050" },
  rappi: { label: "Rappi", color: "#ff1744" },
  mp: { label: "MP Envíos", color: "#00b1ea" },
  propio: { label: "Delivery propio", color: "#2e5d3f" },
  salon: { label: "Salón", color: "#f5a623" },
};

// Mozos y Caja siguen siendo mock por ahora (no vienen del POS interno todavía)
const MOZOS = [
  { nombre: "M. Cruz", tickets: 32, total: 678000 },
  { nombre: "L. Sosa", tickets: 28, total: 562000 },
  { nombre: "F. Diaz", tickets: 27, total: 502500 },
];

type PresetKey = "24h" | "7d" | "30d" | "today";

function presetRange(preset: PresetKey): { fromMs: number; toMs: number } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (preset) {
    case "today": {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: now };
    }
    case "7d": return { fromMs: now - 7 * day, toMs: now };
    case "30d": return { fromMs: now - 30 * day, toMs: now };
    case "24h":
    default: return { fromMs: now - day, toMs: now };
  }
}

export function ReportesScreen() {
  const [preset, setPreset] = useState<PresetKey>("24h");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const { fromMs, toMs } = presetRange(preset);
      const res = await fetch(`/api/reports?from=${fromMs}&to=${toMs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ReportsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const kpis = data?.kpis ?? { facturado: 0, tickets: 0, ticketPromedio: 0, propinas: 0 };
  const byHour = data?.byHour ?? [];
  const byChannel = data?.byChannel ?? [];
  const topProds = data?.topProducts ?? [];
  const pagos = data?.byPayment ?? [];

  const totalCanal = byChannel.reduce((s, c) => s + c.total, 0);
  const maxHora = Math.max(0, ...byHour.map((h) => h.total));
  const maxProd = Math.max(0, ...topProds.map((p) => p.total));

  // Caja deriva de KPIs
  const caja = {
    apertura: 50000,
    ventas: kpis.facturado,
    egresos: -38000,
    cierreEsperado: kpis.facturado + 50000 - 38000,
    arqueo: kpis.facturado + 50000 - 38000,
  };

  const presetLabel: Record<PresetKey, string> = {
    "24h": "Últimas 24h",
    today: "Hoy",
    "7d": "Últimos 7 días",
    "30d": "Últimos 30 días",
  };
  const empty = !loading && !error && data && data.kpis.tickets === 0;

  return (
    <main className="flex-1 overflow-y-auto scroll-y bg-background">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">Reportes</h1>
              {data?.mode === "postgres" && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold uppercase tracking-wider">
                  <Database size={10} /> POSTGRES
                </span>
              )}
              {data?.mode === "memory" && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold uppercase tracking-wider"
                  title="Sin Postgres configurado — datos solo de la instancia actual">
                  <MemoryStick size={10} /> MEMORIA
                </span>
              )}
              {loading && <span className="text-xs text-muted-foreground animate-pulse">cargando…</span>}
            </div>
            <div className="text-sm text-muted-foreground">
              {presetLabel[preset]}
              {data ? ` · ${new Date(data.range.fromMs).toLocaleString()} → ${new Date(data.range.toMs).toLocaleString()}` : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex p-1 bg-muted rounded-md gap-1">
              {(["24h", "today", "7d", "30d"] as PresetKey[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={
                    "px-2.5 h-7 text-xs font-semibold rounded transition " +
                    (preset === p ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {presetLabel[p]}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={14} /> {loading ? "..." : "Refresh"}
            </Button>
            <Button variant="outline" size="sm">
              <Download size={14} /> Exportar
            </Button>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold">
              <Printer size={14} /> Cierre Z
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200 text-sm">
            <strong>Error:</strong> {error}. <button onClick={refresh} className="underline">Reintentar</button>
          </div>
        )}

        {empty && (
          <div className="p-8 rounded-xl border-2 border-dashed text-center">
            <div className="text-4xl mb-2">📭</div>
            <div className="font-bold mb-1">No hay datos en este rango</div>
            <div className="text-sm text-muted-foreground">
              Probá <a href="/apps" className="underline">simulando pedidos</a> o esperá a que lleguen los reales por webhook.
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={DollarSign} label="Facturado" value={fmtAR(kpis.facturado)} tint="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
          <Kpi icon={Receipt} label="Tickets" value={`${kpis.tickets}`} tint="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
          <Kpi icon={TrendingUp} label="Ticket promedio" value={fmtAR(kpis.ticketPromedio)} tint="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" />
          <Kpi icon={Users} label="Propinas estim." value={fmtAR(kpis.propinas)} tint="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Ventas por hora */}
          <Panel title="Ventas por hora" className="lg:col-span-2">
            {byHour.length === 0 ? (
              <EmptyMini />
            ) : (
              <div className="flex items-end gap-3 h-48 px-2">
                {byHour.map((h) => {
                  const pct = maxHora > 0 ? (h.total / maxHora) * 100 : 0;
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-2">
                      <div className="text-[10px] tabular text-muted-foreground font-semibold">
                        {fmtAR(h.total).replace("$", "")}
                      </div>
                      <div className="w-full bg-muted rounded-t flex items-end" style={{ height: "100%" }}>
                        <div
                          className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-t transition-all"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs tabular text-muted-foreground">{h.hour}h</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Donut canales */}
          <Panel title="Ventas por canal">
            {byChannel.length === 0 ? (
              <EmptyMini />
            ) : (
              <div className="flex items-center gap-4">
                <DonutChart data={byChannel.map((c) => ({ key: c.app, color: APP_LABEL[c.app]?.color ?? "#888", v: c.total, label: APP_LABEL[c.app]?.label ?? c.app }))} total={totalCanal} />
                <div className="flex-1 space-y-1.5">
                  {byChannel.map((c) => (
                    <div key={c.app} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: APP_LABEL[c.app]?.color ?? "#888" }} />
                      <span className="flex-1 truncate">{APP_LABEL[c.app]?.label ?? c.app}</span>
                      <span className="tabular font-semibold">
                        {totalCanal > 0 ? Math.round((c.total / totalCanal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top productos */}
          <Panel title="Top productos">
            {topProds.length === 0 ? (
              <EmptyMini />
            ) : (
              <div className="space-y-2.5">
                {topProds.map((p) => {
                  const pct = maxProd > 0 ? (p.total / maxProd) * 100 : 0;
                  return (
                    <div key={p.name}>
                      <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-muted-foreground tabular">
                          {p.qty} · <span className="text-foreground font-bold">{fmtAR(p.total)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Métodos de pago + mozos */}
          <div className="space-y-5">
            <Panel title="Métodos de pago">
              {pagos.length === 0 ? (
                <EmptyMini />
              ) : (
                <div className="space-y-1.5">
                  {pagos.map((p) => (
                    <div key={p.method} className="grid grid-cols-[1fr_60px_120px] items-center gap-3 text-sm">
                      <span>{p.method}</span>
                      <span className="tabular text-xs text-muted-foreground text-right">{p.pct}%</span>
                      <span className="tabular font-semibold text-right">{fmtAR(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Por mozo (POS interno · próximamente)">
              <div className="space-y-1.5 opacity-50">
                {MOZOS.map((m, idx) => (
                  <div key={m.nombre} className="grid grid-cols-[28px_1fr_60px_120px] items-center gap-3 text-sm">
                    <span className="tabular text-muted-foreground font-bold">{idx + 1}.</span>
                    <span>{m.nombre}</span>
                    <span className="tabular text-xs text-muted-foreground text-right">{m.tickets}t</span>
                    <span className="tabular font-semibold text-right">{fmtAR(m.total)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* Caja */}
        <Panel title="Caja · arqueo (apertura/egresos mock — venta real)">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
            <CajaCard label="Apertura" v={caja.apertura} />
            <CajaCard label="Ventas" v={caja.ventas} positive />
            <CajaCard label="Egresos" v={caja.egresos} negative />
            <CajaCard label="Cierre esperado" v={caja.cierreEsperado} bold />
            <CajaCard label="Arqueo real" v={caja.arqueo} bold diff={0} />
          </div>
        </Panel>
      </div>
    </main>
  );
}

function EmptyMini() {
  return (
    <div className="text-center py-8 text-xs text-muted-foreground">
      Sin datos en este rango.
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tint }: { icon: React.ComponentType<{ size?: number }>; label: string; value: string; tint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center mb-2">
        <div className={"w-9 h-9 rounded-lg flex items-center justify-center " + tint}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-2xl font-black mt-0.5">{value}</div>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"rounded-xl border bg-card p-5 " + className}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function DonutChart({ data, total }: { data: Array<{ key: string; color: string; v: number; label: string }>; total: number }) {
  const r = 50;
  const cx = 60, cy = 60;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeWidth={16} />
        {data.map((c) => {
          const frac = c.v / total;
          const dash = frac * C;
          const seg = (
            <circle
              key={c.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={c.color}
              strokeWidth={16}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-black text-xs leading-none">{fmtAR(total)}</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">total</span>
      </div>
    </div>
  );
}

function CajaCard({ label, v, positive, negative, bold, diff }: { label: string; v: number; positive?: boolean; negative?: boolean; bold?: boolean; diff?: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div
        className={
          "tabular mt-1 " +
          (bold ? "font-black text-lg" : "font-bold text-base") + " " +
          (positive ? "text-emerald-600 dark:text-emerald-400" : negative ? "text-red-600 dark:text-red-400" : "")
        }
      >
        {fmtAR(v)}
      </div>
      {diff !== undefined && (
        <div className={"text-xs mt-0.5 " + (diff === 0 ? "text-muted-foreground" : diff < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
          {diff === 0 ? "exacto" : `dif ${diff > 0 ? "+" : ""}${fmtAR(diff)}`}
        </div>
      )}
    </div>
  );
}
