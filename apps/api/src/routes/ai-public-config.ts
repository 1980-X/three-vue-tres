import type { FastifyInstance } from 'fastify';
import { requireMember } from '../lib/auth-context.js';
import { prisma } from '../lib/prisma.js';

/** 项目成员可读已启用 LLM 列表（无密钥） */
export async function aiPublicConfigRoutes(app: FastifyInstance) {
  app.get('/api/ai/llm-providers', async (req) => {
    requireMember(req);
    const rows = await prisma.aiProviderConfig.findMany({
      where: { kind: 'llm', enabled: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        vendor: r.vendor,
        models: Array.isArray(r.modelsJson) ? r.modelsJson : [],
        isDefault: r.isDefault,
      })),
    };
  });
}
