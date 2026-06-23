// Importador MANUAL del PDF de "cierre de turno" de Tango (solo admin/central).
// Sirve para probar la ingesta de Tango sin esperar el correo/n8n, y como fallback
// manual. Recibe el PDF por FormData, extrae el texto del lado del servidor con
// unpdf, lo parsea con parseTangoPdf y hace upsert en cierre_tango. Luego el botón
// "Importar desde Tango" de la planilla lo trae al cierre vía GET /api/tango.
import { auth } from '@/lib/auth/auth'
import { esCentral } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { extractPdfText } from '@/lib/ingest/pdfText'
import { parseTangoPdf } from '@/lib/ingest/parseTangoPdf'

// unpdf trae un build serverless de pdf.js: lo corremos en el runtime Node.
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 })
  if (!esCentral(session.user.rol)) {
    return Response.json({ ok: false, error: 'Sin permiso' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ ok: false, error: 'Esperaba multipart/form-data' }, { status: 400 })
  }

  const file = form.get('archivo')
  const localId = Number(form.get('localId'))
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: 'Falta el archivo PDF' }, { status: 400 })
  }
  if (!Number.isInteger(localId) || localId <= 0) {
    return Response.json({ ok: false, error: 'localId inválido' }, { status: 400 })
  }

  let text: string
  try {
    text = await extractPdfText(await file.arrayBuffer())
  } catch (e) {
    return Response.json(
      { ok: false, error: 'No pude leer el PDF', detalle: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    )
  }

  const parsed = parseTangoPdf(text)
  if (!parsed.turno || !parsed.fecha) {
    return Response.json(
      { ok: false, error: 'No pude leer fecha/turno del PDF', muestra: text.slice(0, 400) },
      { status: 422 },
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
    montoZ: parsed.montoZ,
    cantidadTickets: parsed.cantidadTickets,
    ventas: parsed.ventas,
  })
}
