import { z } from 'zod'

const canal = z.enum(['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercado_pedidos', 'mercadopago', 'uber', 'delivery_propio', 'varios'])
const tipoTarjeta = z.enum(['mastercard', 'maestro', 'visa_credito', 'visa_debito', 'amex'])
// Rubro de gasto: texto libre (la UI ofrece una lista + "Otros").
const tipoGasto = z.string().min(1)
const formaPago = z.enum(['efectivo', 'tarjeta', 'transferencia', 'otro', 'cuenta_corriente'])
const monto = z.number().nonnegative()

export const turnoInputSchema = z.object({
  fondoFijo: monto,
  montoZ: monto,
  efectivoDepositado: monto.default(0),
  notaCredito: monto,
  cantidadTickets: z.number().int().nonnegative().nullable().optional(),
  ventas: z.array(z.object({ canal, monto }))
    .refine((vs) => new Set(vs.map((v) => v.canal)).size === vs.length, 'Canales duplicados'),
  tarjetas: z.array(z.object({ tipo: tipoTarjeta, monto, lote: z.string().nullable().optional() }))
    .default([]),
  detalles: z.array(z.object({ canal, referencia: z.string(), importe: monto }))
    .default([]),
  gastos: z.array(z.object({
    tipo: tipoGasto,
    formaPago,
    monto,
    descripcion: z.string().nullable().optional(),
    comprobanteId: z.number().int().nullable().optional(),
    facturaNumero: z.string().nullable().optional(),
    facturaTotal: z.number().nonnegative().nullable().optional(),
  })).default([]),
})

export type TurnoInputParsed = z.infer<typeof turnoInputSchema>
