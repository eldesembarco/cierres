'use client'

/**
 * Input de moneda controlado.
 * - Mantiene el valor numérico limpio en el estado del padre (prop `value` / `onChange`).
 * - Muestra el número formateado con separador de miles es-AR (sin símbolo: el "$"
 *   va como adorno a la izquierda).
 * - Al tipear, descarta todo lo que no sea dígito → parsea a number. Vacío ⇒ 0.
 */
export function MoneyInput({
  value,
  onChange,
  id,
  className = '',
}: {
  value: number
  onChange: (n: number) => void
  id?: string
  className?: string
}) {
  const display = value === 0 ? '' : value.toLocaleString('es-AR')

  function handleChange(raw: string) {
    const digits = raw.replace(/[^\d]/g, '')
    onChange(digits === '' ? 0 : Number(digits))
  }

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-400">
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        placeholder="0"
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 py-2 pl-7 pr-3 text-right tabular-nums text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
