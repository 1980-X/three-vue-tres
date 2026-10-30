import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const email = process.env.SEED_PLATFORM_EMAIL ?? 'root@example.com';
const password = process.env.SEED_PLATFORM_PASSWORD ?? 'password123';

const existing = await prisma.platformAdmin.findUnique({ where: { email } });
if (!existing) {
  await prisma.platformAdmin.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });
  console.log('seeded platform admin', email);
} else {
  console.log('platform admin already exists', email);
}
await prisma.$disconnect();
