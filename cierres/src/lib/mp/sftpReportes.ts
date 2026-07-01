// Baja los reportes de Liberaciones que Mercado Pago deja por SFTP en el VPS.
// Usa el usuario dedicado read-only (mpreportes). Credenciales por variables de
// entorno (MP_SFTP_*). Devuelve todos los .xlsx/.csv de la carpeta como buffers.
import SftpClient from 'ssh2-sftp-client'
import type { ArchivoLiberacion } from '@/lib/mp/consolidarLiberaciones'

export interface SftpConfig {
  host: string
  port: number
  username: string
  password: string
  dir: string
}

export function sftpConfigFromEnv(): SftpConfig {
  const host = process.env.MP_SFTP_HOST
  const username = process.env.MP_SFTP_USER
  const password = process.env.MP_SFTP_PASS
  if (!host || !username || !password) {
    throw new Error('Faltan variables de entorno del SFTP de Mercado Pago (MP_SFTP_HOST/USER/PASS).')
  }
  return {
    host,
    port: Number(process.env.MP_SFTP_PORT ?? 22),
    username,
    password,
    dir: process.env.MP_SFTP_DIR ?? '/home/mpreportes/reportes',
  }
}

const esReporte = (nombre: string) =>
  /\.(xlsx|csv)$/i.test(nombre) && !/connection-check/i.test(nombre)

// Fecha (YYYY-MM-DD) embebida en el nombre del reporte, o null si no la tiene.
function fechaDelNombre(nombre: string): string | null {
  const m = nombre.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

export interface DescargaOpts {
  // Si se pasa, solo baja reportes cuyo nombre tenga fecha >= desdeFecha. Un reporte
  // de settlement datado antes del día objetivo no puede contener ese día (trae días
  // anteriores), así que se puede saltear con seguridad — y acota la lectura a medida
  // que la carpeta acumula archivos.
  desdeFecha?: string
}

export async function descargarReportes(cfg: SftpConfig, opts: DescargaOpts = {}): Promise<ArchivoLiberacion[]> {
  const sftp = new SftpClient()
  await sftp.connect({ host: cfg.host, port: cfg.port, username: cfg.username, password: cfg.password })
  try {
    const entries = await sftp.list(cfg.dir)
    const files = entries.filter((e) => {
      if (e.type !== '-' || !esReporte(e.name)) return false
      if (!opts.desdeFecha) return true
      const f = fechaDelNombre(e.name)
      return f === null || f >= opts.desdeFecha
    })
    // Descarga con concurrencia acotada (pool) sobre la misma conexión: mucho más
    // rápido que secuencial, sin saturar la conexión ni disparar warnings de listeners.
    const out: ArchivoLiberacion[] = new Array(files.length)
    let next = 0
    const worker = async () => {
      for (;;) {
        const i = next++
        if (i >= files.length) return
        out[i] = { nombre: files[i].name, buffer: (await sftp.get(`${cfg.dir}/${files[i].name}`)) as Buffer }
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, files.length) }, worker))
    return out
  } finally {
    await sftp.end()
  }
}
