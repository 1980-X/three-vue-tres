import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requirePlatformAdmin } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { writeAudit } from '../lib/audit.js';
import { chatWithTools } from '../llm/gateway.js';
import {
  createProvider,
  deleteProvider,
  getDecryptedProvider,
  listProviders,
  updateProvider,
} from '../llm/registry.js';

const createSchema = z.object({
  kind: z.enum(['llm', 'mesh']),
  vendor: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  models: z.array(z.string()).default([]),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  models: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  vendor: z.string().min(1).optional(),
});

export async function platformAiRoutes(app: FastifyInstance) {
  app.get('/platform/ai/providers', async (req) => {
    requirePlatformAdmin(req);
    const q = req.query as { kind?: string };
    const kind =
      q.kind === 'llm' || q.kind === 'mesh' ? q.kind : undefined;
    return { items: await listProviders(kind) };
  });

  app.post('/platform/ai/providers', async (req) => {
    const admin = requirePlatformAdmin(req);
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '配置参数不合法', 400);
    }
    const item = await createProvider(parsed.data);
    await writeAudit({
      actorType: 'platform_admin',
      actorId: admin.platformAdminId,
      action: 'ai.provider_create',
      resourceType: 'ai_provider',
      resourceId: item.id,
      metaJson: { kind: item.kind, vendor: item.vendor },
    });
    return item;
  });

  app.patch('/platform/ai/providers/:id', async (req) => {
    const admin = requirePlatformAdmin(req);
    const { id } = req.params as { id: string };
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '配置参数不合法', 400);
    }
    const item = await updateProvider(id, parsed.data);
    await writeAudit({
      actorType: 'platform_admin',
      actorId: admin.platformAdminId,
      action: 'ai.provider_update',
      resourceType: 'ai_provider',
      resourceId: id,
    });
    return item;
  });

  app.delete('/platform/ai/providers/:id', async (req) => {
    const admin = requirePlatformAdmin(req);
    const { id } = req.params as { id: string };
    await deleteProvider(id);
    await writeAudit({
      actorType: 'platform_admin',
      actorId: admin.platformAdminId,
      action: 'ai.provider_delete',
      resourceType: 'ai_provider',
      resourceId: id,
    });
    return { ok: true };
  });

  app.post('/platform/ai/providers/:id/probe', async (req) => {
    requirePlatformAdmin(req);
    const { id } = req.params as { id: string };
    const { row, apiKey, models } = await getDecryptedProvider(id);
    if (row.kind === 'mesh') {
      if (process.env.MOCK_MESH === '1') {
        return { ok: true, detail: 'MOCK_MESH 已启用' };
      }
      return { ok: true, detail: 'mesh 连通检查一期仅校验配置存在' };
    }
    try {
      const model = models[0] ?? 'mock';
      await chatWithTools({
        baseUrl: row.baseUrl,
        apiKey,
        model,
        messages: [{ role: 'user', content: 'ping' }],
        tools: [],
      });
      return { ok: true, detail: '连通正常' };
    } catch {
      throw new AppError('provider_error', '上游连通失败，请检查 baseUrl / Key / 模型', 502);
    }
  });
}
