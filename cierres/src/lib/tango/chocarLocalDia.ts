// "Autopsia" del control declarado vs Tango para UN local y UN día: junta las
// tres fuentes (declarado por turno/canal, facturación real por hora ya
// sincronizada, cobros de Tango por medio de pago vía bridge) y produce el
// choque canal por canal + un diagnóstico automático de los patrones típicos
// (doble carga de PedidosYa efectivo, canal sin declarar, venta de madrugada).
import { prisma } from '@/lib/db'
import { round2 } from '@/lib/money'
import { CANAL_LABEL } from '@/lib/informes/report'
import { estadoTango, type EstadoTango } from '@/lib/dashboard/controlTango'
import { fetchCobrosTango, medioACanal, TangoBridgeError } from '@/lib/tango/cobrosBridge'
import type { Canal, Turno } from '@/lib/cierre/types'

export interface ChoqueCanal {
  canal: Canal
  label: string
  declarado: number
  tangoCobros: number
  dif: number // declarado − cobros
  // false = este canal no se puede validar contra los cobros de caja (el efectivo
  // suele ir a CAJA FUERTE y Mercado Delivery no registra cobro): solo referencia.
  verificable: boolean
}

export interface Hallazgo {
  tono: 'rojo' | 'ambar' | 'info'
  titulo: string
  detalle: string
}

export interface AutopsiaTango {
  fecha: string
  localId: number
  localNombre: string
  sinMapeo: boolean
  declarado: {
    total: number
    zTipeado: number
    porTurno: { turno: Turno; z: number; total: number; canales: { canal: Canal; label: string; monto: number }[] }[]
  }
  tango: {
    facturacion: number | null // null = el BI no sincronizó ese día todavía
    tickets: number | null
    porHora: { hora: number; importe: number; tickets: number }[]
    cobros: { medio: string; canal: Canal; importe: number }[] | null // null = bridge caído
    bridgeError: string | null
  }
  choque: ChoqueCanal[]
  gap: number | null // declarado.total − tango.facturacion
  estado: EstadoTango | null
  hallazgos: Hallazgo[]
}

// Canales cuyo total SÍ tiene que aparecer en los cobros de caja de Tango.
const VERIFICABLES = new Set<Canal>(['tarjetas', 'mercadopago', 'pedidosya', 'pedidosya_efectivo', 'rappi', 'pvs_qr'])
const ORDEN_CANAL: Canal[] = [
  'efectivo', 'tarjetas', 'mercadopago', 'pedidosya', 'pedidosya_efectivo', 'rappi',
  'mercado_pedidos', 'pvs_qr', 'uber', 'delivery_propio', 'varios',
]
const ORDEN_TURNO: Turno[] = ['manana', 'tarde']

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export async function chocarLocalDia(localId: number, fecha: string): Promise<AutopsiaTango> {
  const fechaDate = new Date(`${fecha}T00:00:00.000Z`)
  const [local, cierres, horas] = await Promise.all([
    prisma.local.findUniqueOrThrow({ where: { id: localId }, select: { nombre: true, tangoSucursalId: true } }),
    prisma.cierre.findMany({ where: { localId, fecha: fechaDate }, include: { ventas: true } }),
    prisma.ventaTangoHora.findMany({ where: { localId, fecha: fechaDate }, orderBy: { hora: 'asc' } }),
  ])

  // --- Declarado por turno/canal ---
  const porTurno = ORDEN_TURNO
    .map((turno) => {
      const c = cierres.find((x) => x.turno === turno)
      if (!c) return null
      const canales = c.ventas
        .filter((v) => Number(v.monto) !== 0)
        .map((v) => ({ canal: v.canal as Canal, label: CANAL_LABEL[v.canal as Canal] ?? v.canal, monto: Number(v.monto) }))
        .sort((a, b) => b.monto - a.monto)
      return { turno, z: Number(c.montoZ), total: round2(canales.reduce((s, x) => s + x.monto, 0)), canales }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
  const totalDeclarado = round2(porTurno.reduce((s, t) => s + t.total, 0))
  const zTipeado = round2(porTurno.reduce((s, t) => s + t.z, 0))

  // --- Tango: facturación (base local, ya sincronizada) ---
  const facturacion = horas.length ? round2(horas.reduce((s, h) => s + Number(h.monto), 0)) : null
  const tickets = horas.length ? horas.reduce((s, h) => s + h.tickets, 0) : null
  const porHora = horas.map((h) => ({ hora: h.hora, importe: Number(h.monto), tickets: h.tickets }))

  // --- Tango: cobros por medio (bridge, en vivo; tolerante a caída) ---
  let cobros: AutopsiaTango['tango']['cobros'] = null
  let bridgeError: string | null = null
  if (local.tangoSucursalId != null) {
    try {
      const rows = await fetchCobrosTango(fecha, fecha)
      cobros = rows
        .filter((r) => r.id_sucursal === local.tangoSucursalId)
        .map((r) => ({ medio: r.medio_pago, canal: medioACanal(r.medio_pago), importe: Number(r.importe) }))
        .sort((a, b) => b.importe - a.importe)
    } catch (e) {
      bridgeError = e instanceof TangoBridgeError ? e.message : e instanceof Error ? e.message : String(e)
    }
  }

  // --- Choque canal por canal (declarado vs cobros) ---
  const decCanal = new Map<Canal, number>()
  for (const t of porTurno) for (const c of t.canales) decCanal.set(c.canal, round2((decCanal.get(c.canal) ?? 0) + c.monto))
  const cobCanal = new Map<Canal, number>()
  for (const c of cobros ?? []) cobCanal.set(c.canal, round2((cobCanal.get(c.canal) ?? 0) + c.importe))
  const canales = new Set<Canal>([...decCanal.keys(), ...cobCanal.keys()])
  const choque: ChoqueCanal[] = ORDEN_CANAL.filter((c) => canales.has(c)).map((canal) => {
    const declarado = decCanal.get(canal) ?? 0
    const tangoCobros = cobCanal.get(canal) ?? 0
    return {
      canal,
      label: CANAL_LABEL[canal] ?? canal,
      declarado,
      tangoCobros,
      dif: round2(declarado - tangoCobros),
      verificable: VERIFICABLES.has(canal),
    }
  })

  const gap = facturacion != null ? round2(totalDeclarado - facturacion) : null
  const estado = facturacion != null && facturacion > 0 ? estadoTango(gap ?? 0, facturacion) : null

  // --- Diagnóstico automático ---
  const hallazgos: Hallazgo[] = []

  if (local.tangoSucursalId == null) {
    hallazgos.push({ tono: 'info', titulo: 'Local sin mapear a Tango', detalle: 'Este local no tiene sucursal de Tango asociada; no se puede controlar.' })
  }
  if (facturacion == null) {
    hallazgos.push({ tono: 'info', titulo: 'Sin datos de Tango para este día', detalle: 'El BI sincroniza cada mañana el día anterior. Para el día de hoy todavía no hay facturación real.' })
  }
  if (cierres.length === 0 && facturacion != null && facturacion > 0) {
    hallazgos.push({ tono: 'rojo', titulo: 'No se cargó ningún cierre', detalle: `Tango facturó ${fmt(facturacion)} este día pero no hay carga del encargado.` })
  }
  if (estado === 'cuadra') {
    hallazgos.push({ tono: 'info', titulo: 'Cuadra contra Tango', detalle: `Declarado ${fmt(totalDeclarado)} vs facturado ${fmt(facturacion ?? 0)}: diferencia dentro de la tolerancia.` })
  }

  // El Z tipeado coincide con Tango → el problema es el desglose, no el total.
  if (facturacion != null && facturacion > 0 && zTipeado > 0 && Math.abs(zTipeado - facturacion) <= Math.max(1000, facturacion * 0.005) && estado !== 'cuadra') {
    hallazgos.push({
      tono: 'info',
      titulo: 'El Z tipeado está bien — el error está en el desglose',
      detalle: `El Z que cargó el encargado (${fmt(zTipeado)}) coincide con la facturación real. Revisar cómo repartió la venta entre canales.`,
    })
  }
  if (zTipeado === 0 && facturacion != null && facturacion > 0 && cierres.length > 0) {
    hallazgos.push({ tono: 'ambar', titulo: 'No tipearon el Cierre Z', detalle: 'Los turnos se cargaron con Z en $0. Pedirles que lo completen.' })
  }

  // Posible doble carga: "efectivo" idéntico a "PedidosYa (efectivo)" en el mismo turno.
  for (const t of porTurno) {
    const efvo = t.canales.find((c) => c.canal === 'efectivo')
    const pyaE = t.canales.find((c) => c.canal === 'pedidosya_efectivo')
    if (efvo && pyaE && efvo.monto > 0 && Math.abs(efvo.monto - pyaE.monto) <= 1) {
      hallazgos.push({
        tono: 'rojo',
        titulo: `Posible doble carga de PedidosYa efectivo (turno ${t.turno === 'manana' ? 'mañana' : 'noche'})`,
        detalle: `"Efectivo" (${fmt(efvo.monto)}) y "PedidosYa (efectivo)" (${fmt(pyaE.monto)}) tienen el mismo importe: suele ser el mismo pedido cargado dos veces.`,
      })
    }
  }

  // Canales verificables: cobrado por Tango y no declarado / declarado distinto.
  if (cobros != null) {
    for (const c of choque.filter((x) => x.verificable)) {
      if (c.tangoCobros > 1000 && c.declarado === 0) {
        hallazgos.push({ tono: 'rojo', titulo: `Venta por ${c.label} sin declarar`, detalle: `Tango cobró ${fmt(c.tangoCobros)} por ${c.label} y el encargado no declaró nada en ese canal.` })
      } else if (Math.abs(c.dif) > Math.max(1000, c.tangoCobros * 0.05)) {
        hallazgos.push({
          tono: 'ambar',
          titulo: `${c.label}: declarado ${c.dif > 0 ? 'de más' : 'de menos'}`,
          detalle: `Declarado ${fmt(c.declarado)} vs ${fmt(c.tangoCobros)} cobrados por Tango (${c.dif > 0 ? '+' : ''}${fmt(c.dif)}).`,
        })
      }
    }
  } else if (bridgeError && local.tangoSucursalId != null) {
    hallazgos.push({ tono: 'info', titulo: 'Bridge de Tango sin respuesta', detalle: 'No se pudo traer el detalle por medio de pago; se muestra solo la facturación sincronizada.' })
  }

  // Venta de madrugada (hora 0-5): la clásica olvidada al cerrar el turno noche.
  const madrugada = porHora.filter((h) => h.hora <= 5 && h.importe > 0)
  if (madrugada.length && estado !== 'cuadra' && estado !== null) {
    const totalM = round2(madrugada.reduce((s, h) => s + h.importe, 0))
    hallazgos.push({
      tono: 'ambar',
      titulo: 'Hay venta de madrugada',
      detalle: `Tango registró ${fmt(totalM)} después de medianoche (${madrugada.map((h) => `${h.hora}h ${fmt(h.importe)}`).join(', ')}). Es lo que más se olvida al cerrar el turno noche.`,
    })
  }

  const orden = { rojo: 0, ambar: 1, info: 2 } as const
  hallazgos.sort((a, b) => orden[a.tono] - orden[b.tono])

  return {
    fecha,
    localId,
    localNombre: local.nombre,
    sinMapeo: local.tangoSucursalId == null,
    declarado: { total: totalDeclarado, zTipeado, porTurno },
    tango: { facturacion, tickets, porHora, cobros, bridgeError },
    choque,
    gap,
    estado,
    hallazgos,
  }
}
