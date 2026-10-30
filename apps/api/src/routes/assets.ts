import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { AssetKind } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { requireMember } from '../lib/auth-context.js';
import { requireProjectRole } from '../lib/rbac.js';
import { getStorage } from '../storage/index.js';

const kindSchema = z.nativeEnum(AssetKind);

function serializeAsset(a: {
  id: string;
  tenantId: string;
  projectId: string;
  kind: AssetKind;
  title: string;
  storageKey: string;
  mime: string;
  byteSize: bigint;
  sha256: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    tenantId: a.tenantId,
    projectId: a.projectId,
    kind: a.kind,
    title: a.title,
    storageKey: a.storageKey,
    mime: a.mime,
    byteSize: a.byteSize.toString(),
    sha256: a.sha256,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export async function assetRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: 200 * 1024 * 1024 },
  });

  app.get('/api/projects/:projectId/assets', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'viewer');
    const q = req.query as { page?: string; pageSize?: string; kind?: string };
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize ?? 20)));
    const kind = q.kind ? kindSchema.parse(q.kind) : undefined;
    const where = {
      projectId,
      tenantId: user.tenantId,
      ...(kind ? { kind } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: items.map(serializeAsset), total, page, pageSize };
  });

  app.post('/api/projects/:projectId/assets', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'editor');

    const file = await req.file();
    if (!file) throw new AppError('validation_error', '缺少上传文件', 400);

    const fields = file.fields as Record<
      string,
      { value?: string } | undefined
    >;
    const title =
      (typeof fields.title?.value === 'string' && fields.title.value) ||
      file.filename ||
      '未命名资产';
    const kindRaw =
      (typeof fields.kind?.value === 'string' && fields.kind.value) || 'other';
    const kindParsed = kindSchema.safeParse(kindRaw);
    if (!kindParsed.success) {
      throw new AppError('validation_error', '资产类型不合法', 400);
    }

    const buf = await file.toBuffer();
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `tenants/${user.tenantId}/projects/${projectId}/${randomUUID()}-${safeName}`;
    const storage = getStorage();
    await storage.put(storageKey, buf, file.mimetype);

    try {
      const asset = await prisma.asset.create({
        data: {
          tenantId: user.tenantId,
          projectId,
          kind: kindParsed.data,
          title,
          storageKey,
          mime: file.mimetype || 'application/octet-stream',
          byteSize: BigInt(buf.length),
          sha256,
        },
      });
      return serializeAsset(asset);
    } catch (err) {
      await storage.delete(storageKey);
      throw err;
    }
  });

  app.get('/api/projects/:projectId/assets/:assetId', async (req) => {
    const user = requireMember(req);
    const { projectId, assetId } = req.params as {
      projectId: string;
      assetId: string;
    };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'viewer');
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, projectId, tenantId: user.tenantId },
    });
    if (!asset) throw new AppError('not_found', '资产不存在', 404);
    return serializeAsset(asset);
  });

  app.delete('/api/projects/:projectId/assets/:assetId', async (req) => {
    const user = requireMember(req);
    const { projectId, assetId } = req.params as {
      projectId: string;
      assetId: string;
    };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'editor');
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, projectId, tenantId: user.tenantId },
    });
    if (!asset) throw new AppError('not_found', '资产不存在', 404);
    const storage = getStorage();
    await storage.delete(asset.storageKey);
    await prisma.asset.delete({ where: { id: asset.id } });
    return { ok: true };
  });

  app.post('/api/projects/:projectId/assets/presign', async (req) => {
    requireMember(req);
    throw new AppError('internal_error', '预签名上传一期未实现', 501);
  });
}
