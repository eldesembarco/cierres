/** El reporte endOfDay usa formato en-US: coma = separador de miles, punto = decimal. */
export function parseMoney(raw: string | number): number {
  if (typeof raw === 'number') return round2(raw)
  const cleaned = raw.trim().replace(/,/g, '')
  const n = Number(cleaned)
  if (cleaned === '' || Number.isNaN(n)) {
    throw new Error(`Monto inválido: "${raw}"`)
  }
  return round2(n)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function sumMoney(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + v, 0))
}

const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** Formatea un monto como moneda es-AR, p. ej. 1103740 → "$1.103.740". */
export function formatMoney(n: number): string {
  return ARS.format(n ?? 0)
}
