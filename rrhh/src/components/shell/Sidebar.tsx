import { Flame } from 'lucide-react'
import { NavLinks } from './NavLinks'
import { SignOutButton } from './SignOutButton'

export function Sidebar({ userName, demo }: { userName: string; demo: boolean }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-coal px-3 py-5">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-white shadow-[0_0_24px_rgba(232,89,12,0.45)]">
          <Flame className="size-5" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-white">RRHH</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-coal-muted">Grupo Desembarco</div>
        </div>
      </div>

      <NavLinks />

      <div className="mt-auto space-y-3">
        {demo && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold leading-snug text-coal-muted">
            <span className="font-extrabold text-brand">Modo demo</span> — sin base conectada
          </div>
        )}
        <div className="flex items-center gap-2.5 border-t border-white/10 px-2 pt-4">
          <div className="flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-extrabold text-white">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-bold text-coal-ink">{userName}</div>
            <div className="text-[10px] text-coal-muted">RRHH</div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </aside>
  )
}
