// Sincroniza la venta de Tango (hora + artículo) a nuestra base para el BI.
// GET: para el cron de Vercel (Authorization: Bearer CRON_SECRET). Default: ayer.
// POST: manual desde la app (sesión central/admin) o con x-sync-secret
// (TANGO_INGEST_SECRET, mismo que usa n8n), con ?desde&hasta para backfill.
import { auth } from '@/lib/auth/auth'
import { esCentral } from '@/lib/auth/rbac'
import { ayerAr } from '@/lib/fecha'
import { syncVentasTango } from '@/lib/tango/syncVentas'
import { TangoBridgeError } from '@/lib/tango/cobrosBridge'

export const maxDuration = 60

const YMD = /^\d{4}-\d{2}-\d{2}$/

async function correr(desde: string, hasta: string) {
  if (!YMD.test(desde) || !YMD.test(hasta) || desde > hasta) {
    return Response.json({ error: 'Rango inválido (desde/hasta YYYY-MM-DD)' }, { status: 400 })
  }
  try {
    const result = await syncVentasTango(desde, hasta)
    return Response.json(result)
  } catch (e) {
    if (e instanceof TangoBridgeError) return Response.json({ error: e.message }, { status: 502 })
    throw e
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authz = request.headers.get('authorization')
  if (!cronSecret || authz !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') ?? ayerAr()
  return correr(fecha, fecha)
}

export async function POST(request: Request) {
  const secret = process.env.TANGO_INGEST_SECRET
  const conSecret = secret != null && request.headers.get('x-sync-secret') === secret
  if (!conSecret) {
    const session = await auth()
    if (!session || !esCentral(session.user.rol)) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
  }
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde') ?? ayerAr()
  const hasta = searchParams.get('hasta') ?? desde
  return correr(desde, hasta)
}
