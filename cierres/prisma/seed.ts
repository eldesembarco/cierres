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
    { nombre: 'Uber', codigo: 'UE' },
  ]
  for (const p of plataformas) {
    await prisma.plataforma.upsert({ where: { codigo: p.codigo }, update: {}, create: p })
  }
  const py = await prisma.plataforma.findUniqueOrThrow({ where: { codigo: 'PY' } })

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
