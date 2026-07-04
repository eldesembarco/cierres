// Sincroniza la venta de Tango (por hora y por artículo) a nuestra base para el
// BI (/ventas). Idempotente por fecha: borra y reinserta cada día del rango, así
// se puede re-sincronizar sin duplicar. Las sucursales que no mapean a un local
// propio (resto de la franquicia) se ignoran.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { fetchVentasHoras, fetchVentasArticulos } from '@/lib/tango/ventasBridge'

export interface SyncVentasResult {
  desde: string
  hasta: string
  dias: { fecha: string; filasHoras: number; filasArticulos: number }[]
}

const fechaDb = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)

/** Lista de fechas YYYY-MM-DD del rango [desde, hasta] inclusive. */
function fechasDelRango(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let d = fechaDb(desde); d <= fechaDb(hasta); d = new Date(d.getTime() + 86_400_000)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export async function syncVentasTango(desde: string, hasta: string): Promise<SyncVentasResult> {
  const [horas, articulos, locales] = await Promise.all([
    fetchVentasHoras(desde, hasta),
    fetchVentasArticulos(desde, hasta),
    prisma.local.findMany({ where: { tangoSucursalId: { not: null } }, select: { id: true, tangoSucursalId: true } }),
  ])
  const localPorSucursal = new Map(locales.map((l) => [l.tangoSucursalId as number, l.id]))

  const dias: SyncVentasResult['dias'] = []
  for (const fecha of fechasDelRango(desde, hasta)) {
    const filasHoras = horas
      .filter((r) => r.fecha.slice(0, 10) === fecha && localPorSucursal.has(r.id_sucursal))
      .map((r) => ({
        localId: localPorSucursal.get(r.id_sucursal) as number,
        fecha: fechaDb(fecha),
        hora: r.hora,
        monto: round2(Number(r.importe)),
        tickets: Number(r.tickets) || 0,
      }))
    const filasArticulos = articulos
      .filter((r) => r.fecha.slice(0, 10) === fecha && localPorSucursal.has(r.id_sucursal))
      .map((r) => ({
        localId: localPorSucursal.get(r.id_sucursal) as number,
        fecha: fechaDb(fecha),
        codigo: r.cod_articulo,
        descripcion: r.descripcion,
        rubro: r.rubro ?? null,
        cantidad: Number(r.cantidad),
        monto: round2(Number(r.importe)),
      }))

    await prisma.$transaction([
      prisma.ventaTangoHora.deleteMany({ where: { fecha: fechaDb(fecha) } }),
      prisma.ventaTangoArticulo.deleteMany({ where: { fecha: fechaDb(fecha) } }),
      prisma.ventaTangoHora.createMany({ data: filasHoras }),
      prisma.ventaTangoArticulo.createMany({ data: filasArticulos }),
      prisma.ventaTangoSync.upsert({
        where: { fecha: fechaDb(fecha) },
        create: { fecha: fechaDb(fecha), filasHoras: filasHoras.length, filasArticulos: filasArticulos.length },
        update: { filasHoras: filasHoras.length, filasArticulos: filasArticulos.length, sincronizadoEn: new Date() },
      }),
    ])
    dias.push({ fecha, filasHoras: filasHoras.length, filasArticulos: filasArticulos.length })
  }
  return { desde, hasta, dias }
}
