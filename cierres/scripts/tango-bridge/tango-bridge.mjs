// tango-bridge.mjs — puente de SOLO LECTURA entre Tango (SQL Server, SRVTANGO) y
// las apps del grupo (cierres / BI de ventas). Expone las vistas como JSON por
// HTTP autenticado con secreto compartido, levanta su propio túnel de Cloudflare
// y AVISA SOLO su URL nueva a las apps cada vez que el túnel cambia (auto-registro),
// así un reinicio del server no corta la integración.
//
// Corre en C:\tango-bridge del server de Tango como tarea programada al inicio.
// Config en config.json (mismo directorio). Node >= 20.
import http from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sql from 'mssql'

const DIR = path.dirname(fileURLToPath(import.meta.url))
// El slice saca el BOM que deja PowerShell al escribir UTF-8.
const _cfgRaw = readFileSync(path.join(DIR, 'config.json'), 'utf8')
const cfg = JSON.parse(_cfgRaw.charCodeAt(0) === 0xFEFF ? _cfgRaw.slice(1) : _cfgRaw)

const log = (...a) => console.log(new Date().toISOString().replace('T', ' ').slice(0, 19), ...a)

// ---------- SQL Server ----------
// "localhost\\AXSQLEXPRESS" → host + instancia nombrada (resuelta vía SQL Browser).
const [servidor, instancia] = String(cfg.sql.servidor).split('\\')
const poolCfg = {
  server: servidor,
  database: cfg.sql.base,
  user: cfg.sql.usuario,
  password: cfg.sql.password,
  options: {
    trustServerCertificate: true,
    encrypt: false,
    ...(instancia ? { instanceName: instancia } : {}),
  },
  pool: { max: 4, min: 0 },
  requestTimeout: 120_000,
  connectionTimeout: 20_000,
}
let pool = null
async function getPool() {
  if (pool && pool.connected) return pool
  pool = await new sql.ConnectionPool(poolCfg).connect()
  return pool
}

// ---------- Endpoints de datos (todas consultas por rango de fechas sobre vistas) ----------
const QUERIES = {
  '/cobros': `
    SELECT CONVERT(varchar(10), FECHA, 23) AS fecha, ID_SUCURSAL AS id_sucursal,
           MEDIO_PAGO AS medio_pago, IMPORTE AS importe
    FROM dbo.vw_CobrosDiarios
    WHERE FECHA BETWEEN @desde AND @hasta
    ORDER BY FECHA, ID_SUCURSAL, MEDIO_PAGO;`,
  '/ventas-horas': `
    SELECT CONVERT(varchar(10), FECHA, 23) AS fecha, ID_SUCURSAL AS id_sucursal,
           HORA AS hora, IMPORTE AS importe, TICKETS AS tickets
    FROM dbo.vw_VentasPorHora
    WHERE FECHA BETWEEN @desde AND @hasta
    ORDER BY FECHA, ID_SUCURSAL, HORA;`,
  '/ventas-articulos': `
    SELECT CONVERT(varchar(10), FECHA, 23) AS fecha, ID_SUCURSAL AS id_sucursal,
           COD_ARTICULO AS cod_articulo, DESCRIPCION AS descripcion, RUBRO AS rubro,
           CANTIDAD AS cantidad, IMPORTE AS importe
    FROM dbo.vw_VentasPorArticulo
    WHERE FECHA BETWEEN @desde AND @hasta
    ORDER BY FECHA, ID_SUCURSAL, COD_ARTICULO;`,
}

const isFecha = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

// ---------- Servidor HTTP ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  // /salud no exige secreto: no expone datos, sirve para diagnosticar.
  if (url.pathname === '/salud') {
    try {
      const p = await getPool()
      await p.request().query('SELECT 1 AS ok')
      return json(res, 200, { ok: true, sql: 'ok', tunel: tunelUrl })
    } catch (e) {
      return json(res, 200, { ok: true, sql: 'error', detalle: String(e.message), tunel: tunelUrl })
    }
  }

  if (req.headers['x-bridge-secret'] !== cfg.secreto) return json(res, 401, { error: 'No autorizado' })

  const query = QUERIES[url.pathname]
  if (!query) return json(res, 404, { error: `No existe ${url.pathname}` })

  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  if (!isFecha(desde) || !isFecha(hasta)) return json(res, 400, { error: 'desde/hasta AAAA-MM-DD requeridos' })

  try {
    const p = await getPool()
    const r = await p.request().input('desde', sql.Date, desde).input('hasta', sql.Date, hasta).query(query)
    log(`${url.pathname} ${desde}..${hasta} -> ${r.recordset.length} filas`)
    return json(res, 200, r.recordset)
  } catch (e) {
    log(`ERROR ${url.pathname}: ${e.message}`)
    pool = null // fuerza reconexión en el próximo pedido
    return json(res, 502, { error: String(e.message) })
  }
})

server.listen(cfg.puerto, () => log(`Bridge escuchando en http://localhost:${cfg.puerto}`))

// ---------- Túnel Cloudflare + auto-registro de la URL ----------
let tunelUrl = null

async function registrarUrl(urlNueva) {
  for (const destino of cfg.registro ?? []) {
    try {
      const r = await fetch(destino.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ingest-secret': destino.secreto },
        body: JSON.stringify({ url: urlNueva }),
      })
      log(`auto-registro en ${destino.url}: HTTP ${r.status}`)
    } catch (e) {
      log(`auto-registro en ${destino.url} FALLO: ${e.message}`)
    }
  }
}

function arrancarTunel() {
  const exe = cfg.cloudflared
  if (!exe || !existsSync(exe)) {
    log('cloudflared no configurado/encontrado: el bridge queda solo accesible en la LAN.')
    return
  }
  // --protocol http2: QUIC suele estar bloqueado en esta red.
  const proc = spawn(exe, ['tunnel', '--url', `http://localhost:${cfg.puerto}`, '--protocol', 'http2'], {
    windowsHide: true,
  })
  const buscarUrl = (chunk) => {
    const m = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
    if (m && m[0] !== tunelUrl) {
      tunelUrl = m[0]
      log(`TUNEL ACTIVO: ${tunelUrl}`)
      try { writeFileSync(path.join(DIR, 'tunel-url.txt'), tunelUrl) } catch {}
      registrarUrl(tunelUrl)
    }
  }
  proc.stdout.on('data', buscarUrl)
  proc.stderr.on('data', buscarUrl)
  proc.on('exit', (code) => {
    log(`cloudflared termino (code ${code}); reintento en 15s...`)
    tunelUrl = null
    setTimeout(arrancarTunel, 15_000)
  })
}
arrancarTunel()
