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
  // Marcas
  const desembarco = await prisma.marca.upsert({
    where: { nombre: 'Desembarco' }, update: {}, create: { nombre: 'Desembarco' },
  })
  await prisma.marca.upsert({ where: { nombre: 'Mila & Go' }, update: {}, create: { nombre: 'Mila & Go' } })
  await prisma.marca.upsert({ where: { nombre: 'Mr Tasty' }, update: {}, create: { nombre: 'Mr Tasty' } })

  // Plataformas
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

  // Local piloto: Desembarco San Telmo
  const sanTelmo = await prisma.local.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombre: 'Desembarco San Telmo',
      marcaId: desembarco.id,
      ciudad: 'CABA',
      fondoFijoDefault: 500000,
    },
  })

  // Mapeo PedidosYa: Restaurant ID 517621 = Desembarco San Telmo
  await prisma.localPlataforma.upsert({
    where: { plataformaId_restaurantIdExterno: { plataformaId: py.id, restaurantIdExterno: '517621' } },
    update: {},
    create: {
      localId: sanTelmo.id,
      plataformaId: py.id,
      restaurantIdExterno: '517621',
      nombreExterno: 'El Desembarco San Telmo',
    },
  })

  // Local Desembarco Microcentro (aparece en el reporte de Mercado Pago).
  const microcentro = await prisma.local.upsert({
    where: { id: 5 },
    update: {},
    create: { id: 5, nombre: 'Desembarco Microcentro', marcaId: desembarco.id, ciudad: 'CABA', fondoFijoDefault: 500000 },
  })

  // Mapeo Mercado Delivery (Mercado Pago store_id → local). El reporte "collection"
  // identifica el local por store_id; lo mapeamos a mano (no es derivable del nombre).
  const mapeosMd = [
    { localId: sanTelmo.id, storeId: '72488709', nombre: 'El Desembarco San Telmo' },
    { localId: microcentro.id, storeId: '77378254', nombre: 'El Desembarco Microcentro' },
  ]
  for (const m of mapeosMd) {
    await prisma.localPlataforma.upsert({
      where: { plataformaId_restaurantIdExterno: { plataformaId: md.id, restaurantIdExterno: m.storeId } },
      update: { localId: m.localId, nombreExterno: m.nombre },
      create: { localId: m.localId, plataformaId: md.id, restaurantIdExterno: m.storeId, nombreExterno: m.nombre },
    })
  }

  // Locales propios que aparecen en los reportes de Liberaciones de Mercado Pago.
  // (El reporte de settlement identifica el local por NOMBRE, no por store_id.)
  const propios = [
    { id: 6, nombre: 'Desembarco Boedo' },
    { id: 7, nombre: 'Desembarco Olivos' },
    { id: 8, nombre: 'Desembarco Morón' },
    { id: 9, nombre: 'Desembarco Ramos Mejía' },
    { id: 10, nombre: 'Desembarco Pacífico' },
    { id: 11, nombre: 'Desembarco Villa Devoto' },
    { id: 4, nombre: 'Desembarco Villa Urquiza' }, // ya existe; se deja consistente
  ]
  for (const p of propios) {
    await prisma.local.upsert({
      where: { id: p.id },
      update: {},
      create: { id: p.id, nombre: p.nombre, marcaId: desembarco.id, ciudad: 'CABA', fondoFijoDefault: 300000 },
    })
  }

  // Mapeo Mercado Delivery por NOMBRE (como viene en el reporte de Liberaciones).
  const mapeosNombre = [
    { localId: 1, name: 'El Desembarco San Telmo' },
    { localId: 4, name: 'El Desembarco Villa Urquiza' },
    { localId: 6, name: 'El Desembarco Boedo' },
    { localId: 7, name: 'El Desembarco Olivos' },
    { localId: 8, name: 'El Desembarco Moron' },
    { localId: 9, name: 'El Desembarco Ramos Mejia' },
    { localId: 10, name: 'El Desembarco Pacifico' },
    { localId: 11, name: 'El Desembarco Villa Devoto' },
  ]
  for (const m of mapeosNombre) {
    await prisma.localPlataforma.upsert({
      where: { plataformaId_restaurantIdExterno: { plataformaId: md.id, restaurantIdExterno: m.name } },
      update: { localId: m.localId, nombreExterno: m.name },
      create: { localId: m.localId, plataformaId: md.id, restaurantIdExterno: m.name, nombreExterno: m.name },
    })
  }

  // Usuarios
  const adminHash = await bcrypt.hash('admin1234', 10)
  const encHash = await bcrypt.hash('santelmo1234', 10)
  await prisma.usuario.upsert({
    where: { email: 'admin@eldesembarco.com' },
    update: {},
    create: { nombre: 'Admin', email: 'admin@eldesembarco.com', passwordHash: adminHash, rol: 'admin' },
  })
  await prisma.usuario.upsert({
    where: { email: 'santelmo@eldesembarco.com' },
    update: {},
    create: { nombre: 'Encargado San Telmo', email: 'santelmo@eldesembarco.com', passwordHash: encHash, rol: 'encargado', localId: sanTelmo.id },
  })

  console.log('Seed OK')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
