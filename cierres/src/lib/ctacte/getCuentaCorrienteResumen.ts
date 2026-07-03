import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'

export interface GrupoSaldo {
  nombre: string
  total: number
  count: number
}
export interface CtaCteResumen {
  saldoPendiente: number
  cantidadPendientes: number
  porProveedor: GrupoSaldo[]
  porLocal: GrupoSaldo[]
}

function agrupar<T>(rows: T[], key: (m: T) => string, monto: (m: T) => number): GrupoSaldo[] {
  const map = new Map<string, GrupoSaldo>()
  for (const m of rows) {
    const k = key(m)
    const prev = map.get(k) ?? { nombre: k, total: 0, count: 0 }
    prev.total = round2(prev.total + monto(m))
    prev.count += 1
    map.set(k, prev)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

// Resumen de la cuenta corriente pendiente (lo que se le debe a proveedores).
export async function getCuentaCorrienteResumen(): Promise<CtaCteResumen> {
  const pendientes = await prisma.movimientoCtaCte.findMany({
    where: { pagado: false },
    include: { proveedor: { select: { nombre: true } }, local: { select: { nombre: true } } },
  })
  const saldoPendiente = round2(pendientes.reduce((s, m) => s + Number(m.monto), 0))
  return {
    saldoPendiente,
    cantidadPendientes: pendientes.length,
    porProveedor: agrupar(pendientes, (m) => m.proveedor?.nombre ?? '(sin asignar)', (m) => Number(m.monto)),
    porLocal: agrupar(pendientes, (m) => m.local.nombre, (m) => Number(m.monto)),
  }
}
