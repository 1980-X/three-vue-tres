import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { requireMember } from '../lib/auth-context.js';
import { requireProjectRole } from '../lib/rbac.js';
import { writeAudit } from '../lib/audit.js';

const roleSchema = z.nativeEnum(ProjectRole);

export async function projectRoutes(app: FastifyInstance) {
  app.get('/api/projects', async (req) => {
    const user = requireMember(req);
    const links = await prisma.projectMember.findMany({
      where: { memberId: user.memberId, project: { tenantId: user.tenantId } },
      include: { project: true },
      orderBy: { project: { createdAt: 'desc' } },
    });
    return {
      items: links.map((l) => ({
        id: l.project.id,
        name: l.project.name,
        role: l.role,
        createdAt: l.project.createdAt,
      })),
      total: links.length,
    };
  });

  app.post('/api/projects', async (req) => {
    const user = requireMember(req);
    if (!user.isTenantOwner) {
      throw new AppError('forbidden', '仅租户拥有者可创建项目', 403);
    }
    const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '项目名称不合法', 400);
    }
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: { tenantId: user.tenantId, name: parsed.data.name },
      });
      await tx.projectMember.create({
        data: {
          projectId: p.id,
          memberId: user.memberId,
          role: 'owner',
        },
      });
      return p;
    });
    return project;
  });

  app.get('/api/projects/:projectId', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    const { project, role } = await requireProjectRole(
      user.memberId,
      user.tenantId,
      projectId,
      'viewer',
    );
    return { ...project, role };
  });

  app.patch('/api/projects/:projectId', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'admin');
    const parsed = z.object({ name: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '项目名称不合法', 400);
    }
    return prisma.project.update({
      where: { id: projectId },
      data: { name: parsed.data.name },
    });
  });

  app.delete('/api/projects/:projectId', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'admin');
    await prisma.project.delete({ where: { id: projectId } });
    return { ok: true };
  });

  app.get('/api/projects/:projectId/members', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'viewer');
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        member: {
          select: {
            id: true,
            email: true,
            displayName: true,
            isTenantOwner: true,
          },
        },
      },
    });
    return {
      items: members.map((m) => ({
        memberId: m.memberId,
        role: m.role,
        email: m.member.email,
        displayName: m.member.displayName,
      })),
      total: members.length,
    };
  });

  app.post('/api/projects/:projectId/members', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'admin');
    const parsed = z
      .object({
        email: z.string().email(),
        role: roleSchema,
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '成员参数不合法', 400);
    }
    const target = await prisma.member.findUnique({
      where: {
        tenantId_email: { tenantId: user.tenantId, email: parsed.data.email },
      },
    });
    if (!target) {
      throw new AppError('not_found', '成员不存在于本租户', 404);
    }
    const link = await prisma.projectMember.create({
      data: {
        projectId,
        memberId: target.id,
        role: parsed.data.role,
      },
    });
    await writeAudit({
      tenantId: user.tenantId,
      actorType: 'member',
      actorId: user.memberId,
      action: 'project_member.add',
      resourceType: 'project_member',
      resourceId: link.id,
      metaJson: { projectId, memberId: target.id, role: parsed.data.role },
    });
    return link;
  });

  app.patch('/api/projects/:projectId/members/:memberId', async (req) => {
    const user = requireMember(req);
    const { projectId, memberId } = req.params as {
      projectId: string;
      memberId: string;
    };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'admin');
    const parsed = z.object({ role: roleSchema }).safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '角色不合法', 400);
    }
    const link = await prisma.projectMember.findUnique({
      where: { projectId_memberId: { projectId, memberId } },
    });
    if (!link) throw new AppError('not_found', '项目成员不存在', 404);
    const updated = await prisma.projectMember.update({
      where: { id: link.id },
      data: { role: parsed.data.role },
    });
    await writeAudit({
      tenantId: user.tenantId,
      actorType: 'member',
      action: 'project_member.role_change',
      actorId: user.memberId,
      resourceType: 'project_member',
      resourceId: link.id,
      metaJson: {
        projectId,
        memberId,
        from: link.role,
        to: parsed.data.role,
      },
    });
    return updated;
  });

  app.delete('/api/projects/:projectId/members/:memberId', async (req) => {
    const user = requireMember(req);
    const { projectId, memberId } = req.params as {
      projectId: string;
      memberId: string;
    };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'admin');
    await prisma.projectMember.delete({
      where: { projectId_memberId: { projectId, memberId } },
    });
    await writeAudit({
      tenantId: user.tenantId,
      actorType: 'member',
      actorId: user.memberId,
      action: 'project_member.remove',
      resourceType: 'project_member',
      resourceId: `${projectId}:${memberId}`,
    });
    return { ok: true };
  });
}
