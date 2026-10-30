import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { requirePlatformAdmin } from '../lib/auth-context.js';
import { writeAudit } from '../lib/audit.js';

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerDisplayName: z.string().min(1),
});

export async function platformRoutes(app: FastifyInstance) {
  app.get('/platform/tenants', async (req) => {
    requirePlatformAdmin(req);
    const page = Math.max(1, Number((req.query as { page?: string }).page ?? 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number((req.query as { pageSize?: string }).pageSize ?? 20)),
    );
    const [total, items] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  });

  app.post('/platform/tenants', async (req) => {
    const admin = requirePlatformAdmin(req);
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '代建参数不合法', 400);
    }
    const data = parsed.data;
    const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new AppError('conflict', '租户 slug 已存在', 409);
    }
    const passwordHash = await hashPassword(data.ownerPassword);
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: data.name, slug: data.slug },
      });
      const owner = await tx.member.create({
        data: {
          tenantId: tenant.id,
          email: data.ownerEmail,
          passwordHash,
          displayName: data.ownerDisplayName,
          isTenantOwner: true,
        },
      });
      return { tenant, owner };
    });
    await writeAudit({
      tenantId: result.tenant.id,
      actorType: 'platform_admin',
      actorId: admin.platformAdminId,
      action: 'tenant.create',
      resourceType: 'tenant',
      resourceId: result.tenant.id,
      metaJson: { slug: data.slug, ownerEmail: data.ownerEmail },
    });
    return {
      id: result.tenant.id,
      name: result.tenant.name,
      slug: result.tenant.slug,
      status: result.tenant.status,
      owner: {
        id: result.owner.id,
        email: result.owner.email,
        displayName: result.owner.displayName,
      },
    };
  });

  app.patch('/platform/tenants/:id', async (req) => {
    const admin = requirePlatformAdmin(req);
    const { id } = req.params as { id: string };
    const body = z
      .object({
        name: z.string().min(1).optional(),
        status: z.enum(['active', 'disabled']).optional(),
      })
      .safeParse(req.body);
    if (!body.success) {
      throw new AppError('validation_error', '更新参数不合法', 400);
    }
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new AppError('not_found', '租户不存在', 404);
    const updated = await prisma.tenant.update({
      where: { id },
      data: body.data,
    });
    await writeAudit({
      tenantId: id,
      actorType: 'platform_admin',
      actorId: admin.platformAdminId,
      action: 'tenant.update',
      resourceType: 'tenant',
      resourceId: id,
      metaJson: body.data,
    });
    return updated;
  });
}
