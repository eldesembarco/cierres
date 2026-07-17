// Seed de producción: catálogos + usuario admin. La nómina real se importa
// después desde el Sheet "Headcount 06.2026" (script aparte).
// Correr con: npm run db:seed  (requiere DATABASE_URL y ADMIN_PASSWORD en .env)
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Marcas
  for (const m of [
    { nombre: 'Desembarco', color: '#e8590c' },
    { nombre: 'Mr. Tasty', color: '#e0a100' },
    { nombre: 'Mila & Go', color: '#2f9e44' },
  ]) {
    await prisma.marca.upsert({ where: { nombre: m.nombre }, create: m, update: { color: m.color } })
  }

  // Empresas (completar CUITs reales después)
  for (const nombre of ['Cloud Managment Capital SRL']) {
    await prisma.empresa.upsert({ where: { nombre }, create: { nombre }, update: {} })
  }

  // Departamentos
  for (const nombre of ['Locales Propios', 'Administración', 'Operaciones', 'Marketing', 'RRHH']) {
    await prisma.departamento.upsert({ where: { nombre }, create: { nombre }, update: {} })
  }

  // Tipos de documento
  const tipos = [
    { nombre: 'DNI', requiereVencimiento: false },
    { nombre: 'Alta temprana ARCA', requiereVencimiento: false },
    { nombre: 'Carnet de manipulación de alimentos', requiereVencimiento: true },
    { nombre: 'Licencia de conducir', requiereVencimiento: true },
    { nombre: 'Certificado médico preocupacional', requiereVencimiento: false },
    { nombre: 'Constancia de CBU', requiereVencimiento: false },
    { nombre: 'Libreta sanitaria', requiereVencimiento: true },
  ]
  for (const t of tipos) {
    await prisma.documentoTipo.upsert({ where: { nombre: t.nombre }, create: t, update: {} })
  }

  // Posiciones con reglas de documentación
  const deptos = Object.fromEntries((await prisma.departamento.findMany()).map(d => [d.nombre, d.id]))
  const tiposDb = Object.fromEntries((await prisma.documentoTipo.findMany()).map(t => [t.nombre, t.id]))
  const posiciones: { nombre: string; depto: string; convenio: string; docs: string[] }[] = [
    { nombre: 'Encargado/a de Local', depto: 'Locales Propios', convenio: 'UTHGRA', docs: ['DNI', 'Alta temprana ARCA', 'Carnet de manipulación de alimentos', 'Libreta sanitaria'] },
    { nombre: 'Cajero/a', depto: 'Locales Propios', convenio: 'UTHGRA', docs: ['DNI', 'Alta temprana ARCA', 'Carnet de manipulación de alimentos'] },
    { nombre: 'Cocinero/a', depto: 'Locales Propios', convenio: 'UTHGRA', docs: ['DNI', 'Alta temprana ARCA', 'Carnet de manipulación de alimentos', 'Libreta sanitaria'] },
    { nombre: 'Parrillero/a', depto: 'Locales Propios', convenio: 'UTHGRA', docs: ['DNI', 'Alta temprana ARCA', 'Carnet de manipulación de alimentos', 'Libreta sanitaria'] },
    { nombre: 'Runner', depto: 'Locales Propios', convenio: 'UTHGRA', docs: ['DNI', 'Alta temprana ARCA', 'Carnet de manipulación de alimentos'] },
    { nombre: 'Chofer de Reparto', depto: 'Operaciones', convenio: 'UTHGRA', docs: ['DNI', 'Alta temprana ARCA', 'Licencia de conducir'] },
    { nombre: 'Supervisor/a de Zona', depto: 'Operaciones', convenio: 'Fuera de convenio', docs: ['DNI', 'Alta temprana ARCA'] },
    { nombre: 'Administrativo/a', depto: 'Administración', convenio: 'Fuera de convenio', docs: ['DNI', 'Alta temprana ARCA'] },
  ]
  for (const p of posiciones) {
    const pos = await prisma.posicion.upsert({
      where: { nombre: p.nombre },
      create: { nombre: p.nombre, departamentoId: deptos[p.depto], convenio: p.convenio },
      update: {},
    })
    for (const doc of p.docs) {
      await prisma.posicionDocumento.upsert({
        where: { posicionId_documentoTipoId: { posicionId: pos.id, documentoTipoId: tiposDb[doc]! } },
        create: { posicionId: pos.id, documentoTipoId: tiposDb[doc]! },
        update: {},
      })
    }
  }

  // Usuario admin
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminPassword) {
    await prisma.usuario.upsert({
      where: { email: 'polejavetzky@eldesembarco.com' },
      create: {
        email: 'polejavetzky@eldesembarco.com',
        nombre: 'Pablo Olejavetzky',
        passwordHash: await bcrypt.hash(adminPassword, 10),
        rol: 'ADMIN',
      },
      update: {},
    })
    console.log('Usuario admin listo: polejavetzky@eldesembarco.com')
  } else {
    console.log('ADMIN_PASSWORD no seteada: no se creó usuario admin')
  }

  console.log('Seed OK')
}

main().finally(() => prisma.$disconnect())
