import { prisma } from '@/lib/db'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const comprobanteId = Number(id)
  if (!Number.isInteger(comprobanteId)) {
    return new Response('Comprobante inválido', { status: 400 })
  }

  const comprobante = await prisma.comprobante.findUnique({ where: { id: comprobanteId } })
  if (!comprobante) {
    return new Response('No encontrado', { status: 404 })
  }

  const body = new Uint8Array(comprobante.data)
  return new Response(body, {
    headers: {
      'Content-Type': comprobante.mime,
      'Content-Disposition': `inline; filename="${comprobante.nombre}"`,
    },
  })
}
