"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const items = [
  { href: "/pos",      num: "01", label: "POS",      icon: "💸" },
  { href: "/salon",    num: "02", label: "Salón",    icon: "🪑" },
  { href: "/mozo",     num: "03", label: "Mozo",     icon: "🧾" },
  { href: "/cocina",   num: "04", label: "Cocina",   icon: "🔥" },
  { href: "/apps",     num: "05", label: "Apps",     icon: "🛵" },
  { href: "/cobro",    num: "06", label: "Cobro",    icon: "🧮" },
  { href: "/reportes", num: "07", label: "Reportes", icon: "📊" },
];

/**
 * Dock flotante para presentaciones — todo lo que necesita el demo es saltar entre pantallas.
 * Tecla H lo oculta. En prod cada device va fijado a su rol y este componente no se monta.
 */
export function PresentationDock() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key.toLowerCase() === "h") setHidden((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="fixed bottom-3 right-3 z-50 w-10 h-10 rounded-full bg-black/80 text-white/80 backdrop-blur flex items-center justify-center hover:text-white"
        aria-label="Mostrar dock (H)"
      >
        <Eye size={16} />
      </button>
    );
  }

  return (
    <nav
      aria-label="Cambiar de rol"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-1.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl text-white"
    >
      <Link
        href="/"
        className="px-3 h-8 rounded-full text-xs font-bold tracking-widest uppercase text-white/60 hover:text-white hover:bg-white/10 flex items-center gap-2"
      >
        🍺 <span className="hidden sm:inline">El Desembarco</span>
      </Link>
      <div className="w-px h-6 bg-white/15" />
      {items.map((it) => {
        const active = pathname === it.href || pathname?.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={
              "flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium transition " +
              (active ? "bg-amber-500 text-black" : "text-white/70 hover:text-white hover:bg-white/10")
            }
          >
            <span className={"tabular text-[10px] " + (active ? "text-black/60" : "text-white/40")}>
              {it.num}
            </span>
            <span className="text-base leading-none">{it.icon}</span>
            <span className="hidden md:inline">{it.label}</span>
          </Link>
        );
      })}
      <div className="w-px h-6 bg-white/15" />
      <button
        onClick={() => setHidden(true)}
        className="w-8 h-8 rounded-full text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center"
        aria-label="Ocultar dock (H)"
        title="Ocultar (H)"
      >
        <EyeOff size={14} />
      </button>
    </nav>
  );
}
