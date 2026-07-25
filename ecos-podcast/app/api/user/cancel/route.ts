import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cancelPreapproval } from '@/lib/mp'
import { getSubscription, setSubscription } from '@/lib/subscriptions'

export const runtime = 'nodejs'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  const s = await getSubscription(userId)
  if (!s.preapprovalId) return NextResponse.json({ error: 'no-subscription' }, { status: 400 })
  try {
    await cancelPreapproval(s.preapprovalId)
    await setSubscription(userId, {
      ...s,
      active: false,
      cancelledAt: new Date().toISOString(),
      lastEvent: 'cancelled-by-user',
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('MP cancel error', e)
    return NextResponse.json({ error: 'mp-error' }, { status: 500 })
  }
}
