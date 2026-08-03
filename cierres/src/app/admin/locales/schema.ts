import { z } from 'zod'

// Validación del alta/edición de un local. Los campos numéricos llegan como
// string desde el <form> (FormData), por eso se parsean acá en vez de pedirle
// al cliente que mande números.
export const localInputSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre tiene que tener al menos 3 caracteres'),
  marcaId: z.coerce.number().int().positive('Elegí una marca'),
  direccion: z.string().trim().max(200).optional().or(z.literal('')),
  ciudad: z.string().trim().max(120).optional().or(z.literal('')),
  fondoFijoDefault: z.coerce.number().nonnegative('No puede ser negativo').default(0),
  // Código de sucursal en Tango (ID_SUCURSAL). Opcional: un local recién dado de
  // alta puede no tener todavía el mapeo con Tango resuelto.
  tangoSucursalId: z
    .union([z.coerce.number().int().positive(), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
})

export type LocalInput = z.infer<typeof localInputSchema>
