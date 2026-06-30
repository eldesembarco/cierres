/**
 * Seed inicial de users del panel.
 * Correr con: `npm run seed:users`
 *
 * Edita los users de abajo antes de correr.
 * Cambia las passwords default por algo serio antes de producción.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_USERS = [
  {
    username: 'matias',
    name: 'Matías Ferrario',
    password: 'lucia2026',
    role: 'ADMIN' as const,
  },
  {
    username: 'pablo',
    name: 'Pablo Olejavetzky',
    password: 'lucia2026',
    role: 'ADMIN' as const,
  },
  {
    username: 'cm',
    name: 'Community Manager',
    password: 'lucia2026',
    role: 'CM' as const,
  },
];

async function main() {
  console.log('Seeding users…');
  for (const u of SEED_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) {
      // Update password hash si ya existe (útil para resetear)
      await prisma.user.update({
        where: { username: u.username },
        data: { password: hash, name: u.name, role: u.role },
      });
      console.log(`  ✓ Updated ${u.username}`);
    } else {
      await prisma.user.create({
        data: {
          username: u.username,
          name: u.name,
          password: hash,
          role: u.role,
        },
      });
      console.log(`  ✓ Created ${u.username}`);
    }
  }
  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
