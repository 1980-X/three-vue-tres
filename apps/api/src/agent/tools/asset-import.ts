import { createHash, randomUUID } from 'node:crypto';
import { AssetKind } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getStorage } from '../../storage/index.js';
import type { AgentTool } from './types.js';

const Args = z.object({
  glbTempKey: z.string().min(1),
  title: z.string().min(1).max(200).default('AI GLB'),
});

export const assetImportTool: AgentTool = {
  name: 'asset_import',
  description: '将临时 GLB 入库为项目 Asset（kind=model_glb）',
  parameters: {
    type: 'object',
    properties: {
      glbTempKey: { type: 'string' },
      title: { type: 'string' },
    },
    required: ['glbTempKey'],
  },
  async execute(raw, ctx) {
    const parsed = Args.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('validation_error', 'asset_import 参数不合法', 400);
    }
    if (!parsed.data.glbTempKey.startsWith('tmp/agent/')) {
      throw new AppError('forbidden', '非法临时键', 403);
    }
    const storage = getStorage();
    const buf = await storage.get(parsed.data.glbTempKey);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const storageKey = `tenants/${ctx.tenantId}/projects/${ctx.projectId}/${randomUUID()}.glb`;
    await storage.put(storageKey, buf, 'model/gltf-binary');
    const asset = await prisma.asset.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: ctx.projectId,
        kind: AssetKind.model_glb,
        title: parsed.data.title,
        storageKey,
        mime: 'model/gltf-binary',
        byteSize: BigInt(buf.length),
        sha256,
      },
    });
    return { assetId: asset.id, storageKey: asset.storageKey };
  },
};
