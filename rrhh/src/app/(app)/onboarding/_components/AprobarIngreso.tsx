'use client'
// Botón de aprobación de un alta COMPLETADA + link al legajo del ingresante.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { aprobarIngreso } from '@/lib/actions'
import { Button, ButtonLink } from '@/components/ui/kit'

const avisoCls = {
  demo: 'bg-brand-soft text-brand-strong',
  error: 'bg-bad-soft text-bad',
  ok: 'bg-ok-soft text-ok',
} as const

export function AprobarIngreso({ invitacionId, empleadoId }: {
  invitacionId: number
  empleadoId: number | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [aviso, setAviso] = useState<{ tone: keyof typeof avisoCls; texto: string } | null>(null)

  function aprobar() {
    setAviso(null)
    startTransition(async () => {
      const res = await aprobarIngreso(invitacionId)
      if (!res.ok) {
        setAviso({ tone: 'error', texto: res.error ?? 'No se pudo aprobar el ingreso' })
        return
      }
      if (res.demo) {
        setAviso({ tone: 'demo', texto: 'Modo demo: el cambio no se persiste.' })
        return
      }
      setAviso({ tone: 'ok', texto: 'Ingreso aprobado' })
      router.refresh()
    })
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={aprobar}
          disabled={pending}
          icon={pending ? undefined : Check}
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Aprobar ingreso
        </Button>
        {empleadoId != null && (
          <ButtonLink size="sm" variant="secondary" href={`/nomina/${empleadoId}`}>
            Ver legajo
          </ButtonLink>
        )}
      </div>
      {aviso && (
        <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${avisoCls[aviso.tone]}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  )
}
