import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getSubscription } from '@/lib/subscriptions'
import { brand } from '@/lib/config/brand'
import { CuentaClient } from './CuentaClient'

export const metadata = { title: `Mi cuenta · ${brand.name}` }
export const dynamic = 'force-dynamic'

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; mp?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/cuenta')

  const user = await currentUser()
  const email = user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? ''
  const name = user?.firstName ?? user?.username ?? email.split('@')[0]

  const sub = await getSubscription(userId)
  const params = await searchParams
  const price = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_ARS ?? '1500')

  return (
    <section className="spotlight-bg pt-32 pb-24 min-h-[80vh]">
      <div className="container-page">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow mb-4">Mi cuenta</p>
          <h1 className="font-serif text-5xl italic text-cream-50 md:text-6xl">Hola, {name}</h1>
          <p className="mt-3 text-sm text-cream-200/70">{email}</p>

          <CuentaClient
            initialActive={sub.active}
            initialLastEvent={sub.lastEvent ?? null}
            price={price}
            mpReturn={params.mp === 'return'}
            upgradePrompt={params.upgrade === '1'}
          />

          <div className="mt-16 border-t border-cream-400/10 pt-8 text-center">
            <Link href="/archivo" className="btn-ghost">Explorar el archivo</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
