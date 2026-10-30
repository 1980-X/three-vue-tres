import type { ProjectRole } from '@prisma/client';
import { AppError } from './errors.js';
import { prisma } from './prisma.js';

export const roleAtLeast: Record<ProjectRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function assertRole(have: ProjectRole, need: ProjectRole) {
  if (roleAtLeast[have] < roleAtLeast[need]) {
    throw new AppError('forbidden', '权限不足', 403);
  }
}

export async function requireProjectRole(
  memberId: string,
  tenantId: string,
  projectId: string,
  need: ProjectRole,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new AppError('not_found', '项目不存在', 404);
  }
  if (project.tenantId !== tenantId) {
    throw new AppError('forbidden', '无权访问该项目', 403);
  }
  const link = await prisma.projectMember.findUnique({
    where: {
      projectId_memberId: { projectId, memberId },
    },
  });
  if (!link) {
    throw new AppError('forbidden', '无权访问该项目', 403);
  }
  assertRole(link.role, need);
  return { project, role: link.role };
}
