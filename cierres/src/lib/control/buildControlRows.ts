import { round2 } from '@/lib/money'
import type { Canal } from '@/lib/cierre/types'

const CANAL_A_PLATAFORMA: Partial<Record<Canal, string>> = {
  pedidosya: 'PedidosYa',
  rappi: 'Rappi',
  mercadopago: 'Mercado Pago',
  uber: 'Uber',
}

export interface DeclaredVenta { canal: Canal; monto: number }
export interface AppVenta { plataformaNombre: string; ventaTotal: number }

export interface ControlRow {
  plataforma: string
  declarado: number
  app: number
  diferencia: number
  pct: number | null
}

export function buildControlRows(declared: DeclaredVenta[], app: AppVenta[]): ControlRow[] {
  const appByPlataforma = new Map(app.map((a) => [a.plataformaNombre, a.ventaTotal]))
  const declaredByPlataforma = new Map<string, number>()
  for (const d of declared) {
    const plataforma = CANAL_A_PLATAFORMA[d.canal]
    if (plataforma) declaredByPlataforma.set(plataforma, (declaredByPlataforma.get(plataforma) ?? 0) + d.monto)
  }

  const plataformas = new Set<string>([...declaredByPlataforma.keys(), ...appByPlataforma.keys()])
  const result: ControlRow[] = []
  for (const plataforma of plataformas) {
    const declaradoMonto = round2(declaredByPlataforma.get(plataforma) ?? 0)
    const appMonto = round2(appByPlataforma.get(plataforma) ?? 0)
    const diferencia = round2(declaradoMonto - appMonto)
    const pct = appMonto !== 0 ? round2((diferencia / appMonto) * 100) : null
    result.push({ plataforma, declarado: declaradoMonto, app: appMonto, diferencia, pct })
  }
  return result.sort((a, b) => a.plataforma.localeCompare(b.plataforma))
}
