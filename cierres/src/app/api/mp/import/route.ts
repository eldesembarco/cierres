// Importador del reporte "collection" de Mercado Pago (.xlsx) — solo admin/central.
// Recibe el Excel por FormData, lo agrega por (local, fecha) y lo deja en
// ventas_app (plataforma "Mercado Delivery"), para que el control de cajas compare
// lo declarado en el cierre (canal Mercado Delivery) contra la plata real de MP.
import { auth } from '@/lib/auth/auth'
import { esCentral } from '@/lib/auth/rbac'
import { ingestMercadoPago } from '@/lib/ingest/ingestMercadoPago'

// exceljs lee el archivo del lado del servidor → runtime Node.
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
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: 'Falta el archivo de Mercado Pago (.xlsx)' }, { status: 400 })
  }

  try {
    const result = await ingestMercadoPago({
      fileBuffer: await file.arrayBuffer(),
      archivoNombre: file.name,
      subidoPor: Number(session.user.id),
    })
    return Response.json({ ok: true, ...result })
  } catch (e) {
    return Response.json(
      { ok: false, error: 'No pude procesar el Excel de Mercado Pago', detalle: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    )
  }
}
