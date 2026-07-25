import { MercadoPagoConfig, PreApproval } from 'mercadopago'

const token = process.env.MP_ACCESS_TOKEN
const client = token ? new MercadoPagoConfig({ accessToken: token }) : null

export const mpClient = client
export const preapproval = client ? new PreApproval(client) : null

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export function getPriceArs(): number {
  const v = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_ARS ?? '1500')
  return Number.isFinite(v) && v > 0 ? v : 1500
}

/**
 * Create a per-user Preapproval (no plan required — inline reason/frequency).
 * Returns { init_point, id } — redirect the user to init_point.
 */
export async function createPreapproval(payerEmail: string, userId: string) {
  if (!preapproval) throw new Error('MP not configured (missing MP_ACCESS_TOKEN)')
  const appUrl = getAppUrl()
  const amount = getPriceArs()
  const res = await preapproval.create({
    body: {
      reason: 'ECOS · Archivo completo (mensual)',
      external_reference: userId,
      payer_email: payerEmail,
      back_url: `${appUrl}/cuenta?mp=return`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'ARS',
      },
      status: 'pending',
    },
  })
  return { id: res.id, init_point: res.init_point }
}

export async function getPreapproval(id: string) {
  if (!preapproval) throw new Error('MP not configured')
  return await preapproval.get({ id })
}

export async function cancelPreapproval(id: string) {
  if (!preapproval) throw new Error('MP not configured')
  return await preapproval.update({ id, body: { status: 'cancelled' } })
}
