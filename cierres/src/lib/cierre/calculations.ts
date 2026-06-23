import { round2, sumMoney } from '@/lib/money'
import type { TurnoInput, TurnoTotales, DiaTotales } from '@/lib/cierre/types'

const TIPOS_CREDITO = new Set(['mastercard', 'visa_credito', 'amex'])
const TIPOS_DEBITO = new Set(['maestro', 'visa_debito'])

export function calcularTotales(t: TurnoInput): TurnoTotales {
  const ventaTotal = sumMoney(t.ventas.map((v) => v.monto))
  const ventaNeta = round2(ventaTotal - t.notaCredito)
  const ventaEfectivo = sumMoney(
    t.ventas.filter((v) => v.canal === 'efectivo').map((v) => v.monto),
  )
  // Solo los gastos pagados en efectivo reducen el saldo de caja.
  const gastosEfectivo = sumMoney(
    t.gastos.filter((g) => g.formaPago === 'efectivo').map((g) => g.monto),
  )
  const gastosTotal = sumMoney(t.gastos.map((g) => g.monto))
  const saldoEfectivo = round2(ventaEfectivo - gastosEfectivo)
  // Fórmula validada contra el Excel: diferencia = lo depositado − el saldo de efectivo esperado.
  const diferenciaCaja = round2(t.efectivoDepositado - saldoEfectivo)
  const totalCredito = sumMoney(
    t.tarjetas.filter((x) => TIPOS_CREDITO.has(x.tipo)).map((x) => x.monto),
  )
  const totalDebito = sumMoney(
    t.tarjetas.filter((x) => TIPOS_DEBITO.has(x.tipo)).map((x) => x.monto),
  )
  const ticketPromedio =
    t.cantidadTickets && t.cantidadTickets > 0
      ? round2(ventaNeta / t.cantidadTickets)
      : null

  return {
    ventaTotal,
    ventaNeta,
    ventaEfectivo,
    gastosTotal,
    gastosEfectivo,
    saldoEfectivo,
    diferenciaCaja,
    totalCredito,
    totalDebito,
    ticketPromedio,
  }
}

export function sumarDia(turnos: TurnoTotales[]): DiaTotales {
  return {
    ventaTotalDia: sumMoney(turnos.map((t) => t.ventaTotal)),
    ventaEfectivoDia: sumMoney(turnos.map((t) => t.ventaEfectivo)),
    totalDepositadoDia: sumMoney(turnos.map((t) => t.diferenciaCaja + t.saldoEfectivo)),
    diferenciaDia: sumMoney(turnos.map((t) => t.diferenciaCaja)),
  }
}
