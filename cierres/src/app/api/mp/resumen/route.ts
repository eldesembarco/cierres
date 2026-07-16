// Consolidado diario de Liberaciones de Mercado Pago para el mail de la mañana.
// Lo llama n8n (sin sesión), autenticado por x-ingest-secret (mismo secreto que
// /api/mp/ingest). Lee TODOS los reportes crudos del SFTP, consolida las
// operaciones del día objetivo (todos los locales y tipos), y devuelve el asunto,
// el cuerpo HTML y el Excel adjunto (Detalle + Resumen por local) en base64.
//
//   GET /api/mp/resumen?fecha=YYYY-MM-DD   (sin fecha = ayer hora Argentina)
import { revalidateTag } from 'next/cache'
import { descargarReportes, sftpConfigFromEnv } from '@/lib/mp/sftpReportes'
import { consolidarLiberaciones, mailAsunto, mailHtml } from '@/lib/mp/consolidarLiberaciones'
import { TAG_MP_SFTP } from '@/lib/cachedData'

export const runtime = 'nodejs'
export const maxDuration = 60

// "Ayer" en hora Argentina (UTC-3, sin horario de verano) como YYYY-MM-DD.
function ayerArgentina(): string {
  const arHoy = Date.now() - 3 * 60 * 60 * 1000
  return new Date(arHoy - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const secret = process.env.TANGO_INGEST_SECRET
  if (!secret || request.headers.get('x-ingest-secret') !== secret) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  const fechaParam = url.searchParams.get('fecha')?.trim()
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : ayerArgentina()

  try {
    // Lee el SFTP directo (sin Data Cache): el mail de la mañana no puede salir
    // con datos viejos. Después invalida el cache de operaciones, que a esta
    // altura ya tiene los archivos nuevos del día.
    const archivos = await descargarReportes(sftpConfigFromEnv(), { desdeFecha: fecha })
    const cons = await consolidarLiberaciones(archivos, fecha)
    revalidateTag(TAG_MP_SFTP, { expire: 0 })

    return Response.json({
      ok: true,
      fecha,
      generadoEn: new Date().toISOString(),
      archivosLeidos: archivos.length,
      totalOperaciones: cons.totalOperaciones,
      locales: cons.resumen.length,
      resumen: cons.resumen,
      total: cons.total,
      asunto: mailAsunto(cons),
      cuerpoHtml: mailHtml(cons),
      archivoNombre: cons.archivoNombre,
      archivoBase64: cons.xlsx.toString('base64'),
      hayDatos: cons.totalOperaciones > 0,
    })
  } catch (e) {
    return Response.json(
      { error: 'No pude armar el consolidado de Mercado Pago', detalle: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
