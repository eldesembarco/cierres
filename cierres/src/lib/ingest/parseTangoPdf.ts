import { parseMoney, round2 } from '@/lib/money'
import type { Canal, Turno } from '@/lib/cierre/types'

export interface TangoPdfResult {
  fecha: string | null
  turno: Turno | null
  ventas: { canal: Canal; monto: number }[]
  montoZ: number
  cantidadTickets: number | null
  // Anulaciones y devoluciones del cierre (para control/auditoría del admin).
  // Default 0 si la sección no aparece en el PDF.
  anulacionesAfectanCaja: number
  anulacionesTotal: number
  devolucionesTotal: number
}

// Patrón de monto en formato del PDF de Tango (en-US: coma = miles, punto = decimal).
const MONEY = '([\\d]{1,3}(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)'

// Normaliza el texto extraído del PDF antes de parsear. `unpdf` extrae distintos
// PDFs de cierre Tango con DISTINTO espaciado: a veces limpio
// ("21/06/2026", "126,200.00"), a veces con espacios espurios dentro de palabras
// y números ("23/ 06/ 2026", "137, 445. 00", "Ef ec t i v o"). Esta función:
//   1. Colapsa toda corrida de whitespace a un solo espacio.
//   2. Une dígitos partidos alrededor de un separador (/ . ,), p. ej.
//      "23/ 06/ 2026" → "23/06/2026" y "137, 445. 00" → "137,445.00".
//      OJO: NO unimos dígito-espacio-dígito sin separador (eso fusionaría un
//      conteo con un monto, p. ej. "10 151,945" en "TOTAL TURNO: 10 151,945.00").
function normalizeTango(text: string): string {
  let s = text.replace(/\s+/g, ' ')
  // Repetimos hasta estabilizar: un solo pase no alcanza para corridas como
  // "1 2 3 , 4 5 6 . 0 0" (cada reemplazo consume el match y deja huecos).
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/(\d)\s*([/.,])\s*(\d)/g, '$1$2$3')
    if (next === s) break
    s = next
  }
  return s
}

// Aísla el cuerpo de una sección cuyo TÍTULO es `nombre`. En el texto real de
// `unpdf` las secciones vienen marcadas por "-- TÍTULO --", pero el "--" varía:
// a veces "--ANULACIONES--", a veces "- - ANULACIONES- -" (espacios espurios).
// Tras `normalizeTango` el whitespace ya está colapsado, así que anclamos sobre
// el TÍTULO (que viene limpio) y toleramos guiones/espacios alrededor. Devuelve
// desde después del título hasta el próximo marcador de sección (o fin de texto).
function sectionBody(text: string, nombre: string): string | null {
  // "-" o "- " repetido antes/después del título (tolerante a "- -").
  const dash = '(?:-\\s*)+'
  const re = new RegExp(`${dash}${nombre}\\s*${dash}`, 'i')
  const m = text.match(re)
  if (!m || m.index === undefined) return null
  const after = text.slice(m.index + m[0].length)
  // Próximo marcador de sección: un guion seguido (eventualmente) de otro guion
  // y una mayúscula. Tras la normalización los marcadores son "- -" o "--".
  const next = after.search(/-\s*-\s*[A-ZÁÉÍÓÚÜÑ]/)
  return next === -1 ? after : after.slice(0, next)
}

// Mapea el token de la forma de cobro (DESESPACIADO: sin espacios ni puntos, en
// MAYÚSCULAS) al canal interno de la app. Default → 'varios'.
// OJO con el orden: MERCADOPAGODELIVERY debe chequearse ANTES que MERCADOPAGO.
function mapMedioToken(token: string): Canal {
  const t = token
  if (t === 'EFECTIVO') return 'efectivo'
  if (
    t === 'VISA' ||
    t === 'MASTERCARD' ||
    t === 'VISADEBITO' ||
    t === 'MASTERCARDDEBITO' ||
    t === 'AMERICANEXPRESS' ||
    t === 'AMEX' ||
    t === 'CABAL' ||
    t === 'NARANJA'
  ) {
    return 'tarjetas'
  }
  if (t === 'MERCADOPAGODELIVERY') return 'mercado_pedidos'
  if (t === 'MERCADOPAGO' || t === 'QRNAVE') return 'mercadopago'
  if (t === 'PEYATARJETA' || t === 'PEDIDOSYAEFECTIVO' || t === 'PEYA') return 'pedidosya'
  if (t === 'RAPPI') return 'rappi'
  if (t === 'MORFY') return 'varios'
  return 'varios'
}

export function parseTangoPdf(raw: string): TangoPdfResult {
  // Normalizamos PRIMERO: colapsa whitespace y une dígitos partidos.
  const text = normalizeTango(raw)
  // Copia totalmente desespaciada (para detectar el turno aun cuando venga como
  // "TURNO TARDE" con letras separadas, o pegado).
  const despaced = text.replace(/\s+/g, '').toUpperCase()

  // --- Turno ---
  let turno: Turno | null = null
  if (/TURNOMA[ÑN]ANA/.test(despaced)) turno = 'manana'
  else if (/TURNOTARDE|TURNONOCHE/.test(despaced)) turno = 'tarde'

  // --- Fecha: primer DD/MM/YYYY → YYYY-MM-DD (tras unir las barras) ---
  let fecha: string | null = null
  const mFecha = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (mFecha) {
    const [, dd, mm, yyyy] = mFecha
    fecha = `${yyyy}-${mm}-${dd}`
  }

  // --- Cantidad de tickets ---
  let cantidadTickets: number | null = null
  const mTicketsCtx = text.match(/TOTAL\s+VENTAS:[\s\S]*?CANT\.?\s*VENTAS:\s*(\d+)/i)
  const mTicketsAny = mTicketsCtx ?? text.match(/CANT\.?\s*VENTAS:\s*(\d+)/i)
  if (mTicketsAny) cantidadTickets = Number(mTicketsAny[1])

  // --- Ventas por forma de cobro + montoZ ---
  // Aislamos la sección desde el título "VENTAS POR FORMA DE COBRO" hasta su
  // primer "TOTAL:". El "TOTAL:" cierra el bloque y define el montoZ. Dentro,
  // matcheamos pares "<etiqueta> <monto.NN>"; las filas de cabecera
  // ("Descripción Total") y las corridas de "____" no traen monto ".NN" y se
  // descartan solas.
  const ventasMap = new Map<Canal, number>()
  let montoZ = 0

  const mHeader = text.match(/VENTAS\s+POR\s+FORMA\s+DE\s+COBRO/i)
  if (mHeader && mHeader.index !== undefined) {
    const afterHeader = text.slice(mHeader.index + mHeader[0].length)
    const mTotal = afterHeader.match(new RegExp(`TOTAL:\\s*${MONEY}`, 'i'))
    if (mTotal) montoZ = parseMoney(mTotal[1])

    const bodyEnd = mTotal ? afterHeader.indexOf(mTotal[0]) : afterHeader.length
    const body = afterHeader.slice(0, bodyEnd)

    // Fila "<etiqueta> <monto>": la etiqueta es texto (letras, espacios, puntos)
    // y el monto SIEMPRE termina en ".NN" (dos decimales) — eso lo distingue de
    // conteos sueltos y nos ancla en filas de forma de cobro reales.
    const rowRe = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .]*?)\s+(\d[\d.,]*\.\d{2})/g
    let m: RegExpExecArray | null
    while ((m = rowRe.exec(body)) !== null) {
      const token = m[1].replace(/[\s.]/g, '').toUpperCase()
      const monto = parseMoney(m[2])
      if (monto === 0) continue
      const canal = mapMedioToken(token)
      ventasMap.set(canal, round2((ventasMap.get(canal) ?? 0) + monto))
    }
  }

  const ventas = [...ventasMap.entries()].map(([canal, monto]) => ({ canal, monto }))

  // --- Anulaciones (sección "ANULACIONES") ---
  // "AFECTARON CAJA TOTAL: <a>" afecta caja; distinto del "NO AFECTARON CAJA
  // TOTAL: <b>". Matcheamos el AFECTARON que NO viene precedido por "NO ". El
  // total de la sección es su "TOTAL GENERAL:" (scopeado a la sección).
  let anulacionesAfectanCaja = 0
  let anulacionesTotal = 0
  const anulBody = sectionBody(text, 'ANULACIONES')
  if (anulBody !== null) {
    const mAfecta = anulBody.match(new RegExp(`(?<!NO\\s)AFECTARON\\s+CAJA\\s+TOTAL:\\s*${MONEY}`, 'i'))
    if (mAfecta) anulacionesAfectanCaja = parseMoney(mAfecta[1])
    const mGeneral = anulBody.match(new RegExp(`TOTAL\\s+GENERAL:\\s*${MONEY}`, 'i'))
    if (mGeneral) anulacionesTotal = parseMoney(mGeneral[1])
  }

  // --- Devoluciones (sección "DEVOLUCIONES") ---
  // El importe es su "TOTAL IMPORTE:" (scopeado a la sección).
  let devolucionesTotal = 0
  const devBody = sectionBody(text, 'DEVOLUCIONES')
  if (devBody !== null) {
    const mImporte = devBody.match(new RegExp(`TOTAL\\s+IMPORTE:\\s*${MONEY}`, 'i'))
    if (mImporte) devolucionesTotal = parseMoney(mImporte[1])
  }

  return {
    fecha,
    turno,
    ventas,
    montoZ,
    cantidadTickets,
    anulacionesAfectanCaja,
    anulacionesTotal,
    devolucionesTotal,
  }
}
