import { NextResponse } from 'next/server'
import { getPreapproval } from '@/lib/mp'
import { getUserByPreapproval, getSubscription, setSubscription } from '@/lib/subscriptions'

export const runtime = 'nodejs'

/**
 * Mercado Pago sends webhooks for topic=preapproval when the user
 * authorizes / pauses / cancels the subscription. We validate by
 * fetching the preapproval from MP (single source of truth).
 */
async function process(preapprovalId: string) {
  const pre = await getPreapproval(preapprovalId)
  const userId = pre.external_reference || (await getUserByPreapproval(preapprovalId))
  if (!userId) return { ok: false, reason: 'no-user-mapping' }
  const status = pre.status // "authorized" | "pending" | "paused" | "cancelled"
  const active = status === 'authorized'
  const existing = await getSubscription(userId)
  await setSubscription(userId, {
    active,
    preapprovalId,
    activatedAt: active ? new Date().toISOString() : existing.activatedAt,
    cancelledAt: !active && (status === 'cancelled' || status === 'paused')
      ? new Date().toISOString()
      : existing.cancelledAt,
    lastEvent: status ?? 'unknown',
  })
  return { ok: true, status, userId }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const url = new URL(req.url)
    const topic = body?.topic ?? body?.type ?? url.searchParams.get('topic') ?? url.searchParams.get('type')
    const id = body?.data?.id ?? body?.id ?? url.searchParams.get('id') ?? url.searchParams.get('data.id')

    if (topic !== 'preapproval' && topic !== 'subscription_preapproval') {
      return NextResponse.json({ ignored: true, topic })
    }
    if (!id) return NextResponse.json({ error: 'no-id' }, { status: 400 })

    const res = await process(String(id))
    return NextResponse.json(res)
  } catch (e: any) {
    // Log server-side only — never echo internals (they can contain auth headers).
    console.error('MP webhook error', e)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

// MP a veces pega también con GET para verificar el endpoint
export async function GET(req: Request) {
  return POST(req)
}
