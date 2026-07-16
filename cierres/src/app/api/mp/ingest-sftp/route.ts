// Ingesta AUTOMÁTICA desde el SFTP de Mercado Pago → ventas_app. La dispara n8n
// (Schedule) con el header x-ingest-secret (mismo secreto que /api/mp/ingest y
// /api/mp/resumen). Lee todos los reportes del SFTP, combina, deduplica, agrega por
// (local, fecha) y persiste (mapeo por store_id o por nombre). Excluido del proxy.
//
//   GET /api/mp/ingest-sftp?desde=YYYY-MM-DD   (opcional; acota la lectura del SFTP)
import { revalidateTag } from 'next/cache'
import { ingestReportesSftp } from '@/lib/mp/ingestSftp'
import { TAG_MP_SFTP } from '@/lib/cachedData'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.TANGO_INGEST_SECRET
  if (!secret || request.headers.get('x-ingest-secret') !== secret) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const desde = url.searchParams.get('desde')?.trim()
  const desdeFecha = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : undefined

  try {
    const r = await ingestReportesSftp({ desdeFecha })
    // Corre a la mañana justo después de que MP deja los archivos nuevos:
    // invalida el Data Cache de operaciones para que /conciliacion y /reportes
    // vean el día nuevo al instante (sin esperar el TTL).
    revalidateTag(TAG_MP_SFTP, { expire: 0 })
    return Response.json({
      ok: true,
      archivosLeidos: r.archivosLeidos,
      filasCrudas: r.filasCrudas,
      filasDedup: r.filasDedup,
      filasTotal: r.resultado?.filasTotal ?? 0,
      filasMapeadas: r.resultado?.filasMapeadas ?? 0,
      filasSinMapear: r.resultado?.filasSinMapear ?? 0,
      totales: r.resultado?.totales ?? null,
      resumen: r.resultado?.resumen ?? [],
    })
  } catch (e) {
    return Response.json(
      { error: 'No pude ingerir desde el SFTP', detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
