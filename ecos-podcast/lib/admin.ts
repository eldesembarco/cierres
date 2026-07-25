import { currentUser } from '@clerk/nextjs/server'

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const primaryEmail = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return !!primaryEmail && admins.includes(primaryEmail.toLowerCase())
}
