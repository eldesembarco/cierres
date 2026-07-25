import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin'
import { kv } from '@vercel/kv'
import { brand } from '@/lib/config/brand'
import { formatDate } from '@/lib/utils'

export const metadata = { title: `Panel · ${brand.name}` }
export const dynamic = 'force-dynamic'

type Sub = {
  active: boolean
  preapprovalId?: string
  activatedAt?: string
  cancelledAt?: string
  lastEvent?: string
}

async function loadStats() {
  try {
    const keys = await kv.keys('sub:*')
    const values = await Promise.all(keys.map((k) => kv.get<Sub>(k)))
    const subs = values.filter(Boolean) as Sub[]
    const active = subs.filter((s) => s.active).length
    return { total: subs.length, active, subs, keys }
  } catch {
    return { total: 0, active: 0, subs: [] as Sub[], keys: [] as string[], error: true }
  }
}

async function loadContact() {
  try {
    const items = await kv.lrange('contact:inbox', 0, 49)
    return items.map((raw) => {
      try { return JSON.parse(raw as string) } catch { return null }
    }).filter(Boolean) as any[]
  } catch {
    return []
  }
}

export default async function AdminPage() {
  const ok = await isAdmin()
  if (!ok) redirect('/')

  const [stats, contact] = await Promise.all([loadStats(), loadContact()])

  return (
    <section className="spotlight-bg pt-32 pb-24 min-h-[80vh]">
      <div className="container-page">
        <p className="eyebrow mb-4">Admin</p>
        <h1 className="font-serif text-5xl italic text-cream-50">Panel {brand.name}</h1>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <StatBox label="Total registrados con actividad" value={stats.total} />
          <StatBox label="Suscriptores activos" value={stats.active} accent />
          <StatBox label="Mensajes recibidos" value={contact.length} />
        </div>

        <div className="mt-12">
          <h2 className="font-serif text-2xl text-cream-50">Suscripciones</h2>
          <div className="mt-4 overflow-x-auto rounded-sm border border-cream-400/10 bg-ink-800/60">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-cream-400/70">
                <tr>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Preapproval</th>
                  <th className="p-3">Activada</th>
                  <th className="p-3">Cancelada</th>
                  <th className="p-3">Último evento</th>
                </tr>
              </thead>
              <tbody className="text-cream-100/90">
                {stats.keys.map((k, i) => {
                  const s = stats.subs[i]
                  if (!s) return null
                  const uid = k.replace(/^sub:/, '')
                  return (
                    <tr key={k} className="border-t border-cream-400/10">
                      <td className="p-3 font-mono text-[10px]">{uid}</td>
                      <td className="p-3">{s.active ? <span className="text-gold">Activa</span> : <span className="text-cream-400/70">Inactiva</span>}</td>
                      <td className="p-3 font-mono text-[10px]">{s.preapprovalId ?? '—'}</td>
                      <td className="p-3">{s.activatedAt ? formatDate(s.activatedAt) : '—'}</td>
                      <td className="p-3">{s.cancelledAt ? formatDate(s.cancelledAt) : '—'}</td>
                      <td className="p-3">{s.lastEvent ?? '—'}</td>
                    </tr>
                  )
                })}
                {stats.keys.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-cream-400/70">Todavía no hay suscripciones registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="font-serif text-2xl text-cream-50">Últimos mensajes (Contá tu historia)</h2>
          <div className="mt-4 space-y-4">
            {contact.length === 0 && (
              <p className="text-sm text-cream-400/70">Sin mensajes por ahora.</p>
            )}
            {contact.map((c, i) => (
              <div key={i} className="card-panel">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-serif text-lg text-cream-50">{c.nombre}</div>
                    <a href={`mailto:${c.email}`} className="text-xs text-gold hover:underline">{c.email}</a>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-cream-400/70">
                    {c.at ? new Date(c.at).toLocaleString('es-AR') : ''}
                  </div>
                </div>
                {c.asunto && <div className="mt-2 text-xs text-cream-200/80">Asunto: {c.asunto}</div>}
                <p className="mt-3 whitespace-pre-wrap text-sm text-cream-100/90">{c.historia}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StatBox({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border p-6 text-center ${accent ? 'border-gold/60 bg-gold/5' : 'border-cream-400/10 bg-ink-800/60'}`}>
      <div className="font-serif text-4xl text-cream-50">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-cream-400/70">{label}</div>
    </div>
  )
}
