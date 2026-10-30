import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

export const COOKIE = process.env.SESSION_COOKIE_NAME ?? 'dtv_session';
export const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function createSession(input: {
  memberId?: string;
  platformAdminId?: string;
}) {
  const raw = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: hashToken(raw),
      memberId: input.memberId,
      platformAdminId: input.platformAdminId,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return raw;
}

export async function deleteSessionByRaw(raw: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(raw) } });
}

export async function findSessionByRaw(raw: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: {
      member: { include: { tenant: true } },
      platformAdmin: true,
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  await prisma.session.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() + TTL_MS) },
  });
  return session;
}
