// components/dashboard/footer.tsx

export function Footer() {
  return (
    <footer
      className="relative z-[1] mx-auto max-w-[1400px] px-8 pb-12 pt-6 text-center font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.15em]"
      style={{ color: "var(--color-wood-light)" }}
    >
      <div
        className="mb-2 text-sm tracking-[0.5em]"
        style={{ color: "var(--color-gold)" }}
      >
        ⚓ · ❦ · ⚓
      </div>
      El Desembarco · Bitácora de Reseñas · Sistemas
    </footer>
  );
}
