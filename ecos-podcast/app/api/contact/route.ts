import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const nombre = String(body?.nombre ?? '').slice(0, 200)
    const email = String(body?.email ?? '').slice(0, 200)
    const asunto = String(body?.asunto ?? '').slice(0, 200)
    const historia = String(body?.historia ?? '').slice(0, 5000)
    if (!nombre || !email || !historia) {
      return NextResponse.json({ error: 'missing-fields' }, { status: 400 })
    }
    const entry = { nombre, email, asunto, historia, at: new Date().toISOString() }
    try {
      await kv.lpush('contact:inbox', JSON.stringify(entry))
    } catch (e) {
      // KV not configured yet — log to server, don't fail the user submission
      console.warn('[contact] KV not configured, entry lost:', entry)
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'error' }, { status: 500 })
  }
}
