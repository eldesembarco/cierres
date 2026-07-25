import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createPreapproval } from '@/lib/mp'
import { setSubscription, getSubscription } from '@/lib/subscriptions'

export const runtime = 'nodejs'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const user = await currentUser()
  const email = user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
  if (!email) return NextResponse.json({ error: 'no-email' }, { status: 400 })

  try {
    const existing = await getSubscription(userId)
    if (existing.active) {
      return NextResponse.json({ error: 'already-subscribed' }, { status: 400 })
    }
    const pre = await createPreapproval(email, userId)
    if (!pre.id) throw new Error('MP no devolvió id de preapproval')
    await setSubscription(userId, {
      active: false,
      preapprovalId: pre.id,
      lastEvent: 'created',
    })
    return NextResponse.json({ id: pre.id, init_point: pre.init_point })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'MP error' }, { status: 500 })
  }
}
