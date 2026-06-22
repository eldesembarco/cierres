export type Canal =
  | 'efectivo' | 'tarjetas' | 'rappi' | 'pedidosya'
  | 'mercadopago' | 'uber' | 'delivery_propio' | 'varios'

export type Turno = 'T1' | 'T2'

export interface CierreInput {
  fondoFijo: number
  gastosTotal: number
  notaCredito: number
  cantidadTickets?: number | null
  turnos: { turno: Turno; montoZ: number }[]
  ventas: { canal: Canal; monto: number }[]
}

export interface CierreTotales {
  ventaTotal: number
  ventaNeta: number
  ventaEfectivo: number
  totalZ: number
  saldoEfectivo: number
  diferenciaCaja: number
  ticketPromedio: number | null
}
