// Orquesta la conciliación operación-por-operación de un local en un día:
//   1) mapea el localId a los nombres con que aparece en los reportes de MP,
//   2) toma las operaciones del día ya parseadas del SFTP (Data Cache) y filtra
//      las aprobadas de ese local (con su canal),
//   3) trae las líneas que cargó el encargado (cierre_detalle, canales de MP),
//   4) las choca con conciliarMp.
import { getOperacionesMpDiaCached } from '@/lib/mp/operacionesMpDia'
import { COL } from '@/lib/mp/consolidarLiberaciones'
import { prisma } from '@/lib/db'
import {
  conciliarMp,
  canalDeVenta,
  type OperacionMp,
  type LineaEncargado,
  type ConciliacionResultado,
} from '@/lib/mp/conciliacionMp'

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

export interface ConciliacionLocalDia {
  fecha: string
  localId: number
  nombresMp: string[]
  archivosLeidos: number
  operacionesMp: number
  lineasEncargado: number
  hayCierre: boolean
  resultado: ConciliacionResultado
}

export async function conciliarLocalDia(localId: number, fecha: string): Promise<ConciliacionLocalDia> {
  const md = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: 'MD' } })
  const [mapeos, cierres] = await Promise.all([
    prisma.localPlataforma.findMany({
      where: { plataformaId: md.id, localId, activo: true },
      select: { restaurantIdExterno: true },
    }),
    prisma.cierre.findMany({
      where: { localId, fecha: new Date(`${fecha}T00:00:00.000Z`) },
      select: {
        detalles: {
          where: { canal: { in: ['mercadopago', 'mercado_pedidos'] } },
          select: { canal: true, importe: true },
        },
      },
    }),
  ])
  const nombresMp = mapeos.map((m) => m.restaurantIdExterno)
  const nombresNorm = new Set(nombresMp.map(norm))

  const { archivosLeidos, filas } = await getOperacionesMpDiaCached(fecha)
  const operaciones: OperacionMp[] = []
  for (const f of filas) {
    if (!nombresNorm.has(norm(String(f[COL.LOCAL] ?? '')))) continue
    if (!norm(String(f[COL.TIPO] ?? '')).includes('aprobado')) continue
    const monto = typeof f[COL.VALOR] === 'number' ? (f[COL.VALOR] as number) : 0
    if (monto <= 0) continue
    operaciones.push({ canal: canalDeVenta(String(f[COL.CANAL] ?? '')), monto })
  }

  const lineas: LineaEncargado[] = cierres.flatMap((c) =>
    c.detalles.map((d) => ({ canal: d.canal as 'mercadopago' | 'mercado_pedidos', monto: Number(d.importe) })),
  )

  return {
    fecha,
    localId,
    nombresMp,
    archivosLeidos,
    operacionesMp: operaciones.length,
    lineasEncargado: lineas.length,
    hayCierre: cierres.length > 0,
    resultado: conciliarMp(operaciones, lineas),
  }
}
