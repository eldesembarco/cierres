// Descarga desde el sistema del consolidado de Liberaciones de MP de un día (el
// mismo Excel que sale por mail: hoja Detalle + Resumen por local, todos los
// locales). Autenticado por sesión: central/admin/contable (puedeVerFinanzas).
//
//   GET /api/mp/reporte?fecha=YYYY-MM-DD   (sin fecha = ayer hora Argentina)
import { auth } from '@/lib/auth/auth'
import { puedeVerFinanzas } from '@/lib/auth/rbac'
import { armarConsolidadoDia } from '@/lib/mp/reporteDia'
import { ayerAr } from '@/lib/fecha'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return new Response('No autenticado', { status: 401 })
  if (!puedeVerFinanzas(session.user.rol)) return new Response('Sin permiso', { status: 403 })

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('fecha')?.trim()
  const fecha = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ayerAr()

  try {
    const cons = await armarConsolidadoDia(fecha)
    return new Response(new Uint8Array(cons.xlsx), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="MP-Liberaciones-${fecha}.xlsx"; filename*=UTF-8''${encodeURIComponent(cons.archivoNombre)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return new Response(
      `No pude armar el consolidado de Mercado Pago: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    )
  }
}
