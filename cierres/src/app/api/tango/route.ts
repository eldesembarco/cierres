// Devuelve los datos REALES de Tango para un (local, fecha): los cierres de turno
// que n8n fue guardando vía POST /api/tango/ingest. La forma de la respuesta
// (TangoParseResult: { fecha, turnos: [{ turno, ventas, montoZ, cantidadTickets }] })
// es la que consume el botón "Importar desde Tango" en la planilla.
import { prisma } from '@/lib/db'
import type { Canal, Turno } from '@/lib/cierre/types'

interface TangoTurnoResponse {
  turno: Turno
  ventas: { canal: Canal; monto: number }[]
  montoZ: number
  cantidadTickets: number | null
}

const ORDEN_TURNO: Turno[] = ['manana', 'tarde']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const localIdRaw = searchParams.get('localId')

  const localId = Number(localIdRaw)
  if (!fecha || !localIdRaw || !Number.isInteger(localId)) {
    return Response.json({ error: 'Faltan localId o fecha' }, { status: 400 })
  }

  const rows = await prisma.cierreTango.findMany({
    where: { localId, fecha: new Date(`${fecha}T00:00:00.000Z`) },
  })

  const turnos: TangoTurnoResponse[] = rows
    .map((r) => ({
      turno: r.turno as Turno,
      ventas: (r.ventas as { canal: Canal; monto: number }[]) ?? [],
      montoZ: Number(r.montoZ),
      cantidadTickets: r.cantidadTickets,
    }))
    .sort((a, b) => ORDEN_TURNO.indexOf(a.turno) - ORDEN_TURNO.indexOf(b.turno))

  return Response.json({ fecha, turnos })
}
