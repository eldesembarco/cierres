import { z } from 'zod'

const canal = z.enum(['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercado_pedidos', 'mercadopago', 'uber', 'delivery_propio', 'varios'])
const turno = z.enum(['T1', 'T2'])
const tipoTarjeta = z.enum(['mastercard', 'maestro', 'visa_credito', 'visa_debito', 'amex'])
const monto = z.number().nonnegative()

export const cierreInputSchema = z.object({
  fondoFijo: monto,
  gastosTotal: monto,
  notaCredito: monto,
  cantidadTickets: z.number().int().nonnegative().nullable().optional(),
  turnos: z.array(z.object({ turno, montoZ: monto, efectivoDepositado: monto.default(0) }))
    .refine((ts) => new Set(ts.map((t) => t.turno)).size === ts.length, 'Turnos duplicados'),
  ventas: z.array(z.object({ canal, monto }))
    .refine((vs) => new Set(vs.map((v) => v.canal)).size === vs.length, 'Canales duplicados'),
  tarjetas: z.array(z.object({ turno, tipo: tipoTarjeta, monto, lote: z.string().nullable().optional() }))
    .default([]),
})

export type CierreInputParsed = z.infer<typeof cierreInputSchema>
