import Link from "next/link";

const roles = [
  {
    href: "/pos",
    nombre: "Cajero / Mostrador",
    pantalla: "POS principal",
    descripcion: "Carga rápida de productos, búsqueda y cobro. Pensado para monitor táctil 1920×1080.",
    icon: "💸",
    accent: "from-amber-400 to-amber-600",
  },
  {
    href: "/salon",
    nombre: "Encargado de salón",
    pantalla: "Mapa de mesas",
    descripcion: "Estado en tiempo real del salón. Asignación de mozo, reservas, cobros pendientes.",
    icon: "🪑",
    accent: "from-emerald-500 to-emerald-700",
  },
  {
    href: "/mozo",
    nombre: "Mozo",
    pantalla: "Tablet del mozo",
    descripcion: "Toma de pedido en mesa con modificadores y envío a cocina. Optimizado para tablet 1280×800.",
    icon: "🧾",
    accent: "from-sky-500 to-sky-700",
  },
  {
    href: "/cocina",
    nombre: "Cocinero",
    pantalla: "KDS — Kitchen Display",
    descripcion: "Kanban Nuevo → Preparación → Listo. Cronómetros grandes, modo oscuro permanente.",
    icon: "🔥",
    accent: "from-red-500 to-red-700",
  },
  {
    href: "/apps",
    nombre: "Encargado delivery",
    pantalla: "Bandeja apps externas",
    descripcion: "PedidosYa, Rappi, MP Envíos. Aceptar / preparar / despachar al cadete con comanda imprimible.",
    icon: "🛵",
    accent: "from-pink-500 to-pink-700",
  },
  {
    href: "/cobro",
    nombre: "Cierre de mesa",
    pantalla: "Cobro / ticket",
    descripcion: "División de cuenta, propina, métodos de pago. Imprime ticket y comprobante fiscal.",
    icon: "🧮",
    accent: "from-violet-500 to-violet-700",
  },
  {
    href: "/reportes",
    nombre: "Admin / Dueño",
    pantalla: "Reportes de fin de turno",
    descripcion: "Cierre Z. Ventas por hora / canal / mozo. Métodos de pago y movimientos de caja.",
    icon: "📊",
    accent: "from-stone-500 to-stone-700",
  },
];

export default function Home() {
  return (
    <main className="flex-1 px-6 py-10 lg:px-16 lg:py-16">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🍺</span>
            <span className="text-sm uppercase tracking-widest text-muted-foreground font-semibold">
              POS · El Desembarco
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Elegí tu rol</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            En producción cada dispositivo arranca fijado al rol que le corresponde.
            Acá podés probar cualquier pantalla — útil para QA y demo.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 transition hover:border-primary hover:shadow-lg"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${r.accent}`} />
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{r.icon}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {r.pantalla}
                </span>
              </div>
              <h2 className="font-bold text-lg mb-1">{r.nombre}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.descripcion}</p>
              <div className="mt-4 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition">
                Entrar →
              </div>
            </Link>
          ))}
        </div>

        <footer className="mt-16 text-xs text-muted-foreground">
          v0.1 · Migración del mockup hi-fi a Next.js 16 + Tailwind 4 + shadcn
        </footer>
      </div>
    </main>
  );
}
