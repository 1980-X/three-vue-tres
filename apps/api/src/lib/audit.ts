import type { ActorType, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export async function writeAudit(input: {
  tenantId?: string | null;
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metaJson?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metaJson: input.metaJson ?? {},
    },
  });
}
