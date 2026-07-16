// Operaciones de MP de un día (todas las cuentas), ya bajadas del SFTP y
// parseadas, en el Data Cache. Bajar y parsear los Excel del SFTP es lo más
// caro en CPU de toda la app y se repetía ENTERO en cada vista de /conciliacion
// y /reportes; acá se hace una vez por fecha y TTL. Las filas son planas
// (string|number|null) → aptas para unstable_cache (serializa JSON).
import { unstable_cache } from 'next/cache'
import { descargarReportes, sftpConfigFromEnv } from '@/lib/mp/sftpReportes'
import { leerOperacionesDia, type Fila } from '@/lib/mp/consolidarLiberaciones'
import { TAG_MP_SFTP } from '@/lib/cachedData'
import { hoyAr } from '@/lib/fecha'

export interface OperacionesMpDia {
  archivosLeidos: number
  filas: Fila[]
}

async function operacionesDia(fecha: string): Promise<OperacionesMpDia> {
  const archivos = await descargarReportes(sftpConfigFromEnv(), { desdeFecha: fecha })
  return { archivosLeidos: archivos.length, filas: await leerOperacionesDia(archivos, fecha) }
}

/**
 * El settlement del día D llega la mañana de D+1 y quedan "stragglers" en
 * reportes de los días siguientes: TTL de 30 min mientras la fecha es reciente
 * (≤3 días) y 24h después. Además, los jobs de la mañana (/api/mp/resumen a las
 * 08:00 y /api/mp/ingest-sftp a las 08:15) invalidan TAG_MP_SFTP al terminar,
 * así el día nuevo se ve al instante aunque el TTL no haya vencido.
 */
export function getOperacionesMpDiaCached(fecha: string): Promise<OperacionesMpDia> {
  const limiteReciente = new Date(Date.parse(`${hoyAr()}T00:00:00Z`) - 3 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  return unstable_cache(operacionesDia, ['mp-operaciones-dia-v1'], {
    tags: [TAG_MP_SFTP],
    revalidate: fecha >= limiteReciente ? 1800 : 86_400,
  })(fecha)
}
