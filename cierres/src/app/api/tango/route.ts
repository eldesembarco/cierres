// MOCK: devuelve datos de ejemplo por turno (manana/tarde). Reemplazar el cuerpo por
// la consulta real a Tango (SQL Server / API Nexo) cuando esté disponible — la forma de la
// respuesta (TangoParseResult: { fecha, turnos: [{ turno, ventas, montoZ, cantidadTickets }] }) no cambia.
import { parseTango } from '@/lib/ingest/parseTango'

// CSV de ejemplo (San Telmo, ambos turnos). Se reemplaza por la consulta real a Tango.
const SAMPLE_CSV = `Fecha,Turno,MedioPago,Importe,Comprobantes
2026-06-23,T1,Efectivo,46200,42
2026-06-23,T1,Tarjetas,541700,
2026-06-23,T1,Mercado Pago,168590,
2026-06-23,T2,Efectivo,85500,58
2026-06-23,T2,Tarjetas,483700,
2026-06-23,T2,PedidosYa,529255,
2026-06-23,T2,Mercado Pago,336970,
`

export async function GET(request: Request) {
  // Params disponibles para la consulta real; en el mock se leen pero no se usan.
  const { searchParams } = new URL(request.url)
  const _fecha = searchParams.get('fecha')
  const _localId = searchParams.get('localId')
  void _fecha
  void _localId

  // Delay artificial para que el estado "Actualizando…" sea visible.
  await new Promise((r) => setTimeout(r, 900))

  const result = parseTango(SAMPLE_CSV)
  return Response.json(result)
}
