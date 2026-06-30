"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { Producto } from "@/lib/data";
import { fmtAR } from "@/lib/format";

export interface AddItemInput {
  id: string;
  nombre: string;
  qty: number;
  precio: number;
  mods: string[];
}

interface Props {
  producto: Producto | null;
  onClose: () => void;
  onAdd: (item: AddItemInput) => void;
}

export function ModificadoresSheet({ producto, onClose, onAdd }: Props) {
  const open = !!producto;
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        {producto && <ModificadoresContent producto={producto} onClose={onClose} onAdd={onAdd} />}
      </SheetContent>
    </Sheet>
  );
}

function ModificadoresContent({ producto, onClose, onAdd }: { producto: Producto; onClose: () => void; onAdd: (item: AddItemInput) => void }) {
  const [size, setSize] = useState<[string, number] | null>(producto.sizes?.[0] ?? null);
  const [mods, setMods] = useState<string[]>([]);
  const [notas, setNotas] = useState("");

  const precio = producto.precio + (size?.[1] ?? 0);
  const nombreFull = producto.nombre + (size ? ` ${size[0]}` : "");

  const toggleMod = (m: string) => {
    setMods((arr) => (arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]));
  };

  const handleAdd = () => {
    onAdd({
      id: producto.id,
      nombre: nombreFull,
      qty: 1,
      precio,
      mods: [...mods, ...(notas ? [`📝 ${notas}`] : [])],
    });
  };

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-3 border-b">
        <SheetTitle className="text-xl">{producto.nombre}</SheetTitle>
        {producto.desc && <SheetDescription>{producto.desc}</SheetDescription>}
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {producto.sizes && (
          <Section label="Tamaño">
            <div className="grid grid-cols-2 gap-2">
              {producto.sizes.map((s) => (
                <button
                  key={s[0]}
                  onClick={() => setSize(s)}
                  className={
                    "flex items-center justify-between px-3 h-11 rounded-md border text-sm font-medium transition " +
                    (size === s
                      ? "border-primary bg-accent text-foreground"
                      : "border-border hover:bg-muted")
                  }
                >
                  <span>{s[0]}</span>
                  <span className="tabular text-muted-foreground text-xs">
                    {s[1] === 0 ? fmtAR(producto.precio) : (s[1] > 0 ? "+" : "") + fmtAR(s[1])}
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {producto.modifs && (
          <Section label="Modificadores">
            <div className="flex flex-wrap gap-2">
              {producto.modifs.map((m) => {
                const on = mods.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMod(m)}
                    className={
                      "flex items-center gap-1.5 px-3 h-9 rounded-full border text-sm transition " +
                      (on
                        ? "border-primary bg-accent text-foreground font-medium"
                        : "border-border hover:bg-muted")
                    }
                  >
                    {on && <Check size={14} />}
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {producto.agregados && producto.agregados.length > 0 && (
          <Section label="Agregados (con costo)">
            <div className="space-y-2">
              {producto.agregados.map(([nombre, costo]) => {
                const tag = `+ ${nombre} (${fmtAR(costo)})`;
                const on = mods.includes(tag);
                return (
                  <button
                    key={nombre}
                    onClick={() => toggleMod(tag)}
                    className={
                      "w-full flex items-center justify-between px-3 h-11 rounded-md border text-sm transition " +
                      (on
                        ? "border-primary bg-accent text-foreground font-medium"
                        : "border-border hover:bg-muted")
                    }
                  >
                    <span className="flex items-center gap-2">
                      {on && <Check size={14} />}
                      {nombre}
                    </span>
                    <span className="tabular text-muted-foreground text-xs">+{fmtAR(costo)}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        <Section label="Nota para cocina">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: bien caliente, alergia a frutos secos…"
            className="w-full min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Section>
      </div>

      <SheetFooter className="border-t flex-row gap-2 px-5 py-4">
        <Button variant="outline" size="lg" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button size="lg" onClick={handleAdd} className="flex-[2] bg-amber-500 hover:bg-amber-600 text-black font-semibold">
          Agregar · {fmtAR(precio)}
        </Button>
      </SheetFooter>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
