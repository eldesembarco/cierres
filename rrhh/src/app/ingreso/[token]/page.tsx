// Página PÚBLICA del ingresante: /ingreso/[token]. Fuera del grupo (app):
// sin sidebar, fondo paper y header propio con la marca.
import type { LucideIcon } from 'lucide-react'
import { BadgeCheck, CalendarClock, Flame, MailQuestion } from 'lucide-react'
import { getCatalogos, getInvitacionByToken, isDemo } from '@/lib/data'
import { Badge, DemoBanner, MarcaDot } from '@/components/ui/kit'
import { WizardIngreso } from './_components/WizardIngreso'

export const metadata = { title: 'Ingreso' }

function Shell({ demo, children }: { demo: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-8 pt-8 sm:pt-12">
        {demo && <DemoBanner />}
        <header className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-white shadow-[0_0_24px_rgba(232,89,12,0.35)]">
            <Flame className="size-5" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight text-ink">RRHH</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Grupo Desembarco
            </div>
          </div>
        </header>
        {children}
        <footer className="mt-auto pt-12 text-center text-[11px] font-semibold text-ink-3">
          © {new Date().getFullYear()} Grupo Desembarco · Tus datos se comparten únicamente con RRHH
        </footer>
      </div>
    </div>
  )
}

function Mensaje({ icon: Icon, chip, titulo, texto }: {
  icon: LucideIcon
  chip: string
  titulo: string
  texto: string
}) {
  return (
    <div className="rise mt-16 flex flex-col items-center text-center sm:mt-24">
      <div className={`flex size-16 items-center justify-center rounded-2xl ${chip}`}>
        <Icon className="size-8" strokeWidth={2} />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">{titulo}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">{texto}</p>
    </div>
  )
}

export default async function IngresoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [inv, demo] = [await getInvitacionByToken(token), isDemo()]

  if (!inv) {
    return (
      <Shell demo={demo}>
        <Mensaje
          icon={MailQuestion}
          chip="bg-black/5 text-ink-3"
          titulo="No encontramos tu invitación"
          texto="Revisá que el link esté completo, tal cual te lo mandaron. Si sigue sin funcionar, pedile un link nuevo a RRHH."
        />
      </Shell>
    )
  }

  if (inv.estado === 'EXPIRADA') {
    return (
      <Shell demo={demo}>
        <Mensaje
          icon={CalendarClock}
          chip="bg-warn-soft text-warn"
          titulo="Tu link de ingreso venció"
          texto="Los links de ingreso duran unos días por seguridad. Pedile un link nuevo a RRHH y retomamos desde acá, sin vueltas."
        />
      </Shell>
    )
  }

  if (inv.estado === 'COMPLETADA' || inv.estado === 'APROBADA') {
    return (
      <Shell demo={demo}>
        <Mensaje
          icon={BadgeCheck}
          chip="bg-ok-soft text-ok"
          titulo="Ya recibimos tus datos"
          texto={
            inv.estado === 'APROBADA'
              ? 'Tu ingreso ya está aprobado. ¡Te esperamos en tu primer día!'
              : 'RRHH los está revisando y te va a avisar apenas apruebe tu alta. No tenés que hacer nada más.'
          }
        />
      </Shell>
    )
  }

  // Invitación válida (ENVIADA o EN_CURSO): hero + wizard
  const catalogos = await getCatalogos()
  const loc = inv.locacionId != null
    ? catalogos.locaciones.find(l => l.id === inv.locacionId)
    : undefined

  return (
    <Shell demo={demo}>
      <section className="rise mt-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Tu ingreso</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink">
          Bienvenido/a al Grupo Desembarco
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-2">
          Completá tus datos en tres pasos cortos así RRHH deja tu legajo listo antes del primer día.
        </p>
        {(inv.posicion || inv.locacion) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {inv.posicion && <Badge tone="brand">{inv.posicion}</Badge>}
            {inv.locacion && (
              <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1">
                <MarcaDot marca={inv.locacion} color={loc?.marcaColor ?? null} />
              </span>
            )}
            {loc?.marca && <Badge tone="neutral">{loc.marca}</Badge>}
          </div>
        )}
      </section>

      <div className="mt-7">
        <WizardIngreso
          token={inv.token}
          emailInicial={inv.email}
          nombreInicial={inv.nombre ?? ''}
        />
      </div>
    </Shell>
  )
}
