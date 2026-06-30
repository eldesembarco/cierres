import Link from "next/link";

interface Props {
  rol: string;
  pantalla: string;
  usuario?: string;
  /** Tonalidad oscura permanente (KDS), default sigue el theme global */
  dark?: boolean;
}

/**
 * Chrome común de los layouts por rol: brand a la izquierda, contexto del rol al medio,
 * volver al selector + usuario a la derecha. En prod la salida sería logout, no link al root.
 */
export function BrandHeader({ rol, pantalla, usuario = "M. Cruz", dark = false }: Props) {
  return (
    <header
      className={
        "flex items-center gap-4 px-5 h-14 border-b shrink-0 " +
        (dark ? "bg-[#1f1b16] text-[#f4efe6] border-[#3a332b]" : "bg-card text-card-foreground border-border")
      }
    >
      <Link href="/" className="flex items-center gap-2 group" aria-label="Volver al selector de rol">
        <span className="text-xl">🍺</span>
        <span className="font-bold tracking-tight">El Desembarco</span>
        <span className={"text-xs px-1.5 py-0.5 rounded font-mono " + (dark ? "bg-white/5 text-white/60" : "bg-muted text-muted-foreground")}>
          v0.1
        </span>
      </Link>

      <div className={"hidden md:flex items-baseline gap-2 ml-4 " + (dark ? "text-white/70" : "text-muted-foreground")}>
        <span className="text-sm uppercase tracking-wider font-semibold">{rol}</span>
        <span className="opacity-50">·</span>
        <span className="text-sm">{pantalla}</span>
      </div>

      <div className="flex-1" />

      <Link
        href="/"
        className={
          "text-xs px-2 py-1 rounded transition hidden sm:block " +
          (dark
            ? "text-white/60 hover:text-white hover:bg-white/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted")
        }
      >
        Cambiar rol
      </Link>

      <div
        className={
          "flex items-center gap-2 text-sm border-l pl-4 " +
          (dark ? "border-white/10" : "border-border")
        }
      >
        <div
          className={
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold " +
            (dark ? "bg-amber-500 text-black" : "bg-primary text-primary-foreground")
          }
        >
          {usuario.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden lg:inline">{usuario}</span>
      </div>
    </header>
  );
}
