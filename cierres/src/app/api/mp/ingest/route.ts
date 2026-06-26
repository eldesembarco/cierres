// Ingesta AUTOMÁTICA del reporte "collection" de Mercado Pago — la llama n8n (sin
// sesión), autenticada por el header x-ingest-secret (mismo secreto compartido que
// usa Tango). Recibe el .xlsx que MP entrega por SFTP o que se baja vía la API de MP
// tras el webhook, y lo procesa igual que la subida manual (ingestMercadoPago).
//
// Acepta el archivo de dos formas, para que n8n lo mande como le quede más cómodo:
//  - multipart/form-data con el campo "archivo", o
//  - el cuerpo crudo (binary) = los bytes del .xlsx.
import { ingestMercadoPago } from '@/lib/ingest/ingestMercadoPago'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.TANGO_INGEST_SECRET
  if (!secret || request.headers.get('x-ingest-secret') !== secret) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  let buffer: ArrayBuffer
  let nombre = 'mercadopago.xlsx'
  const contentType = request.headers.get('content-type') ?? ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('archivo')
      if (!(file instanceof File)) {
        return Response.json({ error: 'Falta el campo "archivo"' }, { status: 400 })
      }
      buffer = await file.arrayBuffer()
      nombre = file.name || nombre
    } else {
      buffer = await request.arrayBuffer()
    }
  } catch {
    return Response.json({ error: 'No pude leer el archivo del request' }, { status: 400 })
  }

  if (!buffer || buffer.byteLength === 0) {
    return Response.json({ error: 'El archivo vino vacío' }, { status: 400 })
  }

  try {
    const result = await ingestMercadoPago({ fileBuffer: buffer, archivoNombre: nombre, subidoPor: 1 })
    return Response.json({
      ok: true,
      filasMapeadas: result.filasMapeadas,
      filasSinMapear: result.filasSinMapear,
      totales: result.totales,
    })
  } catch (e) {
    return Response.json(
      { error: 'No pude procesar el Excel de Mercado Pago', detalle: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    )
  }
}
