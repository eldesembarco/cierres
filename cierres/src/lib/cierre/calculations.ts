import { round2, sumMoney } from '@/lib/money'
import type { TurnoInput, TurnoTotales, DiaTotales } from '@/lib/cierre/types'

const TIPOS_CREDITO = new Set(['mastercard', 'visa_credito', 'amex'])
const TIPOS_DEBITO = new Set(['maestro', 'visa_debito'])
// Canales que entran a la caja en efectivo: el efectivo de mostrador y las ventas
// de PedidosYa cobradas en efectivo (el cliente paga cash al cadete → entra a la caja).
const CANALES_EFECTIVO = new Set(['efectivo', 'pedidosya_efectivo'])

export function calcularTotales(t: TurnoInput): TurnoTotales {
  const ventaTotal = sumMoney(t.ventas.map((v) => v.monto))
  const ventaNeta = round2(ventaTotal - t.notaCredito)
  const ventaEfectivo = sumMoney(
    t.ventas.filter((v) => CANALES_EFECTIVO.has(v.canal)).map((v) => v.monto),
  )
  // Solo los gastos pagados en efectivo reducen el saldo de caja del día.
  const gastosEfectivo = sumMoney(
    t.gastos.filter((g) => g.formaPago === 'efectivo').map((g) => g.monto),
  )
  // Gastos pagados con el fondo fijo del local: NO salen de la caja del día
  // (salen de la plata del fondo fijo), por eso no tocan la diferencia. Lo que
  // hacen es "bajar" el fondo fijo: el restante es lo que queda para reponer.
  const gastosFondoFijo = sumMoney(
    t.gastos.filter((g) => g.formaPago === 'fondo_fijo').map((g) => g.monto),
  )
  const fondoFijoRestante = round2(t.fondoFijo - gastosFondoFijo)
  const gastosTotal = sumMoney(t.gastos.map((g) => g.monto))
  // El efectivo "guardado para el fondo fijo" (recupero) sale de la caja del día igual
  // que un gasto en efectivo → baja el efectivo esperado a depositar (no es faltante).
  // Sube el fondo fijo del local aparte (ver getSaldoFondoFijo), no acá.
  const retiroFondoFijo = round2(t.retiroFondoFijo ?? 0)
  const saldoEfectivo = round2(ventaEfectivo - gastosEfectivo - retiroFondoFijo)
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
    gastosFondoFijo,
    fondoFijoRestante,
    retiroFondoFijo,
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
