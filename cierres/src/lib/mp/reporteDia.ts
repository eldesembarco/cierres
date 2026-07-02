// Arma el consolidado de Liberaciones de MP de un día leyendo el SFTP. Compartido
// por la pantalla /reportes (render del resumen) y el endpoint de descarga
// /api/mp/reporte (el mismo Excel que sale por mail), para que sean idénticos.
import { descargarReportes, sftpConfigFromEnv } from '@/lib/mp/sftpReportes'
import { consolidarLiberaciones, type Consolidado } from '@/lib/mp/consolidarLiberaciones'

export async function armarConsolidadoDia(fecha: string): Promise<Consolidado> {
  const archivos = await descargarReportes(sftpConfigFromEnv(), { desdeFecha: fecha })
  return consolidarLiberaciones(archivos, fecha)
}
