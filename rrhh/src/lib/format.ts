// Helpers de formato compartidos (fechas ISO yyyy-mm-dd → es-AR).

export function fmtFecha(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function fmtFechaCorta(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const [, m, d] = isoDate.split('-').map(Number)
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d} ${meses[(m ?? 1) - 1]}`
}

export function fmtAntiguedad(meses: number | null): string {
  if (meses === null) return '—'
  if (meses < 1) return 'Ingresante'
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  return resto ? `${anios} a ${resto} m` : `${anios} ${anios === 1 ? 'año' : 'años'}`
}

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('')
}

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function diasDesdeHoy(isoDate: string): number {
  const hoy = new Date(hoyIso())
  const fecha = new Date(isoDate)
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000)
}
