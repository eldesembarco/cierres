import Link from "next/link";

interface Props {
  rol: string;
  titulo: string;
  descripcion: string;
  features: string[];
}

/**
 * Placeholder para los roles cuyo screen completo todavía no fue migrado del mockup hi-fi.
 * Lista las features que vendrán y un link al mockup HTML de referencia.
 */
export function StubScreen({ rol, titulo, descripcion, features }: Props) {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-card border rounded-xl p-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
          Rol · {rol}
        </div>
        <h1 className="text-3xl font-bold mb-2">{titulo}</h1>
        <p className="text-muted-foreground mb-6">{descripcion}</p>

        <div className="space-y-2 mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            En esta pantalla:
          </div>
          <ul className="space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex gap-2 text-sm">
                <span className="text-muted-foreground">·</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t">
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 font-medium">
            Pendiente de migrar
          </span>
          <Link href="/" className="text-sm text-primary hover:underline ml-auto">
            ← Cambiar rol
          </Link>
        </div>
      </div>
    </main>
  );
}
