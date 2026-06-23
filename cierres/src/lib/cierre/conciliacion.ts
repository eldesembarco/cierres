import { round2, sumMoney } from '@/lib/money'
import type { Canal } from '@/lib/cierre/types'

const TOLERANCIA = 1 // $ de redondeo

export type EstadoConciliacion = 'ok' | 'descuadre'

export interface ConciliacionResultado {
  sumaCupones: number
  declarado: number
  diferencia: number
  estado: EstadoConciliacion
}

export interface ConciliacionCanal extends ConciliacionResultado {
  canal: Canal
}

export function conciliarLinea(importes: number[], declarado: number): ConciliacionResultado {
  const sumaCupones = sumMoney(importes)
  const diferencia = round2(sumaCupones - declarado)
  const estado: EstadoConciliacion = Math.abs(diferencia) <= TOLERANCIA ? 'ok' : 'descuadre'
  return { sumaCupones, declarado, diferencia, estado }
}

export function conciliarCupones(
  detalles: { canal: Canal; referencia: string; importe: number }[],
  ventas: { canal: Canal; monto: number }[],
): ConciliacionCanal[] {
  const declaradoPorCanal = new Map(ventas.map((v) => [v.canal, v.monto]))
  const importesPorCanal = new Map<Canal, number[]>()
  for (const d of detalles) {
    if (!importesPorCanal.has(d.canal)) importesPorCanal.set(d.canal, [])
    importesPorCanal.get(d.canal)!.push(d.importe)
  }
  const res: ConciliacionCanal[] = []
  for (const [canal, importes] of importesPorCanal) {
    res.push({ canal, ...conciliarLinea(importes, declaradoPorCanal.get(canal) ?? 0) })
  }
  return res
}
