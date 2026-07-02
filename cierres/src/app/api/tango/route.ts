// Devuelve los datos REALES de Tango para un (local, fecha): los cierres de turno
// que n8n fue guardando vía POST /api/tango/ingest. La forma de la respuesta
// (TangoParseResult: { fecha, turnos: [{ turno, ventas, montoZ, cantidadTickets }] })
// es la que consume el botón "Importar desde Tango" en la planilla.
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth/auth'
import { esCentral } from '@/lib/auth/rbac'
import type { Canal, Turno } from '@/lib/cierre/types'

interface TangoTurnoResponse {
  turno: Turno
  ventas: { canal: Canal; monto: number }[]
  montoZ: number
  cantidadTickets: number | null
  // Para el panel "Control Tango" (solo admin/central).
  anulacionesAfectanCaja: number
  anulacionesTotal: number
  devolucionesTotal: number
}

const ORDEN_TURNO: Turno[] = ['manana', 'tarde']

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha')
  const localIdRaw = searchParams.get('localId')

  const pedido = Number(localIdRaw)
  if (!fecha || !localIdRaw || !Number.isInteger(pedido)) {
    return Response.json({ error: 'Faltan localId o fecha' }, { status: 400 })
  }

  // Alcance por rol: el encargado SOLO puede leer su local (ignora el query param,
  // evita la fuga horizontal de datos entre locales); central/admin, cualquiera.
  const localId = esCentral(session.user.rol) ? pedido : session.user.localId
  if (localId == null) {
    return Response.json({ error: 'Usuario sin local asignado' }, { status: 400 })
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
      anulacionesAfectanCaja: r.anulacionesAfectanCaja == null ? 0 : Number(r.anulacionesAfectanCaja),
      anulacionesTotal: r.anulacionesTotal == null ? 0 : Number(r.anulacionesTotal),
      devolucionesTotal: r.devolucionesTotal == null ? 0 : Number(r.devolucionesTotal),
    }))
    .sort((a, b) => ORDEN_TURNO.indexOf(a.turno) - ORDEN_TURNO.indexOf(b.turno))

  return Response.json({ fecha, turnos })
}
