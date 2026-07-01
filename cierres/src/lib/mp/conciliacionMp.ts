// Conciliación operación-por-operación de Mercado Pago vs lo que cargó el encargado.
// La idea (Pablo): no mirar el total bruto, sino CHOCAR cada cobro que MP registró
// contra cada ingreso que cargó el encargado, por canal (MP QR de mostrador vs
// Mercado Delivery), y marcar lo que no coincide.
//
// Fuente MP = operaciones aprobadas del reporte (settlement o collection), con su
// VALOR DE LA COMPRA (bruto) y su CANAL DE VENTA. Fuente encargado = las líneas de
// ingreso que ya se guardan individuales (cierre_detalle) en los canales de MP.
//
// El emparejamiento es por MONTO (el encargado no carga el N° de operación de MP):
// se arma un multiset de montos por canal y se cruzan; los que sobran de un lado son
// las diferencias. round2 en ambos lados para que un centavo no rompa el match.
import { round2 } from '@/lib/money'

// Canales de MP que reconciliamos. 'mercado_pedidos' = Mercado Delivery (app),
// 'mercadopago' = Mercado Pago / QR de mostrador.
export type CanalMp = 'mercado_pedidos' | 'mercadopago'

export interface OperacionMp {
  canal: CanalMp
  monto: number // VALOR DE LA COMPRA (bruto) de la operación aprobada
}

export interface LineaEncargado {
  canal: CanalMp
  monto: number
}

export interface ParMatch {
  monto: number
  cantidad: number
}

export interface ConciliacionCanal {
  canal: CanalMp
  coincidencias: ParMatch[] // montos que aparecen en ambos (cantidad = pares emparejados)
  soloMp: ParMatch[] // MP lo cobró y el encargado NO lo cargó
  soloEncargado: ParMatch[] // el encargado lo cargó y MP no lo tiene
  totalMp: number
  totalEncargado: number
  diferencia: number // totalEncargado - totalMp (positivo = cargó de más)
  cuadra: boolean // el DETALLE empareja perfecto (nada suelto de ningún lado)
  totalCuadra: boolean // el TOTAL coincide aunque el detalle no empareje
  // El encargado parece haber cargado EL TOTAL del día en vez de cada venta: cargó
  // pocas líneas y una ≈ la suma de varias operaciones de MP sin emparejar.
  probableTotalCargado: boolean
}

function multiset(items: { monto: number }[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const it of items) {
    const k = round2(it.monto)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function conciliarUnCanal(canal: CanalMp, mp: OperacionMp[], enc: LineaEncargado[]): ConciliacionCanal {
  const msMp = multiset(mp)
  const msEnc = multiset(enc)
  const montos = new Set<number>([...msMp.keys(), ...msEnc.keys()])

  const coincidencias: ParMatch[] = []
  const soloMp: ParMatch[] = []
  const soloEncargado: ParMatch[] = []

  for (const monto of [...montos].sort((a, b) => b - a)) {
    const cMp = msMp.get(monto) ?? 0
    const cEnc = msEnc.get(monto) ?? 0
    const pares = Math.min(cMp, cEnc)
    if (pares > 0) coincidencias.push({ monto, cantidad: pares })
    if (cMp > cEnc) soloMp.push({ monto, cantidad: cMp - cEnc })
    if (cEnc > cMp) soloEncargado.push({ monto, cantidad: cEnc - cMp })
  }

  const totalMp = round2(mp.reduce((s, o) => s + o.monto, 0))
  const totalEncargado = round2(enc.reduce((s, o) => s + o.monto, 0))
  const diferencia = round2(totalEncargado - totalMp)
  const cuadra = soloMp.length === 0 && soloEncargado.length === 0
  const totalCuadra = Math.abs(diferencia) <= Math.max(1, round2(totalMp * 0.005))

  // "Cargó el total": el encargado cargó pocas líneas y una de ellas ≈ la suma de
  // varias operaciones de MP sin emparejar → cargó el total del día, no cada venta.
  const sumaSoloMp = round2(soloMp.reduce((s, p) => s + p.monto * p.cantidad, 0))
  const cantSoloMp = soloMp.reduce((s, p) => s + p.cantidad, 0)
  const probableTotalCargado =
    cantSoloMp >= 2 &&
    soloEncargado.length > 0 &&
    soloEncargado.length <= 2 &&
    soloEncargado.some((p) => Math.abs(p.monto - sumaSoloMp) <= Math.max(1, sumaSoloMp * 0.005))

  return {
    canal,
    coincidencias,
    soloMp,
    soloEncargado,
    totalMp,
    totalEncargado,
    diferencia,
    cuadra,
    totalCuadra,
    probableTotalCargado,
  }
}

export interface ConciliacionResultado {
  porCanal: ConciliacionCanal[]
  cuadraTodo: boolean
}

const CANALES: CanalMp[] = ['mercado_pedidos', 'mercadopago']

// Empareja las operaciones de MP contra las líneas del encargado, canal por canal.
export function conciliarMp(operaciones: OperacionMp[], lineas: LineaEncargado[]): ConciliacionResultado {
  const porCanal = CANALES.map((c) =>
    conciliarUnCanal(
      c,
      operaciones.filter((o) => o.canal === c),
      lineas.filter((l) => l.canal === c),
    ),
  ).filter((r) => r.totalMp > 0 || r.totalEncargado > 0) // sólo canales con algo

  return { porCanal, cuadraTodo: porCanal.every((r) => r.cuadra) }
}

// Mapea el texto "CANAL DE VENTA" del reporte de MP a nuestro canal interno.
// Delivery/PedidosYa/Rappi/Uber vía MP → Mercado Delivery; el resto (QR, Point,
// presencial, link de pago) → Mercado Pago / QR.
export function canalDeVenta(texto: string): CanalMp {
  const n = texto.toLowerCase()
  return n.includes('delivery') ? 'mercado_pedidos' : 'mercadopago'
}
