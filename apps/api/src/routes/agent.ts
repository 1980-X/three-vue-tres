import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireMember } from '../lib/auth-context.js';
import { requireProjectRole } from '../lib/rbac.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { getStorage } from '../storage/index.js';
import { runAgentTurn } from '../agent/runtime.js';

const createSessionSchema = z.object({
  llmProviderId: z.string().uuid(),
  model: z.string().min(1).optional(),
});

const messageSchema = z.object({
  text: z.string().min(1).max(8000),
});

export async function agentRoutes(app: FastifyInstance) {
  app.post('/api/projects/:projectId/agent/sessions', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'editor');
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '会话参数不合法', 400);
    }
    const provider = await prisma.aiProviderConfig.findFirst({
      where: {
        id: parsed.data.llmProviderId,
        kind: 'llm',
        enabled: true,
      },
    });
    if (!provider) {
      throw new AppError('not_found', 'LLM 配置不存在或未启用', 404);
    }
    const models = Array.isArray(provider.modelsJson)
      ? (provider.modelsJson as string[])
      : [];
    const model = parsed.data.model ?? models[0] ?? 'default';
    const session = await prisma.agentSession.create({
      data: {
        tenantId: user.tenantId,
        projectId,
        llmProviderId: provider.id,
        model,
        createdByMemberId: user.memberId,
      },
    });
    return { id: session.id, model: session.model, llmProviderId: session.llmProviderId };
  });

  app.post('/api/projects/:projectId/agent/sessions/:sessionId/messages', async (req, reply) => {
    const user = requireMember(req);
    const { projectId, sessionId } = req.params as {
      projectId: string;
      sessionId: string;
    };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'editor');
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '消息不合法', 400);
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const end = () => {
      try {
        reply.raw.end();
      } catch {
        /* ignore */
      }
    };

    await runAgentTurn({
      sessionId,
      userText: parsed.data.text,
      ctx: {
        tenantId: user.tenantId,
        projectId,
        sessionId,
        memberId: user.memberId,
      },
      sse: { write, end },
    });
  });

  app.get('/api/projects/:projectId/agent/tmp-preview', async (req, reply) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'viewer');
    const key = String((req.query as { key?: string }).key ?? '');
    if (!key.startsWith('tmp/agent/')) {
      throw new AppError('forbidden', '非法预览键', 403);
    }
    try {
      const buf = await getStorage().get(key);
      return reply
        .header('Content-Type', 'model/gltf-binary')
        .header('Cache-Control', 'private, max-age=60')
        .send(buf);
    } catch {
      throw new AppError('not_found', '临时文件不存在', 404);
    }
  });
}
