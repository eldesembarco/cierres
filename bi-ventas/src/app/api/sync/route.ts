// Sincroniza la venta de Tango (hora + artículo) a nuestra base.
// GET: cron de Vercel (Authorization: Bearer CRON_SECRET). Default: ayer.
// POST: manual con x-sync-secret (SYNC_SECRET), con ?desde&hasta para backfill.
import { ayerAr } from '@/lib/fecha'
import { syncVentasTango } from '@/lib/tango/syncVentas'
import { TangoBridgeError } from '@/lib/tango/ventasBridge'

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
  const secret = process.env.SYNC_SECRET
  if (!secret || request.headers.get('x-sync-secret') !== secret) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde') ?? ayerAr()
  const hasta = searchParams.get('hasta') ?? desde
  return correr(desde, hasta)
}
