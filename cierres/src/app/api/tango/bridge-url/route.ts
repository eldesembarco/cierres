// Registro de la URL viva del bridge de Tango. El bridge (C:\tango-bridge en
// SRVTANGO) usa un quick-tunnel de Cloudflare cuya URL cambia en cada arranque:
// al levantar el túnel hace POST acá con la URL nueva (auth x-ingest-secret,
// mismo esquema que /api/tango/ingest). El GET lo pueden usar otras apps del
// grupo (ej. el BI de ventas) para resolver dónde está el bridge ahora.
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

function autorizado(request: Request): boolean {
  const secret = process.env.TANGO_INGEST_SECRET
  return Boolean(secret) && request.headers.get('x-ingest-secret') === secret
}

export async function POST(request: Request) {
  if (!autorizado(request)) return Response.json({ error: 'No autorizado' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { url } = (body ?? {}) as { url?: unknown }
  // Solo aceptamos túneles de Cloudflare (evita que un secreto filtrado apunte
  // los consumidores a un host arbitrario).
  if (typeof url !== 'string' || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(url)) {
    return Response.json({ error: 'url inválida (se espera https://*.trycloudflare.com)' }, { status: 400 })
  }

  await prisma.tangoBridge.upsert({
    where: { id: 1 },
    create: { id: 1, url },
    update: { url },
  })
  return Response.json({ ok: true, url })
}

export async function GET(request: Request) {
  if (!autorizado(request)) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const row = await prisma.tangoBridge.findUnique({ where: { id: 1 } })
  return Response.json({ url: row?.url ?? null, actualizadoEn: row?.actualizadoEn ?? null })
}
