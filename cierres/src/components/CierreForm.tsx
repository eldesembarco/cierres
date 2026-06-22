'use client'

import { Fragment, useMemo, useState } from 'react'
import { calcularTotales } from '@/lib/cierre/calculations'
import type { Canal, CierreInput } from '@/lib/cierre/types'
import { guardarCierre } from '@/app/cierres/actions'

const CANALES: Canal[] = ['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercadopago', 'uber', 'delivery_propio', 'varios']

export function CierreForm({ fecha, fondoFijoDefault, initial }: { fecha: string; fondoFijoDefault: number; initial?: Partial<CierreInput> }) {
  const [fondoFijo, setFondoFijo] = useState(initial?.fondoFijo ?? fondoFijoDefault)
  const [gastosTotal, setGastos] = useState(initial?.gastosTotal ?? 0)
  const [notaCredito, setNC] = useState(initial?.notaCredito ?? 0)
  const [cantidadTickets, setTickets] = useState<number | ''>(initial?.cantidadTickets ?? '')
  const [z1, setZ1] = useState(0)
  const [z2, setZ2] = useState(0)
  const [ventas, setVentas] = useState<Record<Canal, number>>(
    Object.fromEntries(CANALES.map((c) => [c, 0])) as Record<Canal, number>,
  )
  const [nota, setNota] = useState('')
  const [msg, setMsg] = useState('')

  const input: CierreInput = useMemo(() => ({
    fondoFijo, gastosTotal, notaCredito,
    cantidadTickets: cantidadTickets === '' ? null : Number(cantidadTickets),
    turnos: [{ turno: 'T1', montoZ: z1 }, { turno: 'T2', montoZ: z2 }],
    ventas: CANALES.map((c) => ({ canal: c, monto: ventas[c] })),
  }), [fondoFijo, gastosTotal, notaCredito, cantidadTickets, z1, z2, ventas])

  const t = calcularTotales(input)
  const semaforo = Math.abs(t.diferenciaCaja) === 0 ? '🟢' : Math.abs(t.diferenciaCaja) <= 1000 ? '🟡' : '🔴'

  async function submit(cerrar: boolean) {
    const res = await guardarCierre(fecha, JSON.stringify({ ...input, nota }), cerrar)
    setMsg(res.ok ? (cerrar ? 'Cerrado ✅' : 'Borrador guardado') : res.error)
  }

  const num = (v: number, set: (n: number) => void, label: string) => (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm">{label}</span>
      <input type="number" inputMode="decimal" value={v} onChange={(e) => set(Number(e.target.value))} className="w-36 rounded border p-1 text-right" />
    </label>
  )

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded border p-3">
        <h2 className="mb-2 font-medium">Caja</h2>
        {num(fondoFijo, setFondoFijo, 'Fondo fijo')}
        {num(z1, setZ1, 'Cierre Z · Turno 1')}
        {num(z2, setZ2, 'Cierre Z · Turno 2')}
        {num(gastosTotal, setGastos, 'Gastos')}
        {num(notaCredito, setNC, 'Nota de crédito')}
        <label className="flex items-center justify-between gap-2 py-1">
          <span className="text-sm">Cantidad de tickets</span>
          <input type="number" value={cantidadTickets} onChange={(e) => setTickets(e.target.value === '' ? '' : Number(e.target.value))} className="w-36 rounded border p-1 text-right" />
        </label>
      </section>

      <section className="rounded border p-3">
        <h2 className="mb-2 font-medium">Ventas por canal</h2>
        {CANALES.map((c) => <Fragment key={c}>{num(ventas[c], (n) => setVentas((p) => ({ ...p, [c]: n })), c)}</Fragment>)}
      </section>

      <section className="sticky bottom-0 rounded border bg-white p-3 shadow">
        <div className="flex justify-between"><span>Venta total</span><b>{t.ventaTotal}</b></div>
        <div className="flex justify-between"><span>Venta neta</span><b>{t.ventaNeta}</b></div>
        <div className="flex justify-between"><span>Saldo efectivo</span><b>{t.saldoEfectivo}</b></div>
        <div className="flex justify-between"><span>Ticket promedio</span><b>{t.ticketPromedio ?? '—'}</b></div>
        <div className="flex justify-between"><span>Diferencia de caja</span><b>{semaforo} {t.diferenciaCaja}</b></div>
        {Math.abs(t.diferenciaCaja) > 1000 && (
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Justificá la diferencia para poder cerrar" className="mt-2 w-full rounded border p-1" />
        )}
        <div className="mt-2 flex gap-2">
          <button onClick={() => submit(false)} className="flex-1 rounded border p-2">Guardar borrador</button>
          <button onClick={() => submit(true)} className="flex-1 rounded bg-black p-2 text-white">Cerrar</button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </section>
    </div>
  )
}
