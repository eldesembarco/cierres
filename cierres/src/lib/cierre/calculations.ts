import { round2, sumMoney } from '@/lib/money'
import type { CierreInput, CierreTotales } from '@/lib/cierre/types'

export function calcularTotales(input: CierreInput): CierreTotales {
  const ventaTotal = sumMoney(input.ventas.map((v) => v.monto))
  const ventaNeta = round2(ventaTotal - input.notaCredito)
  const ventaEfectivo = sumMoney(
    input.ventas.filter((v) => v.canal === 'efectivo').map((v) => v.monto),
  )
  const totalZ = sumMoney(input.turnos.map((t) => t.montoZ))
  const saldoEfectivo = round2(ventaEfectivo - input.gastosTotal)
  // Fórmula PROVISIONAL: se calibra contra el Excel en el piloto (spec sección 8).
  const diferenciaCaja = round2(totalZ - ventaTotal)
  const ticketPromedio =
    input.cantidadTickets && input.cantidadTickets > 0
      ? round2(ventaNeta / input.cantidadTickets)
      : null

  return { ventaTotal, ventaNeta, ventaEfectivo, totalZ, saldoEfectivo, diferenciaCaja, ticketPromedio }
}
