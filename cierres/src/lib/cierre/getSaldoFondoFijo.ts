import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

// Saldo corriente del fondo fijo (caja chica) de un local. Se computa SIEMPRE desde
// la suma actual de gastos + reposiciones (nunca acumulando), igual que la cuenta
// corriente, así reeditar cierres (que borran+recrean gastos) no doble-cuenta.
//   saldoActual = base − Σ(gastos formaPago='fondo_fijo') + Σ(reposiciones)
//   aReponer    = base − saldoActual = Σgastos − Σreposiciones
export interface SaldoFondoFijo {
  base: number
  saldoActual: number
  aReponer: number // 0 si está por encima de la base
  saldoAFavor: number // -aReponer cuando se repuso de más
  gastosFF: number
  reposiciones: number
}

export async function getSaldoFondoFijo(localId: number): Promise<SaldoFondoFijo> {
  const [local, aggGastos, aggRepos] = await Promise.all([
    prisma.local.findUnique({ where: { id: localId }, select: { fondoFijoDefault: true } }),
    prisma.cierreGasto.aggregate({
      _sum: { monto: true },
      where: { formaPago: 'fondo_fijo', cierre: { localId } },
    }),
    prisma.reposicionFondoFijo.aggregate({ _sum: { monto: true }, where: { localId } }),
  ])
  const base = round2(Number(local?.fondoFijoDefault ?? 0))
  const gastosFF = round2(Number(aggGastos._sum.monto ?? 0))
  const reposiciones = round2(Number(aggRepos._sum.monto ?? 0))
  const saldoActual = round2(base - gastosFF + reposiciones)
  const neto = round2(gastosFF - reposiciones) // lo adeudado (base − saldo)
  return {
    base,
    saldoActual,
    aReponer: neto > 0 ? neto : 0,
    saldoAFavor: neto < 0 ? round2(-neto) : 0,
    gastosFF,
    reposiciones,
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
  const [locales, gastos, repos] = await Promise.all([
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
  ])
  const gastosPorLocal = new Map<number, number>()
  for (const g of gastos) {
    const lid = g.cierre.localId
    gastosPorLocal.set(lid, (gastosPorLocal.get(lid) ?? 0) + Number(g.monto))
  }
  const reposPorLocal = new Map<number, number>()
  for (const r of repos) reposPorLocal.set(r.localId, Number(r._sum.monto ?? 0))

  return locales.map((l) => {
    const base = round2(Number(l.fondoFijoDefault))
    const gastosFF = round2(gastosPorLocal.get(l.id) ?? 0)
    const reposiciones = round2(reposPorLocal.get(l.id) ?? 0)
    const saldoActual = round2(base - gastosFF + reposiciones)
    const neto = round2(gastosFF - reposiciones)
    return {
      localId: l.id,
      localNombre: l.nombre,
      base,
      saldoActual,
      aReponer: neto > 0 ? neto : 0,
      saldoAFavor: neto < 0 ? round2(-neto) : 0,
      gastosFF,
      reposiciones,
    }
  })
}
