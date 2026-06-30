// components/dashboard/title-section.tsx

interface TitleSectionProps {
  panelTimestamp: string;
}

export function TitleSection({ panelTimestamp }: TitleSectionProps) {
  return (
    <section className="relative z-[1] mx-auto max-w-[1400px] px-8 pb-6 pt-12">
      <div
        className="mb-2 flex items-center gap-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em]"
        style={{ color: "var(--color-ember-dark)" }}
      >
        <span>Panel de comando · Última actualización {panelTimestamp}</span>
        <span
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, var(--color-ember-dark), transparent)",
          }}
        />
      </div>

      <h1
        className="mb-3 font-[family-name:var(--font-display)] text-5xl font-black leading-none tracking-[-0.01em] sm:text-6xl"
        style={{ color: "var(--color-wood)" }}
      >
        Lo que dice{" "}
        <span
          className="font-medium italic"
          style={{ color: "var(--color-ember)" }}
        >
          la tripulación
        </span>
      </h1>

      <p className="max-w-[600px] text-base" style={{ color: "var(--color-wood-light)" }}>
        Reseñas de Google de las últimas 24 horas. Las positivas se respondieron solas.
        Las negativas, esperan al CM.
      </p>
    </section>
  );
}
