import { prisma } from '@/lib/db'
import { parsePedidosYa } from '@/lib/ingest/parsePedidosYa'
import { planIngest, type Mapping } from '@/lib/ingest/mapRows'

export interface IngestArgs {
  csv: string
  plataformaCodigo: string
  fechaReporte: Date
  archivoNombre: string
  subidoPor: number
}

export interface IngestResult {
  importacionId: number
  filasTotal: number
  filasMapeadas: number
  filasSinMapear: number
}

export async function ingestCsv(args: IngestArgs): Promise<IngestResult> {
  const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: args.plataformaCodigo } })
  if (args.plataformaCodigo !== 'PY') {
    throw new Error(`Parser no implementado para la plataforma ${args.plataformaCodigo}`)
  }

  const rows = parsePedidosYa(args.csv)
  const mapeos = await prisma.localPlataforma.findMany({ where: { plataformaId: plataforma.id, activo: true } })
  const mappings: Mapping[] = mapeos.map((m) => ({ plataformaId: m.plataformaId, restaurantId: m.restaurantIdExterno, localId: m.localId }))
  const plan = planIngest(rows, mappings, plataforma.id)

  return prisma.$transaction(async (tx) => {
    const imp = await tx.importacion.create({
      data: {
        plataformaId: plataforma.id,
        fechaReporte: args.fechaReporte,
        archivoNombre: args.archivoNombre,
        filasTotal: plan.filasTotal,
        filasMapeadas: plan.filasMapeadas,
        filasSinMapear: plan.filasSinMapear,
        subidoPor: args.subidoPor,
      },
    })

    for (const v of plan.ventasApp) {
      await tx.ventaApp.upsert({
        where: { localId_plataformaId_fecha: { localId: v.localId, plataformaId: v.plataformaId, fecha: args.fechaReporte } },
        update: { pedidosEfectivo: v.pedidosEfectivo, pedidosOnline: v.pedidosOnline, ventaEfectivo: v.ventaEfectivo, ventaOnline: v.ventaOnline, importacionId: imp.id },
        create: { localId: v.localId, plataformaId: v.plataformaId, fecha: args.fechaReporte, pedidosEfectivo: v.pedidosEfectivo, pedidosOnline: v.pedidosOnline, ventaEfectivo: v.ventaEfectivo, ventaOnline: v.ventaOnline, importacionId: imp.id },
      })
    }

    if (plan.sinMapear.length > 0) {
      await tx.importacionSinMapear.createMany({
        data: plan.sinMapear.map((s) => ({ importacionId: imp.id, plataformaId: s.plataformaId, restaurantIdExterno: s.restaurantId, nombreExterno: s.nombreExterno, ventaEfectivo: s.ventaEfectivo, ventaOnline: s.ventaOnline })),
      })
    }

    return { importacionId: imp.id, filasTotal: plan.filasTotal, filasMapeadas: plan.filasMapeadas, filasSinMapear: plan.filasSinMapear }
  })
}
