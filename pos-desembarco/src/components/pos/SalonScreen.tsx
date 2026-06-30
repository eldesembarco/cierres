"use client";

import { useState, useRef, useEffect } from "react";
import { Users, Edit, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mesas as mesasData, type Mesa, type EstadoMesa } from "@/lib/data";
import { fmtAR, tiempoDesde } from "@/lib/format";

const CANVAS_W = 1380;
const CANVAS_H = 940;

interface EstadoStyle {
  fill: string;
  stroke: string;
  text: string;
  label: string;
  pillBg: string;
  pillText: string;
}

const estadoStyle: Record<EstadoMesa, EstadoStyle> = {
  libre: {
    fill: "var(--brand-bottle-soft)",
    stroke: "var(--brand-bottle)",
    text: "var(--foreground)",
    label: "Libre",
    pillBg: "bg-emerald-100 dark:bg-emerald-900/40",
    pillText: "text-emerald-900 dark:text-emerald-200",
  },
  ocupada: {
    fill: "var(--brand-amber-soft)",
    stroke: "var(--brand-amber-deep)",
    text: "var(--foreground)",
    label: "Ocupada",
    pillBg: "bg-amber-100 dark:bg-amber-900/40",
    pillText: "text-amber-900 dark:text-amber-200",
  },
  esperando: {
    fill: "var(--brand-amarillo-soft)",
    stroke: "#8a6a1f",
    text: "var(--foreground)",
    label: "Esperando pedido",
    pillBg: "bg-yellow-100 dark:bg-yellow-900/30",
    pillText: "text-yellow-900 dark:text-yellow-200",
  },
  porPagar: {
    fill: "var(--brand-rojo-soft)",
    stroke: "var(--brand-rojo)",
    text: "var(--foreground)",
    label: "Por cobrar",
    pillBg: "bg-red-100 dark:bg-red-900/40",
    pillText: "text-red-900 dark:text-red-200",
  },
  reservada: {
    fill: "var(--muted)",
    stroke: "var(--muted-foreground)",
    text: "var(--foreground)",
    label: "Reservada",
    pillBg: "bg-stone-200 dark:bg-stone-800",
    pillText: "text-stone-700 dark:text-stone-300",
  },
};

export function SalonScreen() {
  const [sel, setSel] = useState(5);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // Auto-scale para encajar en el wrap. Capamos a 1 para que no agrande el canvas
  // más allá de su tamaño nativo (1380×940) si la pantalla es enorme.
  useEffect(() => {
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const w = el.clientWidth - 24; // padding
      const h = el.clientHeight - 24;
      if (w <= 0 || h <= 0) return;
      setScale(Math.min(w / CANVAS_W, h / CANVAS_H, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const stats = {
    libres: mesasData.filter((m) => m.estado === "libre").length,
    ocupadas: mesasData.filter((m) => m.estado === "ocupada" || m.estado === "esperando" || m.estado === "porPagar").length,
    total: mesasData.length,
  };

  const mSel = mesasData.find((m) => m.id === sel);

  return (
    <main className="flex-1 grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] min-h-0 bg-background">
      {/* Side stats + leyenda */}
      <aside className="border-r bg-card p-5 flex flex-col gap-5 overflow-y-auto scroll-y">
        <div className="space-y-2">
          <Stat
            num={`${stats.ocupadas}`}
            sub={`/${stats.total}`}
            label="Mesas activas"
          />
          <Stat
            num={`${stats.libres}`}
            label="Libres"
            color="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Leyenda
          </div>
          {(["libre", "ocupada", "esperando", "porPagar", "reservada"] as EstadoMesa[]).map((e) => (
            <div key={e} className="flex items-center gap-2 text-xs">
              <span
                className="w-3.5 h-3.5 rounded-sm border-2"
                style={{ background: estadoStyle[e].fill, borderColor: estadoStyle[e].stroke }}
              />
              <span>{estadoStyle[e].label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Sector
          </div>
          {["Salón principal", "Barra", "Vereda"].map((s, i) => (
            <button
              key={s}
              className={
                "w-full text-left px-3 h-8 rounded-md border text-xs transition " +
                (i === 0 ? "bg-accent border-primary font-semibold" : "hover:bg-muted")
              }
            >
              {s}
            </button>
          ))}
        </div>
      </aside>

      {/* Canvas central */}
      <section className="flex flex-col min-h-0">
        <div className="flex items-center justify-between px-5 h-12 border-b">
          <h2 className="text-lg font-bold">Salón principal</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Users size={14} /> Asignar mozo
            </Button>
            <Button variant="outline" size="sm">
              <Edit size={14} /> Editar
            </Button>
          </div>
        </div>

        <div ref={wrapRef} className="flex-1 relative overflow-hidden bg-muted/30 p-3 min-h-0 flex items-center justify-center">
          {/* Outer container con el tamaño YA escalado para que el flex-center funcione */}
          <div
            className="relative shrink-0"
            style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left bg-card border rounded-lg shadow-sm"
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
            >
            {/* Decoraciones */}
            <Deco style={{ left: 50, top: 10, width: 1280, height: 30 }} className="bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300">
              VENTANA · CALLE
            </Deco>
            <Deco style={{ left: 1340, top: 60, width: 30, height: 870 }} className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 [writing-mode:vertical-rl]">
              BARRA
            </Deco>
            <Deco style={{ left: 50, top: 925, width: 260, height: 12 }} className="bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[8px]">
              BAÑOS
            </Deco>
            <Deco style={{ left: 940, top: 925, width: 390, height: 12 }} className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-[8px]">
              COCINA
            </Deco>

            {/* Paredes */}
            <div className="absolute bg-stone-300 dark:bg-stone-700" style={{ left: 320, top: 60, width: 4, height: 870 }} />
            <div className="absolute bg-stone-300 dark:bg-stone-700" style={{ left: 690, top: 60, width: 4, height: 870 }} />

            {/* Mesas */}
            {mesasData.map((m) => (
              <MesaTile key={m.id} m={m} selected={m.id === sel} onClick={() => setSel(m.id)} />
            ))}
            </div>
          </div>
        </div>
      </section>

      {/* Panel detalle */}
      <aside className="border-l bg-card overflow-y-auto scroll-y">
        {mSel && <MesaDetail m={mSel} />}
      </aside>
    </main>
  );
}

function Stat({ num, sub, label, color }: { num: string; sub?: string; label: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className={"tabular text-3xl font-black " + (color ?? "")}>
        {num}
        {sub && <span className="text-muted-foreground text-base">{sub}</span>}
      </div>
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
    </div>
  );
}

function Deco({ children, style, className }: { children: React.ReactNode; style: React.CSSProperties; className: string }) {
  return (
    <div
      className={"absolute flex items-center justify-center text-[10px] font-bold tracking-widest uppercase rounded " + className}
      style={style}
    >
      {children}
    </div>
  );
}

function MesaTile({ m, selected, onClick }: { m: Mesa; selected: boolean; onClick: () => void }) {
  const st = estadoStyle[m.estado];
  const isAlta = m.tipo === "alta";

  return (
    <button
      onClick={onClick}
      className={
        "absolute flex flex-col items-center justify-center transition outline-none " +
        (selected ? "ring-4 ring-amber-400 ring-offset-2 ring-offset-card z-10" : "hover:brightness-95")
      }
      style={{
        left: m.x,
        top: m.y,
        width: m.w,
        height: m.h,
        background: st.fill,
        border: `${selected ? 4 : 3}px solid ${st.stroke}`,
        borderRadius: isAlta ? "50%" : 12,
        color: st.text,
      }}
    >
      <div className="absolute top-2 inset-x-2 flex items-center justify-center">
        {m.estado !== "libre" && (
          <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold " + st.pillBg + " " + st.pillText}>
            {m.estado === "ocupada" && m.desde && `${tiempoDesde(m.desde)} min · ${fmtAR(m.total ?? 0)}`}
            {m.estado === "porPagar" && "POR COBRAR"}
            {m.estado === "esperando" && "Esperando…"}
            {m.estado === "reservada" && (m.reserva ?? "Reservada")}
          </span>
        )}
      </div>

      <div className={isAlta ? "text-3xl" : "text-5xl"} style={{ fontWeight: 900, lineHeight: 1 }}>
        {m.id}
      </div>
      {isAlta && <Wine size={14} className="mt-1 opacity-50" />}

      <div className="absolute bottom-2 inset-x-2 text-center text-[10px] font-medium">
        {m.estado === "libre" ? `${m.sillas} comensales` : (
          <>
            {m.mozo && <div>{m.mozo}</div>}
            {(m.items ?? 0) > 0 && <div className="opacity-60">{m.items} ítems</div>}
          </>
        )}
      </div>
    </button>
  );
}

function MesaDetail({ m }: { m: Mesa }) {
  const st = estadoStyle[m.estado];
  return (
    <div className="p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: st.stroke }}
          />
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {st.label}
          </span>
        </div>
        <div className="text-3xl font-black">Mesa {m.id}</div>
        <div className="text-xs text-muted-foreground">
          {m.sillas} {m.sillas === 1 ? "silla" : "sillas"}
          {m.tipo === "alta" && " · barra alta"}
        </div>
      </div>

      {m.estado === "libre" && (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            La mesa está libre y disponible para nuevos comensales.
          </div>
          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
            Sentar comensales
          </Button>
        </div>
      )}

      {(m.estado === "ocupada" || m.estado === "esperando" || m.estado === "porPagar") && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Card label="Mozo" value={m.mozo ?? "—"} />
            <Card label="Abierta" value={m.desde ?? "—"} />
            <Card label="Tiempo" value={m.desde ? `${tiempoDesde(m.desde)} min` : "—"} />
            <Card label="Ítems" value={`${m.items ?? 0}`} />
          </div>

          <div className="rounded-lg bg-muted p-3 flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Cuenta actual</span>
            <span className="tabular text-xl font-black">{fmtAR(m.total ?? 0)}</span>
          </div>

          <div className="space-y-2">
            <Button className="w-full" variant="outline">Ver pedido</Button>
            <Button className="w-full" variant="outline">Agregar ítem</Button>
            {m.estado === "porPagar" && (
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                Cobrar mesa
              </Button>
            )}
          </div>
        </>
      )}

      {m.estado === "reservada" && (
        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Reserva
            </div>
            <div className="font-semibold text-sm mt-1">{m.reserva}</div>
          </div>
          <Button className="w-full" variant="outline">Marcar llegada</Button>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-sm font-bold tabular mt-0.5">{value}</div>
    </div>
  );
}
