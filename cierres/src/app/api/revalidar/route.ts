// Invalidación de tags del Data Cache desde afuera de la app (auth x-ingest-secret).
// Lo usan los scripts de administración que tocan la base por SQL directo (p. ej.
// reaperturas de cierres): sin esto, una fecha pasada quedaría cacheada hasta 24h
// después de reabrirla. Body: { "tags": ["cierre-<localId>-<fecha>", ...] }.
import { revalidateTag } from 'next/cache'

export const runtime = 'nodejs'

const TAG_OK = /^[a-z0-9-]+$/i

export async function POST(request: Request) {
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
  const { tags } = (body ?? {}) as { tags?: unknown }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 50 || !tags.every((t) => typeof t === 'string' && TAG_OK.test(t))) {
    return Response.json({ error: 'tags: lista de 1-50 strings [a-z0-9-]' }, { status: 400 })
  }
  // { expire: 0 }: expira ya — la próxima visita ve datos frescos (las
  // reaperturas por SQL directo necesitan efecto inmediato, no stale-while-revalidate).
  for (const t of tags as string[]) revalidateTag(t, { expire: 0 })
  return Response.json({ ok: true, revalidados: tags.length })
}
