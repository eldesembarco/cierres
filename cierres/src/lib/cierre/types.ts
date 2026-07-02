export type Canal =
  | 'efectivo' | 'tarjetas' | 'rappi' | 'pedidosya' | 'pedidosya_efectivo' | 'mercado_pedidos'
  | 'mercadopago' | 'pvs_qr' | 'uber' | 'delivery_propio' | 'varios'

export type Turno = 'manana' | 'tarde'
export type TipoTarjeta = 'mastercard' | 'maestro' | 'visa_credito' | 'visa_debito' | 'amex'

// Rubro de gasto: ahora es texto libre (lista de rubros + "Otros" en la UI),
// ya no un enum. La columna en la base es TEXT.
export type TipoGasto = string
export type FormaPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro' | 'cuenta_corriente' | 'fondo_fijo'

export interface Cupon { referencia: string; importe: number }

export interface Gasto {
  tipo: TipoGasto
  formaPago: FormaPago
  monto: number
  descripcion?: string | null
  comprobanteId?: number | null
  facturaNumero?: string | null
  facturaTotal?: number | null
  // Proveedor al que se le debe, sólo relevante cuando formaPago === 'cuenta_corriente'.
  proveedorId?: number | null
}

export interface TurnoInput {
  fondoFijo: number
  montoZ: number
  efectivoDepositado: number
  notaCredito: number
  cantidadTickets?: number | null
  ventas: { canal: Canal; monto: number }[]
  tarjetas: { tipo: TipoTarjeta; monto: number; lote?: string | null }[]
  detalles: { canal: Canal; referencia: string; importe: number }[]
  gastos: Gasto[]
}

export interface TurnoTotales {
  ventaTotal: number
  ventaNeta: number
  ventaEfectivo: number
  gastosTotal: number
  gastosEfectivo: number
  gastosFondoFijo: number
  fondoFijoRestante: number
  saldoEfectivo: number
  diferenciaCaja: number
  totalCredito: number
  totalDebito: number
  ticketPromedio: number | null
}

export interface DiaTotales {
  ventaTotalDia: number
  ventaEfectivoDia: number
  totalDepositadoDia: number
  diferenciaDia: number
}
