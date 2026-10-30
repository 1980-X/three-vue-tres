import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { buildApp } from '../src/app.js';

export const TEST_ORIGIN = process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:18700';

export async function makeApp() {
  return buildApp({ logger: false });
}

export function csrfHeaders(extra: Record<string, string> = {}) {
  return {
    origin: TEST_ORIGIN,
    'content-type': 'application/json',
    ...extra,
  };
}

export async function resetDb() {
  await prisma.hotspot.deleteMany();
  await prisma.tour.deleteMany();
  await prisma.venueTrack.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.member.deleteMany();
  await prisma.platformAdmin.deleteMany();
  await prisma.tenant.deleteMany();
}

export async function seedProjectWithOwner() {
  const seed = await seedTenantWithOwner();
  const project = await prisma.project.create({
    data: {
      tenantId: seed.tenant.id,
      name: 'P1',
      members: {
        create: { memberId: seed.owner.id, role: 'owner' },
      },
    },
  });
  return { ...seed, project };
}

export async function seedPlatformAdmin(
  email = 'root@example.com',
  password = 'password123',
) {
  return prisma.platformAdmin.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
    },
  });
}

export async function seedTenantWithOwner(opts?: {
  slug?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}) {
  const slug = opts?.slug ?? 'acme';
  const ownerEmail = opts?.ownerEmail ?? 'owner@acme.test';
  const ownerPassword = opts?.ownerPassword ?? 'password123';
  const passwordHash = await hashPassword(ownerPassword);
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Acme',
      slug,
      members: {
        create: {
          email: ownerEmail,
          passwordHash,
          displayName: 'Owner',
          isTenantOwner: true,
        },
      },
    },
    include: { members: true },
  });
  const owner = tenant.members[0]!;
  return { tenant, owner, ownerPassword };
}

export function cookieFrom(res: { headers: Record<string, unknown> }) {
  const raw = res.headers['set-cookie'];
  if (!raw) return '';
  const first = Array.isArray(raw) ? raw[0] : String(raw);
  return first.split(';')[0];
}
