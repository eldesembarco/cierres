// Ingesta de los reportes de Mercado Pago (collection o Liberaciones) → ventas_app
// (plataforma "Mercado Delivery"). Reusa el modelo de PedidosYa: mapea el local vía
// local_plataforma — por store_id (collection) O por NOMBRE (Liberaciones) — y hace
// upsert de ventas_app por (local, plataforma, fecha de venta). La "venta" guardada
// es el BRUTO cobrado de operaciones aprobadas, para que cuadre 1:1 contra lo
// declarado en el cierre; el neto y la comisión van en el resultado. Los identificadores
// sin mapear quedan registrados para asignarlos a un local desde la UI.
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { parseMpFile, aggregateMp, type MpStoreDay } from '@/lib/ingest/parseMercadoPago'

export interface MpIngestArgs {
  fileBuffer: ArrayBuffer | Buffer
  archivoNombre: string
  subidoPor: number
}

export interface MpResumenLocal {
  localId: number | null
  localNombre: string | null
  externalId: string // identificador externo usado para mapear (store_id o nombre)
  storeId: string
  storeName: string
  fecha: string
  brutoCobrado: number
  netoLiquidado: number
  comision: number
  pedidos: number
  devoluciones: number
  mapeado: boolean
}

export interface MpIngestResult {
  importacionId: number
  filasTotal: number
  filasMapeadas: number
  filasSinMapear: number
  resumen: MpResumenLocal[]
  totales: {
    brutoCobrado: number
    netoLiquidado: number
    comision: number
    pedidos: number
    devoluciones: number
  }
}

export async function ingestMercadoPago(args: MpIngestArgs): Promise<MpIngestResult> {
  const raw = await parseMpFile(args.fileBuffer)
  const grupos = aggregateMp(raw)
  if (grupos.length === 0) {
    throw new Error('No encontré operaciones en el Excel de Mercado Pago.')
  }
  return persistMpGrupos(grupos, args.archivoNombre, args.subidoPor)
}

// Persiste grupos ya agregados (local, fecha) → ventas_app (plataforma MD). Lo
// reusan la ingesta de un archivo (ingestMercadoPago) y la ingesta multi-archivo
// del SFTP (ingestReportesSftp), que combina y deduplica antes de agregar.
export async function persistMpGrupos(
  grupos: MpStoreDay[],
  archivoNombre: string,
  subidoPor: number,
): Promise<MpIngestResult> {
  const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: 'MD' } })

  const [mapeos, locales] = await Promise.all([
    prisma.localPlataforma.findMany({ where: { plataformaId: plataforma.id, activo: true } }),
    prisma.local.findMany({ select: { id: true, nombre: true } }),
  ])
  const localByExterno = new Map(mapeos.map((m) => [m.restaurantIdExterno, m.localId]))
  const nombreById = new Map(locales.map((l) => [l.id, l.nombre]))
  // Normaliza nombres (minúsculas, sin acentos, espacios colapsados) para que el
  // mapeo por nombre del reporte de Liberaciones no falle por un acento o mayúscula.
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
  const localByExternoNorm = new Map(mapeos.map((m) => [norm(m.restaurantIdExterno), m.localId]))
  // El local se busca por store_id (collection) O por nombre (Liberaciones), exacto o normalizado.
  const findLocal = (g: { storeId: string; storeName: string }): number | undefined =>
    localByExterno.get(g.storeId) ??
    localByExterno.get(g.storeName) ??
    (g.storeName ? localByExternoNorm.get(norm(g.storeName)) : undefined)

  const resumen: MpResumenLocal[] = grupos.map((g) => {
    const localId = findLocal(g) ?? null
    return {
      localId,
      localNombre: localId != null ? nombreById.get(localId) ?? null : null,
      externalId: g.storeId || g.storeName,
      storeId: g.storeId,
      storeName: g.storeName,
      fecha: g.fecha,
      brutoCobrado: g.brutoCobrado,
      netoLiquidado: g.netoLiquidado,
      comision: g.comision,
      pedidos: g.pedidos,
      devoluciones: g.devoluciones,
      mapeado: localId != null,
    }
  })
  const sinMapear = resumen.filter((r) => !r.mapeado)

  // Importacion.fechaReporte es única: usamos la fecha más reciente del archivo.
  const fechaReporte = grupos.reduce((max, g) => (g.fecha > max ? g.fecha : max), grupos[0].fecha)

  const importacionId = await prisma.$transaction(async (tx) => {
    const imp = await tx.importacion.create({
      data: {
        plataformaId: plataforma.id,
        fechaReporte: new Date(`${fechaReporte}T00:00:00.000Z`),
        archivoNombre,
        filasTotal: grupos.length,
        filasMapeadas: grupos.length - sinMapear.length,
        filasSinMapear: sinMapear.length,
        subidoPor,
      },
    })

    for (const g of grupos) {
      const localId = findLocal(g)
      if (localId === undefined) continue
      const fecha = new Date(`${g.fecha}T00:00:00.000Z`)
      await tx.ventaApp.upsert({
        where: { localId_plataformaId_fecha: { localId, plataformaId: plataforma.id, fecha } },
        update: { pedidosOnline: g.pedidos, ventaOnline: g.brutoCobrado, comision: g.comision, pedidosEfectivo: 0, ventaEfectivo: 0, importacionId: imp.id },
        create: { localId, plataformaId: plataforma.id, fecha, pedidosOnline: g.pedidos, ventaOnline: g.brutoCobrado, comision: g.comision, importacionId: imp.id },
      })
    }

    if (sinMapear.length > 0) {
      // Agregamos por identificador externo (store_id o nombre; puede repetirse en varias fechas).
      const agg = new Map<string, { nombre: string; bruto: number }>()
      for (const s of sinMapear) {
        const a = agg.get(s.externalId) ?? { nombre: s.storeName, bruto: 0 }
        a.bruto += s.brutoCobrado
        if (!a.nombre && s.storeName) a.nombre = s.storeName
        agg.set(s.externalId, a)
      }
      await tx.importacionSinMapear.createMany({
        data: [...agg.entries()].map(([externalId, a]) => ({
          importacionId: imp.id,
          plataformaId: plataforma.id,
          restaurantIdExterno: externalId,
          nombreExterno: a.nombre,
          ventaEfectivo: 0,
          ventaOnline: round2(a.bruto),
        })),
      })
    }

    return imp.id
    // La ingesta multi-archivo del SFTP agrega muchos (local, fecha) → subimos el
    // timeout de la transacción (default 5s) para que no expire con volumen alto.
  }, { timeout: 30_000, maxWait: 10_000 })

  const totales = grupos.reduce(
    (t, g) => ({
      brutoCobrado: round2(t.brutoCobrado + g.brutoCobrado),
      netoLiquidado: round2(t.netoLiquidado + g.netoLiquidado),
      comision: round2(t.comision + g.comision),
      pedidos: t.pedidos + g.pedidos,
      devoluciones: t.devoluciones + g.devoluciones,
    }),
    { brutoCobrado: 0, netoLiquidado: 0, comision: 0, pedidos: 0, devoluciones: 0 },
  )

  return {
    importacionId,
    filasTotal: grupos.length,
    filasMapeadas: grupos.length - sinMapear.length,
    filasSinMapear: sinMapear.length,
    resumen,
    totales,
  }
}
