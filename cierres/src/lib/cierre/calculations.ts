import { round2, sumMoney } from '@/lib/money'
import type { CierreInput, CierreTotales } from '@/lib/cierre/types'

const TIPOS_CREDITO = new Set(['mastercard', 'visa_credito', 'amex'])
const TIPOS_DEBITO = new Set(['maestro', 'visa_debito'])

export function calcularTotales(input: CierreInput): CierreTotales {
  const ventaTotal = sumMoney(input.ventas.map((v) => v.monto))
  const ventaNeta = round2(ventaTotal - input.notaCredito)
  const ventaEfectivo = sumMoney(
    input.ventas.filter((v) => v.canal === 'efectivo').map((v) => v.monto),
  )
  const totalZ = sumMoney(input.turnos.map((t) => t.montoZ))
  const totalDepositado = sumMoney(input.turnos.map((t) => t.efectivoDepositado))
  const saldoEfectivo = round2(ventaEfectivo - input.gastosTotal)
  // Fórmula validada contra el Excel: diferencia = lo depositado − el saldo de efectivo esperado.
  const diferenciaCaja = round2(totalDepositado - saldoEfectivo)
  const totalCredito = sumMoney(
    input.tarjetas.filter((t) => TIPOS_CREDITO.has(t.tipo)).map((t) => t.monto),
  )
  const totalDebito = sumMoney(
    input.tarjetas.filter((t) => TIPOS_DEBITO.has(t.tipo)).map((t) => t.monto),
  )
  const ticketPromedio =
    input.cantidadTickets && input.cantidadTickets > 0
      ? round2(ventaNeta / input.cantidadTickets)
      : null

  return {
    ventaTotal,
    ventaNeta,
    ventaEfectivo,
    totalZ,
    totalDepositado,
    saldoEfectivo,
    diferenciaCaja,
    totalCredito,
    totalDebito,
    ticketPromedio,
  }
}
