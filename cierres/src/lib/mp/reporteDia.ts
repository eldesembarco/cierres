// Consolidado de Liberaciones de MP de un día sobre el Data Cache de
// operaciones (operacionesMpDia): compartido por la pantalla /reportes (que
// solo necesita el resumen, sin armar el Excel) y el endpoint de descarga
// /api/mp/reporte (que sí arma el workbook), para que sean idénticos.
import { getOperacionesMpDiaCached } from '@/lib/mp/operacionesMpDia'
import {
  consolidarDesdeFilas,
  resumirOperaciones,
  type Consolidado,
  type ResumenDia,
} from '@/lib/mp/consolidarLiberaciones'

export async function armarConsolidadoDia(fecha: string): Promise<Consolidado> {
  const { filas } = await getOperacionesMpDiaCached(fecha)
  return consolidarDesdeFilas(filas, fecha)
}

// Solo el resumen por local (sin construir el Excel): lo usa /reportes.
export async function armarResumenDia(fecha: string): Promise<ResumenDia> {
  const { filas } = await getOperacionesMpDiaCached(fecha)
  return resumirOperaciones(filas, fecha)
}
