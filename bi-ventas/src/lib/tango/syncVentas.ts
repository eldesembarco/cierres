// Sincroniza los datos de Tango (venta por hora, por artículo y consumo de
// insumos) a nuestra base. Idempotente por fecha: borra y reinserta cada día del
// rango, así se puede re-sincronizar sin duplicar. Las sucursales que no mapean
// a un local propio (resto de la franquicia) se ignoran.
//
// Tolerante a endpoints faltantes: cada dataset se trae por separado; si uno
// falla (p.ej. /consumo-insumos todavía no está en el bridge del server) se
// sincronizan los otros y el error queda en `avisos`. Solo si fallan TODOS se
// tira el error (bridge caído).
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import {
  fetchVentasHoras,
  fetchVentasArticulos,
  fetchConsumoInsumos,
  TangoBridgeError,
} from '@/lib/tango/ventasBridge'

export interface SyncVentasResult {
  desde: string
  hasta: string
  dias: { fecha: string; filasHoras: number | null; filasArticulos: number | null; filasInsumos: number | null }[]
  avisos: string[]
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

const delDia = <T extends { fecha: string; id_sucursal: number }>(
  rows: T[],
  fecha: string,
  localPorSucursal: Map<number, number>,
) => rows.filter((r) => r.fecha.slice(0, 10) === fecha && localPorSucursal.has(r.id_sucursal))

export async function syncVentasTango(desde: string, hasta: string): Promise<SyncVentasResult> {
  const [horasR, articulosR, insumosR, locales] = await Promise.all([
    fetchVentasHoras(desde, hasta).then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    ),
    fetchVentasArticulos(desde, hasta).then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    ),
    fetchConsumoInsumos(desde, hasta).then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    ),
    prisma.local.findMany({ where: { tangoSucursalId: { not: null } }, select: { id: true, tangoSucursalId: true } }),
  ])

  // Si no vino NINGÚN dataset, el bridge está caído de verdad: error para arriba.
  if (!horasR.ok && !articulosR.ok && !insumosR.ok) {
    throw horasR.e instanceof Error ? horasR.e : new TangoBridgeError(String(horasR.e))
  }

  const avisos: string[] = []
  const nombreDataset = { horas: 'venta por hora', articulos: 'venta por artículo', insumos: 'consumo de insumos' }
  if (!horasR.ok) avisos.push(`No se sincronizó ${nombreDataset.horas}: ${horasR.e instanceof Error ? horasR.e.message : horasR.e}`)
  if (!articulosR.ok) avisos.push(`No se sincronizó ${nombreDataset.articulos}: ${articulosR.e instanceof Error ? articulosR.e.message : articulosR.e}`)
  if (!insumosR.ok) avisos.push(`No se sincronizó ${nombreDataset.insumos}: ${insumosR.e instanceof Error ? insumosR.e.message : insumosR.e}`)

  const localPorSucursal = new Map(locales.map((l) => [l.tangoSucursalId as number, l.id]))

  const dias: SyncVentasResult['dias'] = []
  for (const fecha of fechasDelRango(desde, hasta)) {
    const filasHoras = horasR.ok
      ? delDia(horasR.v, fecha, localPorSucursal).map((r) => ({
          localId: localPorSucursal.get(r.id_sucursal) as number,
          fecha: fechaDb(fecha),
          hora: r.hora,
          monto: round2(Number(r.importe)),
          tickets: Number(r.tickets) || 0,
        }))
      : null
    const filasArticulos = articulosR.ok
      ? delDia(articulosR.v, fecha, localPorSucursal).map((r) => ({
          localId: localPorSucursal.get(r.id_sucursal) as number,
          fecha: fechaDb(fecha),
          codigo: r.cod_articulo,
          descripcion: r.descripcion,
          rubro: r.rubro ?? null,
          cantidad: Number(r.cantidad),
          monto: round2(Number(r.importe)),
        }))
      : null
    const filasInsumos = insumosR.ok
      ? delDia(insumosR.v, fecha, localPorSucursal).map((r) => ({
          localId: localPorSucursal.get(r.id_sucursal) as number,
          fecha: fechaDb(fecha),
          codigo: r.cod_articulo,
          descripcion: r.descripcion,
          rubro: r.rubro ?? null,
          unidad: r.unidad ?? null,
          cantidad: Number(r.cantidad),
        }))
      : null

    // Cada dataset que SÍ vino se reemplaza entero para la fecha; los que no
    // vinieron quedan como estaban (y su contador del log no se toca).
    await prisma.$transaction([
      ...(filasHoras
        ? [
            prisma.ventaTangoHora.deleteMany({ where: { fecha: fechaDb(fecha) } }),
            prisma.ventaTangoHora.createMany({ data: filasHoras }),
          ]
        : []),
      ...(filasArticulos
        ? [
            prisma.ventaTangoArticulo.deleteMany({ where: { fecha: fechaDb(fecha) } }),
            prisma.ventaTangoArticulo.createMany({ data: filasArticulos }),
          ]
        : []),
      ...(filasInsumos
        ? [
            prisma.consumoInsumoTango.deleteMany({ where: { fecha: fechaDb(fecha) } }),
            prisma.consumoInsumoTango.createMany({ data: filasInsumos }),
          ]
        : []),
      prisma.ventaTangoSync.upsert({
        where: { fecha: fechaDb(fecha) },
        create: {
          fecha: fechaDb(fecha),
          filasHoras: filasHoras?.length ?? 0,
          filasArticulos: filasArticulos?.length ?? 0,
          filasInsumos: filasInsumos?.length ?? 0,
        },
        update: {
          ...(filasHoras ? { filasHoras: filasHoras.length } : {}),
          ...(filasArticulos ? { filasArticulos: filasArticulos.length } : {}),
          ...(filasInsumos ? { filasInsumos: filasInsumos.length } : {}),
          sincronizadoEn: new Date(),
        },
      }),
    ])
    dias.push({
      fecha,
      filasHoras: filasHoras?.length ?? null,
      filasArticulos: filasArticulos?.length ?? null,
      filasInsumos: filasInsumos?.length ?? null,
    })
  }
  return { desde, hasta, dias, avisos }
}
