// Ingesta multi-archivo desde el SFTP de Mercado Pago → ventas_app (plataforma MD).
// Baja TODOS los reportes del SFTP, los parsea (collection o settlement, autodetectado),
// COMBINA las operaciones de todos los archivos, DEDUPLICA (los settlement se repiten
// entre archivos y en los pulls "manual"), agrega por (local, fecha) y persiste con la
// misma cañería de mapeo/upsert que la subida de un archivo.
//
// Nota: el dedup es a nivel de operación normalizada (fecha|estado|local|bruto|neto).
// Para el contraste exacto conviene el reporte "collection" (por store_id, sin retraso);
// el "settlement"/Liberaciones que hoy cae en el SFTP refleja plata ya liberada (llega
// con demora), así que sirve para una vista aproximada, no para cuadre al peso del día.
import { descargarReportes, sftpConfigFromEnv } from '@/lib/mp/sftpReportes'
import { parseMpFile, aggregateMp, type MpRawRow } from '@/lib/ingest/parseMercadoPago'
import { persistMpGrupos, type MpIngestResult } from '@/lib/ingest/ingestMercadoPago'

export interface IngestSftpOpts {
  // Si se pasa, sólo baja reportes cuyo nombre tenga fecha >= desdeFecha (acota la lectura).
  desdeFecha?: string
  subidoPor?: number
}

export interface IngestSftpResult {
  archivosLeidos: number
  filasCrudas: number
  filasDedup: number
  resultado: MpIngestResult | null
}

// Firma de una operación para deduplicar filas idénticas repetidas entre archivos.
// Incluye ID DEL PAQUETE y FECHA DE APROBACIÓN: sin ellos, dos ventas REALES y distintas
// del mismo local, día y monto (muy común en gastronomía: dos combos iguales) colapsaban
// en una sola y se sub-contaba la venta. Con estos campos se distinguen (alineado con el
// dedup por fila completa que usa la conciliación).
function firma(r: MpRawRow): string {
  return [
    r.fecha,
    r.estado,
    r.storeId,
    r.storeName,
    r.bruto,
    r.neto,
    r.devuelto,
    r.idPaquete ?? '',
    r.fechaAprobacion ?? '',
  ].join('|')
}

export async function ingestReportesSftp(opts: IngestSftpOpts = {}): Promise<IngestSftpResult> {
  const archivos = await descargarReportes(
    sftpConfigFromEnv(),
    opts.desdeFecha ? { desdeFecha: opts.desdeFecha } : {},
  )

  const todas: MpRawRow[] = []
  for (const a of archivos) {
    try {
      todas.push(...(await parseMpFile(a.buffer)))
    } catch {
      // Un archivo con formato inesperado no frena la corrida (ej. connection-check).
    }
  }

  const vistas = new Set<string>()
  const dedup: MpRawRow[] = []
  for (const r of todas) {
    const f = firma(r)
    if (vistas.has(f)) continue
    vistas.add(f)
    dedup.push(r)
  }

  const grupos = aggregateMp(dedup)
  const resultado = grupos.length
    ? await persistMpGrupos(grupos, `SFTP MP (${archivos.length} archivos)`, opts.subidoPor ?? 1)
    : null

  return { archivosLeidos: archivos.length, filasCrudas: todas.length, filasDedup: dedup.length, resultado }
}
