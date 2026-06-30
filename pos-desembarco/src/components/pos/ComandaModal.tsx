"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { APP_LABEL, type PedidoApp } from "@/lib/data";

interface Props {
  pedido: PedidoApp;
  onClose: () => void;
}

export function ComandaModal({ pedido, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 bg-stone-100">
        <DialogTitle className="sr-only">Comanda · {pedido.id}</DialogTitle>

        <div className="flex items-center justify-between p-4 border-b border-stone-300 bg-white">
          <span className="text-xs uppercase tracking-widest text-stone-500 font-bold">
            Comanda de cocina · Vista previa
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8">
              <Printer size={14} /> Imprimir
            </Button>
          </div>
        </div>

        <div className="bg-white text-stone-900 font-mono p-6 max-h-[80vh] overflow-y-auto scroll-y">
          <div className="text-center pb-3 border-b border-dashed border-stone-300">
            <div className="text-2xl font-black tracking-tight">EL DESEMBARCO</div>
            <div className="text-[11px] text-stone-500 mt-1">cervecería · cocina</div>
          </div>

          <div className="my-3 flex items-center justify-between bg-stone-100 rounded p-2">
            <span
              className="inline-flex items-center px-2 h-6 rounded text-[10px] font-bold uppercase tracking-wider text-white"
              style={{
                background:
                  pedido.app === "pedidosya" ? "#fa0050" :
                  pedido.app === "rappi" ? "#ff1744" : "#00b1ea",
              }}
            >
              {APP_LABEL[pedido.app]}
            </span>
            <span className="font-black tabular">#{pedido.id}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] my-3">
            <Meta k="Fecha" v={`04/05/2026 · ${pedido.hora}`} />
            <Meta k="Cliente" v={pedido.cliente} />
            <Meta k="Tipo" v={`Delivery ${APP_LABEL[pedido.app]}`} />
            <Meta k="Listo en" v="25 min" />
          </div>

          <Divider>PEDIDO</Divider>

          <div className="space-y-2 my-3">
            {pedido.items.map((it, i) => (
              <div key={i}>
                <div className="flex gap-2">
                  <span className="text-2xl tabular font-black w-8 shrink-0">{it.qty}</span>
                  <span className="text-base font-bold leading-tight uppercase">{it.nombre}</span>
                </div>
                {it.mods && it.mods.length > 0 && (
                  <div className="ml-10 text-xs text-stone-600 italic">
                    {it.mods.map((m, j) => <div key={j}>· {m}</div>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-right text-xs text-stone-500 italic mb-3">
            Total: {pedido.items.reduce((s, i) => s + i.qty, 0)} ítems
          </div>

          <Divider>ENTREGA</Divider>

          <div className="grid grid-cols-[1fr_80px] gap-3 my-3">
            <div className="flex flex-col items-center justify-center">
              <Barcode value={pedido.id} />
              <div className="text-[10px] tabular tracking-widest mt-1">{pedido.id}</div>
            </div>
            <div className="flex flex-col items-center justify-center">
              <QrPlaceholder seed={pedido.id} />
              <div className="text-[8px] mt-1 text-center">Escanear<br />al entregar</div>
            </div>
          </div>

          <div className="text-center text-[10px] text-stone-500 mt-4 pt-3 border-t border-dashed border-stone-300">
            *** No es comprobante fiscal ***
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-stone-500 uppercase tracking-wider text-[9px] font-bold">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-xs text-stone-500 my-3 tracking-widest">
      — {children} —
    </div>
  );
}

// Barcode determinista (mock visual de Code 128) — en prod reemplazar con jsbarcode.
function Barcode({ value }: { value: string }) {
  const seed = value.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  let s = seed;
  const widths: number[] = [];
  for (let i = 0; i < 60; i++) {
    s = (s * 9301 + 49297) % 233280;
    widths.push(1 + (s % 4));
  }
  let x = 0;
  const total = widths.reduce((a, b) => a + b, 0);
  return (
    <svg viewBox={`0 0 ${total} 50`} preserveAspectRatio="none" className="w-full h-12">
      {widths.map((w, i) => {
        const fill = i % 2 === 0 ? "#000" : "transparent";
        const r = <rect key={i} x={x} y={0} width={w} height={50} fill={fill} />;
        x += w;
        return r;
      })}
    </svg>
  );
}

// QR placeholder con finder patterns reales (mock visual) — en prod reemplazar con qrcode.
function QrPlaceholder({ seed }: { seed: string }) {
  const N = 25;
  const seedN = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  let s = seedN;
  const cells: [number, number][] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= N - 7 && y < 7) ||
        (x < 7 && y >= N - 7);
      if (inFinder) {
        const fx = x < 7 ? x : x - (N - 7);
        const fy = y < 7 ? y : y - (N - 7);
        const onEdge = fx === 0 || fx === 6 || fy === 0 || fy === 6;
        const inCenter = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
        if (onEdge || inCenter) cells.push([x, y]);
        continue;
      }
      s = (s * 9301 + 49297) % 233280;
      if (s % 2 === 0) cells.push([x, y]);
    }
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className="w-20 h-20">
      <rect x={0} y={0} width={N} height={N} fill="#fff" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={1} height={1} fill="#000" />
      ))}
    </svg>
  );
}
