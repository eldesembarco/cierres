import { kv } from '@vercel/kv'

export type SubscriptionStatus = {
  active: boolean
  preapprovalId?: string
  activatedAt?: string
  cancelledAt?: string
  lastEvent?: string
}

const key = (userId: string) => `sub:${userId}`
const revKey = (preapprovalId: string) => `pre:${preapprovalId}:user`

export async function getSubscription(userId: string): Promise<SubscriptionStatus> {
  try {
    const v = await kv.get<SubscriptionStatus>(key(userId))
    return v ?? { active: false }
  } catch {
    return { active: false }
  }
}

export async function setSubscription(userId: string, s: SubscriptionStatus): Promise<void> {
  await kv.set(key(userId), s)
  if (s.preapprovalId) {
    await kv.set(revKey(s.preapprovalId), userId)
  }
}

export async function getUserByPreapproval(preapprovalId: string): Promise<string | null> {
  try {
    return await kv.get<string>(revKey(preapprovalId))
  } catch {
    return null
  }
}

export async function isSubscribed(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  const s = await getSubscription(userId)
  return !!s.active
}
