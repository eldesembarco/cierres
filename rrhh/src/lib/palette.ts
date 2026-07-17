// Paleta de gráficos VALIDADA (skill dataviz, modo light, superficie blanca).
// Orden categórico FIJO: nunca ciclar ni reasignar por ranking.
// El ámbar (#e0a100) tiene contraste 2.2:1 → SIEMPRE acompañar con etiquetas
// directas de valor (regla del validador).

export const CHART_CATEGORICAL = ['#e8590c', '#2f9e44', '#e0a100', '#1971c2'] as const

/** El color sigue a la entidad (marca), nunca a la posición en el gráfico */
export const MARCA_COLOR: Record<string, string> = {
  'Desembarco': '#e8590c',
  'Mila & Go': '#2f9e44',
  'Mr. Tasty': '#e0a100',
  'Estructura': '#1971c2',
}

export const CHART_NEUTRAL = '#1971c2'
export const CHART_GRID = '#e9e6e1'
export const CHART_AXIS_TEXT = '#a19c96'

/** Ramp secuencial (una sola tinta, claro→oscuro) para magnitudes */
export const CHART_SEQUENTIAL = ['#fde4d3', '#f8b98d', '#ef8a4a', '#e8590c', '#a63c05'] as const
