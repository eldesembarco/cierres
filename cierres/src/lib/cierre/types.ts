export type Canal =
  | 'efectivo' | 'tarjetas' | 'rappi' | 'pedidosya' | 'mercado_pedidos'
  | 'mercadopago' | 'uber' | 'delivery_propio' | 'varios'

export type Turno = 'T1' | 'T2'
export type TipoTarjeta = 'mastercard' | 'maestro' | 'visa_credito' | 'visa_debito' | 'amex'

export interface CierreInput {
  fondoFijo: number
  gastosTotal: number
  notaCredito: number
  cantidadTickets?: number | null
  turnos: { turno: Turno; montoZ: number; efectivoDepositado: number }[]
  ventas: { canal: Canal; monto: number }[]
  tarjetas: { turno: Turno; tipo: TipoTarjeta; monto: number; lote?: string | null }[]
}

export interface CierreTotales {
  ventaTotal: number
  ventaNeta: number
  ventaEfectivo: number
  totalZ: number
  totalDepositado: number
  saldoEfectivo: number
  diferenciaCaja: number
  totalCredito: number
  totalDebito: number
  ticketPromedio: number | null
}
