export function fmtAR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return sign + "$" + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Mockea minutos transcurridos desde un HH:MM (asumiendo "hora actual" 21:24).
// En la app real esto vendría del servidor.
const NOW_MOCK = 21 * 60 + 24;
export function tiempoDesde(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, NOW_MOCK - (h * 60 + m));
}
