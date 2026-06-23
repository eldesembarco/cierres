// MOCK storage en DB (columna Bytes). Swap a Vercel Blob (`@vercel/blob` put() +
// BLOB_READ_WRITE_TOKEN) cuando se quiera: el contrato del front (POST devuelve { id },
// GET /api/comprobante/[id] sirve el archivo) no cambia.
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  const formData = await request.formData()
  const archivo = formData.get('archivo')

  if (!(archivo instanceof File)) {
    return Response.json({ error: 'Falta el archivo' }, { status: 400 })
  }

  const data = Buffer.from(await archivo.arrayBuffer())
  const { id } = await prisma.comprobante.create({
    data: {
      nombre: archivo.name,
      mime: archivo.type || 'application/octet-stream',
      data,
    },
    select: { id: true },
  })

  return Response.json({ id })
}
