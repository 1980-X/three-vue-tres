import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createSession, deleteSessionByRaw, COOKIE } from '../lib/session.js';
import { writeAudit } from '../lib/audit.js';
import {
  clearSessionCookie,
  loadSession,
  setSessionCookie,
} from '../lib/auth-context.js';
import { assertCsrf } from '../lib/csrf.js';

const memberLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

const platformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  await app.register(async (scoped) => {
    const rateLimit = (await import('@fastify/rate-limit')).default;
    await scoped.register(rateLimit, {
      max: Number(process.env.LOGIN_RATE_LIMIT_MAX ?? 20),
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message: '尝试过于频繁，请稍后再试',
      }),
    });

    scoped.post('/auth/login', async (req, reply) => {
      assertCsrf(req);
      const parsed = memberLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('validation_error', '登录参数不合法', 400);
      }
      const { email, password, tenantSlug } = parsed.data;
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant || tenant.status !== 'active') {
        await writeAudit({
          actorType: 'system',
          action: 'auth.login_failed',
          resourceType: 'member',
          resourceId: email,
          metaJson: { reason: 'tenant' },
        });
        throw new AppError('unauthorized', '邮箱或密码错误', 401);
      }
      const member = await prisma.member.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
      });
      if (!member || !(await verifyPassword(member.passwordHash, password))) {
        await writeAudit({
          tenantId: tenant.id,
          actorType: 'system',
          action: 'auth.login_failed',
          resourceType: 'member',
          resourceId: email,
          metaJson: { reason: 'credentials' },
        });
        throw new AppError('unauthorized', '邮箱或密码错误', 401);
      }
      const raw = await createSession({ memberId: member.id });
      setSessionCookie(reply, raw);
      return {
        kind: 'member' as const,
        memberId: member.id,
        tenantId: member.tenantId,
        email: member.email,
        displayName: member.displayName,
      };
    });

    scoped.post('/auth/platform/login', async (req, reply) => {
      assertCsrf(req);
      const parsed = platformLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('validation_error', '登录参数不合法', 400);
      }
      const { email, password } = parsed.data;
      const admin = await prisma.platformAdmin.findUnique({ where: { email } });
      if (!admin || !(await verifyPassword(admin.passwordHash, password))) {
        await writeAudit({
          actorType: 'system',
          action: 'auth.login_failed',
          resourceType: 'platform_admin',
          resourceId: email,
        });
        throw new AppError('unauthorized', '邮箱或密码错误', 401);
      }
      const raw = await createSession({ platformAdminId: admin.id });
      setSessionCookie(reply, raw);
      return { kind: 'platform_admin' as const, email: admin.email };
    });
  });

  app.post('/auth/logout', async (req, reply) => {
    assertCsrf(req);
    const raw = req.cookies?.[COOKIE];
    if (raw) await deleteSessionByRaw(raw);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', async (req) => {
    await loadSession(req);
    if (!req.authUser) {
      throw new AppError('unauthorized', '请先登录', 401);
    }
    if (req.authUser.kind === 'platform_admin') {
      return {
        kind: 'platform_admin',
        email: req.authUser.email,
        platformAdminId: req.authUser.platformAdminId,
      };
    }
    const projects = await prisma.projectMember.findMany({
      where: { memberId: req.authUser.memberId },
      include: { project: true },
    });
    return {
      kind: 'member',
      memberId: req.authUser.memberId,
      tenantId: req.authUser.tenantId,
      email: req.authUser.email,
      displayName: req.authUser.displayName,
      isTenantOwner: req.authUser.isTenantOwner,
      projects: projects.map((p) => ({
        id: p.project.id,
        name: p.project.name,
        role: p.role,
      })),
    };
  });
}

// re-export hash for tests/seed
export { hashPassword };
