// Control automático "declarado vs Tango": compara la venta declarada por el
// encargado contra la facturación real de Tango (venta_tango_hora, definición Z,
// sincronizada por el BI). Umbrales calibrados con datos reales del 02-06/07:
// los que cuadran dan $0 o centavos; los errores reales arrancan en 5-30%.
export type EstadoTango = 'cuadra' | 'leve' | 'grave'

/**
 * Estado del control para un local-día.
 * - cuadra: |dif| ≤ $1.000 o 0,5% de lo facturado (redondeos / NC menores)
 * - leve:   |dif| ≤ 5% (revisar, puede ser una venta mal tipificada)
 * - grave:  |dif| > 5% (carga incompleta o error grande)
 */
export function estadoTango(dif: number, tango: number): EstadoTango {
  const abs = Math.abs(dif)
  if (abs <= Math.max(1000, tango * 0.005)) return 'cuadra'
  if (abs <= tango * 0.05) return 'leve'
  return 'grave'
}
