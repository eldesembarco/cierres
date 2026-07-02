// Fechas en horario de Argentina (UTC-3, sin horario de verano) como YYYY-MM-DD.
// El server corre en UTC (Vercel): entre las 21:00 y 23:59 hora Argentina ya es el día
// siguiente en UTC, así que usar new Date().toISOString() para "hoy" abría/mostraba el
// día equivocado de noche. Estos helpers hacen que "hoy"/"ayer" signifiquen lo mismo en
// toda la app.
const OFFSET_MS = 3 * 60 * 60 * 1000

export function hoyAr(): string {
  return new Date(Date.now() - OFFSET_MS).toISOString().slice(0, 10)
}

export function ayerAr(): string {
  return new Date(Date.now() - OFFSET_MS - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Primer día (YYYY-MM-DD) del mes actual en hora Argentina.
export function primerDiaDelMesAr(): string {
  return `${hoyAr().slice(0, 7)}-01`
}
