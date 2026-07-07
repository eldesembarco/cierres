import pg from 'pg'
const { Client } = pg

const BASE = process.env.TANGO_BRIDGE_URL
const SECRET = process.env.TANGO_BRIDGE_SECRET
const DESDE = process.argv[2] ?? '2026-07-01'
const HASTA = process.argv[3] ?? '2026-07-06'

const r2 = (n) => Math.round(Number(n) * 100) / 100

async function fetchBridge(path, desde, hasta) {
  const res = await fetch(`${BASE}${path}?desde=${desde}&hasta=${hasta}`, {
    headers: { 'x-bridge-secret': SECRET },
  })
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return res.json()
}

function fechas(desde, hasta) {
  const out = []
  for (let d = new Date(desde + 'T00:00:00Z'); d <= new Date(hasta + 'T00:00:00Z'); d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

const c = new Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

const locs = await c.query(`SELECT id, tango_sucursal_id FROM "cierres"."locales" WHERE tango_sucursal_id IS NOT NULL`)
const porSuc = new Map(locs.rows.map((l) => [l.tango_sucursal_id, l.id]))

console.log(`Backfill ${DESDE} .. ${HASTA}`)
const [horas, articulos] = await Promise.all([
  fetchBridge('/ventas-horas', DESDE, HASTA),
  fetchBridge('/ventas-articulos', DESDE, HASTA),
])

let totHoras = 0
for (const f of fechas(DESDE, HASTA)) {
  const fh = horas.filter((r) => r.fecha.slice(0, 10) === f && porSuc.has(r.id_sucursal))
  const fa = articulos.filter((r) => r.fecha.slice(0, 10) === f && porSuc.has(r.id_sucursal))
  try {
    await c.query('BEGIN')
    await c.query(`DELETE FROM "cierres"."venta_tango_hora" WHERE fecha=$1`, [f])
    await c.query(`DELETE FROM "cierres"."venta_tango_articulo" WHERE fecha=$1`, [f])
    for (const r of fh) {
      await c.query(
        `INSERT INTO "cierres"."venta_tango_hora" (local_id, fecha, hora, monto, tickets) VALUES ($1,$2,$3,$4,$5)`,
        [porSuc.get(r.id_sucursal), f, r.hora, r2(r.importe), Number(r.tickets) || 0]
      )
    }
    for (const r of fa) {
      await c.query(
        `INSERT INTO "cierres"."venta_tango_articulo" (local_id, fecha, codigo, descripcion, rubro, cantidad, monto)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [porSuc.get(r.id_sucursal), f, r.cod_articulo, r.descripcion, r.rubro ?? null, Number(r.cantidad), r2(r.importe)]
      )
    }
    await c.query(
      `INSERT INTO "cierres"."venta_tango_sync" (fecha, filas_horas, filas_articulos, sincronizado_en)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (fecha) DO UPDATE SET filas_horas=$2, filas_articulos=$3, sincronizado_en=now()`,
      [f, fh.length, fa.length]
    )
    await c.query('COMMIT')
    totHoras += fh.length
    console.log(`${f}: ${fh.length} filas hora, ${fa.length} articulos OK`)
  } catch (e) {
    await c.query('ROLLBACK')
    console.error(`${f}: ERROR ${e.message}`)
  }
}

const v = await c.query(
  `SELECT COUNT(DISTINCT hora)::int AS horas_distintas, SUM(monto)::numeric AS total
     FROM "cierres"."venta_tango_hora" WHERE local_id=5 AND fecha='2026-07-02'`
)
console.log(`\nVALIDACION Microcentro 02/07: ${v.rows[0].horas_distintas} horas distintas, total $${Number(v.rows[0].total).toLocaleString('es-AR')}`)
await c.end()
