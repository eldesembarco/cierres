import { z } from 'zod'

const canal = z.enum(['efectivo', 'tarjetas', 'rappi', 'pedidosya', 'mercadopago', 'uber', 'delivery_propio', 'varios'])
const turno = z.enum(['T1', 'T2'])
const monto = z.number().nonnegative()

export const cierreInputSchema = z.object({
  fondoFijo: monto,
  gastosTotal: monto,
  notaCredito: monto,
  cantidadTickets: z.number().int().nonnegative().nullable().optional(),
  turnos: z.array(z.object({ turno, montoZ: monto }))
    .refine((ts) => new Set(ts.map((t) => t.turno)).size === ts.length, 'Turnos duplicados'),
  ventas: z.array(z.object({ canal, monto }))
    .refine((vs) => new Set(vs.map((v) => v.canal)).size === vs.length, 'Canales duplicados'),
})

export type CierreInputParsed = z.infer<typeof cierreInputSchema>
