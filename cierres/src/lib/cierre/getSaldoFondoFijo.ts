import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

// Saldo corriente del fondo fijo (caja chica) de un local. Se computa SIEMPRE desde
// la suma actual (nunca acumulando), igual que la cuenta corriente, así reeditar
// cierres no doble-cuenta.
//   saldoActual = base − Σ(gastos fondo_fijo) + Σ(reposiciones admin) + Σ(recupero del local)
//   aReponer    = base − saldoActual
// El "recupero del local" (Cierre.retiroFondoFijo) es plata que el local guardó de su
// propia caja del día para armar/reponer el fondo fijo (auto-financiado).
export interface SaldoFondoFijo {
  base: number
  saldoActual: number
  aReponer: number // 0 si está por encima de la base
  saldoAFavor: number // -aReponer cuando está por encima de la base
  gastosFF: number
  reposiciones: number // reposiciones de administración
  aportesLocal: number // recupero guardado por el propio local desde la caja
}

export async function getSaldoFondoFijo(localId: number): Promise<SaldoFondoFijo> {
  const [local, aggGastos, aggRepos, aggAportes] = await Promise.all([
    prisma.local.findUnique({ where: { id: localId }, select: { fondoFijoDefault: true } }),
    prisma.cierreGasto.aggregate({
      _sum: { monto: true },
      where: { formaPago: 'fondo_fijo', cierre: { localId } },
    }),
    prisma.reposicionFondoFijo.aggregate({ _sum: { monto: true }, where: { localId } }),
    prisma.cierre.aggregate({ _sum: { retiroFondoFijo: true }, where: { localId } }),
  ])
  const base = round2(Number(local?.fondoFijoDefault ?? 0))
  const gastosFF = round2(Number(aggGastos._sum.monto ?? 0))
  const reposiciones = round2(Number(aggRepos._sum.monto ?? 0))
  const aportesLocal = round2(Number(aggAportes._sum.retiroFondoFijo ?? 0))
  const saldoActual = round2(base - gastosFF + reposiciones + aportesLocal)
  const neto = round2(gastosFF - reposiciones - aportesLocal) // lo adeudado (base − saldo)
  return {
    base,
    saldoActual,
    aReponer: neto > 0 ? neto : 0,
    saldoAFavor: neto < 0 ? round2(-neto) : 0,
    gastosFF,
    reposiciones,
    aportesLocal,
  }
}

export interface SaldoFondoFijoLocal extends SaldoFondoFijo {
  localId: number
  localNombre: string
}

// Igual que getSaldoFondoFijo pero para TODOS los locales activos, en pocas queries
// (para el panel de administración). CierreGasto no tiene localId directo (está en el
// Cierre) → traemos los gastos de fondo fijo con su cierre.localId y agrupamos en JS.
export async function getSaldosFondoFijoTodos(): Promise<SaldoFondoFijoLocal[]> {
  const [locales, gastos, repos, aportes] = await Promise.all([
    prisma.local.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, fondoFijoDefault: true },
    }),
    prisma.cierreGasto.findMany({
      where: { formaPago: 'fondo_fijo' },
      select: { monto: true, cierre: { select: { localId: true } } },
    }),
    prisma.reposicionFondoFijo.groupBy({ by: ['localId'], _sum: { monto: true } }),
    prisma.cierre.groupBy({ by: ['localId'], _sum: { retiroFondoFijo: true } }),
  ])
  const gastosPorLocal = new Map<number, number>()
  for (const g of gastos) {
    const lid = g.cierre.localId
    gastosPorLocal.set(lid, (gastosPorLocal.get(lid) ?? 0) + Number(g.monto))
  }
  const reposPorLocal = new Map<number, number>()
  for (const r of repos) reposPorLocal.set(r.localId, Number(r._sum.monto ?? 0))
  const aportesPorLocal = new Map<number, number>()
  for (const a of aportes) aportesPorLocal.set(a.localId, Number(a._sum.retiroFondoFijo ?? 0))

  return locales.map((l) => {
    const base = round2(Number(l.fondoFijoDefault))
    const gastosFF = round2(gastosPorLocal.get(l.id) ?? 0)
    const reposiciones = round2(reposPorLocal.get(l.id) ?? 0)
    const aportesLocal = round2(aportesPorLocal.get(l.id) ?? 0)
    const saldoActual = round2(base - gastosFF + reposiciones + aportesLocal)
    const neto = round2(gastosFF - reposiciones - aportesLocal)
    return {
      localId: l.id,
      localNombre: l.nombre,
      base,
      saldoActual,
      aReponer: neto > 0 ? neto : 0,
      saldoAFavor: neto < 0 ? round2(-neto) : 0,
      gastosFF,
      reposiciones,
      aportesLocal,
    }
  })
}
