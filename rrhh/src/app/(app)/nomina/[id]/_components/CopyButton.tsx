'use client'
// Botón chico de copiar al portapapeles con feedback (check verde).
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      title={label ? `Copiar ${label}` : 'Copiar'}
      aria-label={label ? `Copiar ${label}` : 'Copiar'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1600)
        } catch {
          // sin permiso de clipboard: no rompemos nada
        }
      }}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-black/5 hover:text-ink"
    >
      {copiado
        ? <Check className="size-3.5 text-ok" strokeWidth={2.25} />
        : <Copy className="size-3.5" strokeWidth={2} />}
    </button>
  )
}
