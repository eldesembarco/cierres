import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

// La base Neon es compartida; esta app vive en el schema "cierres".
const adapter = new PrismaPg(
  { connectionString: process.env.DATABASE_URL },
  { schema: 'cierres' },
)
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Marcas ──
  const desembarco = await prisma.marca.upsert({
    where: { nombre: 'Desembarco' }, update: {}, create: { nombre: 'Desembarco' },
  })
  await prisma.marca.upsert({ where: { nombre: 'Mila & Go' }, update: {}, create: { nombre: 'Mila & Go' } })
  const mrTasty = await prisma.marca.upsert({ where: { nombre: 'Mr Tasty' }, update: {}, create: { nombre: 'Mr Tasty' } })

  // ── Plataformas ──
  const plataformas = [
    { nombre: 'PedidosYa', codigo: 'PY' },
    { nombre: 'Rappi', codigo: 'RA' },
    { nombre: 'Mercado Pago', codigo: 'MP' },
    { nombre: 'Mercado Delivery', codigo: 'MD' },
    { nombre: 'Uber', codigo: 'UE' },
  ]
  for (const p of plataformas) {
    await prisma.plataforma.upsert({ where: { codigo: p.codigo }, update: { nombre: p.nombre }, create: p })
  }
  const py = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: 'PY' } })
  const md = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: 'MD' } })

  // ── Locales propios (18): 16 El Desembarco + 2 Mr Tasty ──
  // Fuente: planilla "Locales El Desembarco" / "Locales Mr. Tasty" (Pablo, 2026-07-01).
  const D = desembarco.id
  const T = mrTasty.id
  const locales = [
    { id: 1,  nombre: 'Desembarco San Telmo',     marcaId: D, ciudad: 'CABA',          direccion: 'Bolívar 862' },
    { id: 2,  nombre: 'Mr Tasty Caballito',       marcaId: T, ciudad: 'CABA',          direccion: 'Av. Rivadavia 5364' },
    { id: 3,  nombre: 'Desembarco Nuñez',         marcaId: D, ciudad: 'CABA',          direccion: '11 de Septiembre de 1888 3673' },
    { id: 4,  nombre: 'Desembarco Villa Urquiza', marcaId: D, ciudad: 'CABA',          direccion: 'Donado 1971' },
    { id: 5,  nombre: 'Desembarco Microcentro',   marcaId: D, ciudad: 'CABA',          direccion: 'Tte. Gral. Juan Domingo Perón 489' },
    { id: 6,  nombre: 'Desembarco Boedo',         marcaId: D, ciudad: 'CABA',          direccion: 'Castro Barros 785' },
    { id: 7,  nombre: 'Desembarco Olivos',        marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Av. Maipú 1348' },
    { id: 8,  nombre: 'Desembarco Morón',         marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Belgrano 410' },
    { id: 9,  nombre: 'Desembarco Ramos Mejía',   marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Bartolomé Mitre 294' },
    { id: 10, nombre: 'Desembarco Pacífico',      marcaId: D, ciudad: 'CABA',          direccion: 'Av. Santa Fe 4551' },
    { id: 11, nombre: 'Desembarco Villa Devoto',  marcaId: D, ciudad: 'CABA',          direccion: 'Nueva York 3670' },
    { id: 12, nombre: 'Desembarco Villa Crespo',  marcaId: D, ciudad: 'CABA',          direccion: 'Av. Dr. Honorio Pueyrredón 1151' },
    { id: 13, nombre: 'Desembarco Hurlingham',    marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Tte. Gral. Roca 1321' },
    { id: 14, nombre: 'Desembarco Nordelta',      marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Viamonte 1649' },
    { id: 15, nombre: 'Desembarco Pacheco',       marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Av. Constituyentes 1444' },
    { id: 16, nombre: 'Desembarco Quilmes',       marcaId: D, ciudad: 'Buenos Aires',  direccion: 'Av. Mitre 747' },
    { id: 17, nombre: 'Desembarco Recoleta',      marcaId: D, ciudad: 'CABA',          direccion: 'Marcelo Torcuato de Alvear 2321' },
    { id: 18, nombre: 'Mr Tasty Florida',         marcaId: T, ciudad: 'Buenos Aires',  direccion: 'Florida 482' },
  ]
  for (const l of locales) {
    await prisma.local.upsert({
      where: { id: l.id },
      // update NO toca fondoFijoDefault (no pisar el configurado por local).
      update: { nombre: l.nombre, marcaId: l.marcaId, ciudad: l.ciudad, direccion: l.direccion },
      create: { ...l, fondoFijoDefault: 300000 },
    })
  }
  // Insertamos ids explícitos → dejamos el sequence en el máximo para no colisionar
  // si alguna vez se crea un local por autoincrement (ej. panel admin).
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('cierres.locales', 'id'), (SELECT MAX(id) FROM cierres.locales))`,
  )

  // ── Mapeo PedidosYa: Restaurant ID 517621 = Desembarco San Telmo ──
  await prisma.localPlataforma.upsert({
    where: { plataformaId_restaurantIdExterno: { plataformaId: py.id, restaurantIdExterno: '517621' } },
    update: { localId: 1, nombreExterno: 'El Desembarco San Telmo' },
    create: { localId: 1, plataformaId: py.id, restaurantIdExterno: '517621', nombreExterno: 'El Desembarco San Telmo' },
  })

  // ── Mapeo Mercado Delivery por store_id (reporte "collection") ──
  const mapeosMdStore = [
    { localId: 1, storeId: '72488709', nombre: 'El Desembarco San Telmo' },
    { localId: 5, storeId: '77378254', nombre: 'El Desembarco Microcentro' },
  ]
  for (const m of mapeosMdStore) {
    await prisma.localPlataforma.upsert({
      where: { plataformaId_restaurantIdExterno: { plataformaId: md.id, restaurantIdExterno: m.storeId } },
      update: { localId: m.localId, nombreExterno: m.nombre },
      create: { localId: m.localId, plataformaId: md.id, restaurantIdExterno: m.storeId, nombreExterno: m.nombre },
    })
  }

  // ── Mapeo Mercado Delivery por NOMBRE (reporte de Liberaciones/settlement) ──
  const mapeosNombre = [
    { localId: 1,  name: 'El Desembarco San Telmo' },
    { localId: 4,  name: 'El Desembarco Villa Urquiza' },
    { localId: 6,  name: 'El Desembarco Boedo' },
    { localId: 7,  name: 'El Desembarco Olivos' },
    { localId: 8,  name: 'El Desembarco Moron' },
    { localId: 9,  name: 'El Desembarco Ramos Mejia' },
    { localId: 10, name: 'El Desembarco Pacifico' },
    { localId: 11, name: 'El Desembarco Villa Devoto' },
    { localId: 17, name: 'El Desembarco Recoleta' },
    { localId: 2,  name: 'Mr Tasty Caballito II' },
  ]
  for (const m of mapeosNombre) {
    await prisma.localPlataforma.upsert({
      where: { plataformaId_restaurantIdExterno: { plataformaId: md.id, restaurantIdExterno: m.name } },
      update: { localId: m.localId, nombreExterno: m.name },
      create: { localId: m.localId, plataformaId: md.id, restaurantIdExterno: m.name, nombreExterno: m.name },
    })
  }

  // ── Usuarios: admin + un encargado por local (contraseña patrón <slug>1234) ──
  const adminHash = await bcrypt.hash('admin1234', 10)
  await prisma.usuario.upsert({
    where: { email: 'admin@eldesembarco.com' },
    update: {},
    create: { nombre: 'Admin', email: 'admin@eldesembarco.com', passwordHash: adminHash, rol: 'admin' },
  })

  // slug del email por local (email = <slug>@eldesembarco.com, contraseña = <slug>1234).
  const encargados: { localId: number; slug: string }[] = [
    { localId: 1,  slug: 'santelmo' },
    { localId: 2,  slug: 'caballito' },
    { localId: 3,  slug: 'nunez' },
    { localId: 4,  slug: 'villaurquiza' },
    { localId: 5,  slug: 'microcentro' },
    { localId: 6,  slug: 'boedo' },
    { localId: 7,  slug: 'olivos' },
    { localId: 8,  slug: 'moron' },
    { localId: 9,  slug: 'ramosmejia' },
    { localId: 10, slug: 'pacifico' },
    { localId: 11, slug: 'villadevoto' },
    { localId: 12, slug: 'villacrespo' },
    { localId: 13, slug: 'hurlingham' },
    { localId: 14, slug: 'nordelta' },
    { localId: 15, slug: 'pacheco' },
    { localId: 16, slug: 'quilmes' },
    { localId: 17, slug: 'recoleta' },
    { localId: 18, slug: 'florida' },
  ]
  const nombreById = new Map(locales.map((l) => [l.id, l.nombre]))
  for (const e of encargados) {
    const email = `${e.slug}@eldesembarco.com`
    const hash = await bcrypt.hash(`${e.slug}1234`, 10)
    await prisma.usuario.upsert({
      where: { email },
      // update NO toca passwordHash: no pisa una contraseña ya seteada/cambiada.
      update: { localId: e.localId, rol: 'encargado', activo: true },
      create: { nombre: `Encargado ${nombreById.get(e.localId)}`, email, passwordHash: hash, rol: 'encargado', localId: e.localId },
    })
  }

  console.log('Seed OK — 18 locales (16 Desembarco + 2 Mr Tasty), 18 encargados + admin')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
