// Monitorea la recuperación de Neon: prueba la base directa y el endpoint de prod
// cada 30s durante hasta 30 minutos. Termina apenas AMBOS respondan bien.
import pg from 'pg'
const PROD = 'https://cierres-seven.vercel.app/api/tango/bridge-url'
const SECRET = process.env.TANGO_INGEST_SECRET
const t0 = Date.now()
for (let i = 1; i <= 60; i++) {
  let db = false, prod = false
  try {
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
    await c.connect(); await c.query('SELECT 1'); await c.end(); db = true
  } catch {}
  try {
    const r = await fetch(PROD, { headers: { 'x-ingest-secret': SECRET }, signal: AbortSignal.timeout(15000) })
    prod = r.ok
  } catch {}
  const min = ((Date.now() - t0) / 60000).toFixed(1)
  console.log(`[${min}min] DB:${db ? 'OK' : 'CAIDA'} PROD:${prod ? 'OK' : 'CAIDA'}`)
  if (db && prod) { console.log('RECUPERADO: base y produccion responden.'); process.exit(0) }
  await new Promise((r) => setTimeout(r, 30000))
}
console.log('SIGUE CAIDA despues de 30 minutos.')
process.exit(1)
