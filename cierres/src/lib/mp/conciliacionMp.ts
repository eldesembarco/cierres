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

// Par "producto + envío" de Mercado Delivery: el encargado declara lo que pagó el
// cliente (producto + envío) pero el settlement de MP liquida SOLO el producto —
// el envío va al repartidor, nunca es ingreso del local. Detectado empíricamente:
// difs fijas escalonadas ($590/$780/$1.130/$1.300...) repetidas en todos los locales.
export interface ParEnvio {
  montoEncargado: number // lo declarado (producto + envío)
  montoMp: number // VALOR DE LA COMPRA del settlement (solo producto)
  envio: number // la diferencia = costo de envío estimado
  cantidad: number
}

export interface ConciliacionCanal {
  canal: CanalMp
  coincidencias: ParMatch[] // montos que aparecen en ambos (cantidad = pares emparejados)
  conEnvio: ParEnvio[] // pares emparejados como producto+envío (solo mercado_pedidos)
  soloMp: ParMatch[] // MP lo cobró y el encargado NO lo cargó
  soloEncargado: ParMatch[] // el encargado lo cargó y MP no lo tiene
  totalMp: number
  totalEncargado: number
  totalEnvios: number // suma de envíos detectados (no son ingreso del local)
  diferencia: number // totalEncargado - totalMp (positivo = cargó de más)
  diferenciaSinEnvios: number // diferencia - totalEnvios: la diferencia REAL a revisar
  cuadra: boolean // el DETALLE empareja perfecto (nada suelto; los pares con envío cuentan como matcheados)
  totalCuadra: boolean // el TOTAL (sin envíos) coincide aunque el detalle no empareje
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

// Rango plausible del costo de envío de Mercado Delivery (tiers reales observados:
// $590 / $780 / $1.130 / $1.300 / $1.720 / $1.860). Solo emparejamos como
// "producto + envío" si la dif cae acá Y es < 25% del producto: acota falsos pares.
const ENVIO_MIN = 200
const ENVIO_MAX = 3500

function expandir(pares: ParMatch[]): number[] {
  const out: number[] = []
  for (const p of pares) for (let i = 0; i < p.cantidad; i++) out.push(p.monto)
  return out.sort((a, b) => b - a)
}

function comprimir(montos: number[]): ParMatch[] {
  const m = multiset(montos.map((x) => ({ monto: x })))
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([monto, cantidad]) => ({ monto, cantidad }))
}

function conciliarUnCanal(canal: CanalMp, mp: OperacionMp[], enc: LineaEncargado[]): ConciliacionCanal {
  const msMp = multiset(mp)
  const msEnc = multiset(enc)
  const montos = new Set<number>([...msMp.keys(), ...msEnc.keys()])

  const coincidencias: ParMatch[] = []
  let soloMp: ParMatch[] = []
  let soloEncargado: ParMatch[] = []

  for (const monto of [...montos].sort((a, b) => b - a)) {
    const cMp = msMp.get(monto) ?? 0
    const cEnc = msEnc.get(monto) ?? 0
    const pares = Math.min(cMp, cEnc)
    if (pares > 0) coincidencias.push({ monto, cantidad: pares })
    if (cMp > cEnc) soloMp.push({ monto, cantidad: cMp - cEnc })
    if (cEnc > cMp) soloEncargado.push({ monto, cantidad: cEnc - cMp })
  }

  // Segunda pasada (solo Mercado Delivery): emparejar "producto + envío". Para cada
  // línea del encargado sin par exacto, buscar la operación MP más cercana POR DEBAJO
  // cuya dif caiga en el rango de envío. Greedy de mayor a menor.
  const conEnvio: ParEnvio[] = []
  if (canal === 'mercado_pedidos' && soloEncargado.length && soloMp.length) {
    const encSueltos = expandir(soloEncargado)
    const mpSueltos = expandir(soloMp)
    const encRestantes: number[] = []
    for (const e of encSueltos) {
      let best = -1
      let bestDif = Infinity
      mpSueltos.forEach((m, i) => {
        const dif = round2(e - m)
        if (dif < ENVIO_MIN || dif > ENVIO_MAX || dif > m * 0.25) return
        if (dif < bestDif) { bestDif = dif; best = i }
      })
      if (best >= 0) {
        const m = mpSueltos.splice(best, 1)[0]
        const previo = conEnvio.find((p) => p.montoEncargado === e && p.montoMp === m)
        if (previo) previo.cantidad += 1
        else conEnvio.push({ montoEncargado: e, montoMp: m, envio: round2(e - m), cantidad: 1 })
      } else {
        encRestantes.push(e)
      }
    }
    soloEncargado = comprimir(encRestantes)
    soloMp = comprimir(mpSueltos)
  }

  const totalMp = round2(mp.reduce((s, o) => s + o.monto, 0))
  const totalEncargado = round2(enc.reduce((s, o) => s + o.monto, 0))
  const totalEnvios = round2(conEnvio.reduce((s, p) => s + p.envio * p.cantidad, 0))
  const diferencia = round2(totalEncargado - totalMp)
  const diferenciaSinEnvios = round2(diferencia - totalEnvios)
  const cuadra = soloMp.length === 0 && soloEncargado.length === 0
  const totalCuadra = Math.abs(diferenciaSinEnvios) <= Math.max(1, round2(totalMp * 0.005))

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
    conEnvio,
    soloMp,
    soloEncargado,
    totalMp,
    totalEncargado,
    totalEnvios,
    diferencia,
    diferenciaSinEnvios,
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
