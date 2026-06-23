// Este endpoint lo llama n8n (una casilla por local → localId): cuando Tango envía
// por correo el PDF de "cierre de turno", n8n extrae el texto y lo POSTea acá.
// Parseamos el texto, guardamos las ventas por turno y el botón "Importar desde
// Tango" de la planilla las trae al cierre vía GET /api/tango.
import { prisma } from '@/lib/db'
import { parseTangoPdf } from '@/lib/ingest/parseTangoPdf'

export async function POST(request: Request) {
  // Auth simple por secreto compartido (header). n8n manda x-ingest-secret.
  const secret = process.env.TANGO_INGEST_SECRET
  if (!secret || request.headers.get('x-ingest-secret') !== secret) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { localId, text } = (body ?? {}) as { localId?: unknown; text?: unknown }
  if (typeof localId !== 'number' || !Number.isInteger(localId) || typeof text !== 'string') {
    return Response.json({ error: 'Faltan localId (number) o text (string)' }, { status: 400 })
  }

  const parsed = parseTangoPdf(text)
  if (!parsed.turno || !parsed.fecha) {
    return Response.json(
      { error: 'No se pudo extraer turno/fecha del PDF', fecha: parsed.fecha, turno: parsed.turno },
      { status: 400 },
    )
  }

  const fecha = new Date(`${parsed.fecha}T00:00:00.000Z`)

  await prisma.cierreTango.upsert({
    where: { localId_fecha_turno: { localId, fecha, turno: parsed.turno } },
    create: {
      localId,
      fecha,
      turno: parsed.turno,
      ventas: parsed.ventas,
      montoZ: parsed.montoZ,
      cantidadTickets: parsed.cantidadTickets,
      recibidoEn: new Date(),
    },
    update: {
      ventas: parsed.ventas,
      montoZ: parsed.montoZ,
      cantidadTickets: parsed.cantidadTickets,
      recibidoEn: new Date(),
    },
  })

  return Response.json({
    ok: true,
    localId,
    fecha: parsed.fecha,
    turno: parsed.turno,
    canales: parsed.ventas.length,
  })
}
