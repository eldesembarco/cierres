// Sincroniza los datos de Tango (venta por hora, por artículo y consumo de
// insumos) a nuestra base. Idempotente por fecha: borra y reinserta cada día del
// rango, así se puede re-sincronizar sin duplicar. Se guardan TODAS las
// sucursales (propias y franquicias), clavadas por sucursalId; localId solo se
// completa para las propias (link a los locales de cierres). Las sucursales que
// aparecen en la venta y no están en la dimensión se auto-crean con nombre
// provisorio para no perder datos.
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
  fetchComandasAnuladas,
  TangoBridgeError,
} from '@/lib/tango/ventasBridge'

export interface SyncVentasResult {
  desde: string
  hasta: string
  dias: {
    fecha: string
    filasHoras: number | null
    filasArticulos: number | null
    filasInsumos: number | null
    filasAnuladas: number | null
  }[]
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

const delDia = <T extends { fecha: string }>(rows: T[], fecha: string) =>
  rows.filter((r) => r.fecha.slice(0, 10) === fecha)

export async function syncVentasTango(desde: string, hasta: string): Promise<SyncVentasResult> {
  const [horasR, articulosR, insumosR, anuladasR, sucursales] = await Promise.all([
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
    fetchComandasAnuladas(desde, hasta).then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    ),
    prisma.sucursalTango.findMany({ select: { id: true, localId: true } }),
  ])

  // Si no vino NINGÚN dataset, el bridge está caído de verdad: error para arriba.
  if (!horasR.ok && !articulosR.ok && !insumosR.ok && !anuladasR.ok) {
    throw horasR.e instanceof Error ? horasR.e : new TangoBridgeError(String(horasR.e))
  }

  const avisos: string[] = []
  const nombreDataset = { horas: 'venta por hora', articulos: 'venta por artículo', insumos: 'consumo de insumos', anuladas: 'comandas anuladas' }
  if (!horasR.ok) avisos.push(`No se sincronizó ${nombreDataset.horas}: ${horasR.e instanceof Error ? horasR.e.message : horasR.e}`)
  if (!articulosR.ok) avisos.push(`No se sincronizó ${nombreDataset.articulos}: ${articulosR.e instanceof Error ? articulosR.e.message : articulosR.e}`)
  if (!insumosR.ok) avisos.push(`No se sincronizó ${nombreDataset.insumos}: ${insumosR.e instanceof Error ? insumosR.e.message : insumosR.e}`)
  if (!anuladasR.ok) avisos.push(`No se sincronizó ${nombreDataset.anuladas}: ${anuladasR.e instanceof Error ? anuladasR.e.message : anuladasR.e}`)

  const localPorSucursal = new Map(sucursales.map((s) => [s.id, s.localId]))

  // Sucursales nuevas (aperturas): alta provisoria en la dimensión para no
  // perder sus datos. Nombre "#id" hasta que alguien lo corrija.
  const idsVistos = new Set<number>()
  for (const r of [
    ...(horasR.ok ? horasR.v : []),
    ...(articulosR.ok ? articulosR.v : []),
    ...(insumosR.ok ? insumosR.v : []),
    ...(anuladasR.ok ? anuladasR.v : []),
  ]) idsVistos.add(r.id_sucursal)
  const desconocidas = [...idsVistos].filter((id) => !localPorSucursal.has(id))
  if (desconocidas.length > 0) {
    await prisma.sucursalTango.createMany({
      data: desconocidas.map((id) => ({ id, nombre: `Sucursal #${id}`, marca: 'D', esPropia: false })),
      skipDuplicates: true,
    })
    for (const id of desconocidas) localPorSucursal.set(id, null)
    avisos.push(`Sucursales nuevas auto-creadas (revisar nombre/marca): ${desconocidas.join(', ')}`)
  }

  const base = (r: { id_sucursal: number }, fecha: string) => ({
    sucursalId: r.id_sucursal,
    localId: localPorSucursal.get(r.id_sucursal) ?? null,
    fecha: fechaDb(fecha),
  })

  const dias: SyncVentasResult['dias'] = []
  for (const fecha of fechasDelRango(desde, hasta)) {
    const filasHoras = horasR.ok
      ? delDia(horasR.v, fecha).map((r) => ({
          ...base(r, fecha),
          hora: r.hora,
          monto: round2(Number(r.importe)),
          tickets: Number(r.tickets) || 0,
        }))
      : null
    const filasArticulos = articulosR.ok
      ? delDia(articulosR.v, fecha).map((r) => ({
          ...base(r, fecha),
          codigo: r.cod_articulo,
          descripcion: r.descripcion,
          rubro: r.rubro ?? null,
          cantidad: Number(r.cantidad),
          monto: round2(Number(r.importe)),
        }))
      : null
    const filasInsumos = insumosR.ok
      ? delDia(insumosR.v, fecha).map((r) => ({
          ...base(r, fecha),
          codigo: r.cod_articulo,
          descripcion: r.descripcion,
          rubro: r.rubro ?? null,
          unidad: r.unidad ?? null,
          cantidad: Number(r.cantidad),
          costoUnitario: r.costo_unitario != null ? Number(r.costo_unitario) : null,
          costoTotal: r.costo_total != null ? round2(Number(r.costo_total)) : null,
        }))
      : null
    const filasAnuladas = anuladasR.ok
      ? delDia(anuladasR.v, fecha).map((r) => ({
          ...base(r, fecha),
          // El bridge manda "YYYY-MM-DD HH:mm:ss" (hora local del ticket).
          fechaHora: new Date(r.fecha_hora.replace(' ', 'T') + 'Z'),
          importe: round2(Number(r.importe) || 0),
          tipoPedido: r.tipo_pedido ?? null,
          cubiertos: Number(r.cubiertos) || 0,
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
      ...(filasAnuladas
        ? [
            prisma.comandaAnuladaTango.deleteMany({ where: { fecha: fechaDb(fecha) } }),
            prisma.comandaAnuladaTango.createMany({ data: filasAnuladas }),
          ]
        : []),
      prisma.ventaTangoSync.upsert({
        where: { fecha: fechaDb(fecha) },
        create: {
          fecha: fechaDb(fecha),
          filasHoras: filasHoras?.length ?? 0,
          filasArticulos: filasArticulos?.length ?? 0,
          filasInsumos: filasInsumos?.length ?? 0,
          filasAnuladas: filasAnuladas?.length ?? 0,
        },
        update: {
          ...(filasHoras ? { filasHoras: filasHoras.length } : {}),
          ...(filasArticulos ? { filasArticulos: filasArticulos.length } : {}),
          ...(filasInsumos ? { filasInsumos: filasInsumos.length } : {}),
          ...(filasAnuladas ? { filasAnuladas: filasAnuladas.length } : {}),
          sincronizadoEn: new Date(),
        },
      }),
    ])
    dias.push({
      fecha,
      filasHoras: filasHoras?.length ?? null,
      filasArticulos: filasArticulos?.length ?? null,
      filasInsumos: filasInsumos?.length ?? null,
      filasAnuladas: filasAnuladas?.length ?? null,
    })
  }
  return { desde, hasta, dias, avisos }
}
