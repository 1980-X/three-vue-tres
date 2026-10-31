import { prisma } from '../lib/prisma.js';
import { getDecryptedProvider } from '../llm/registry.js';
import { chatWithTools } from '../llm/gateway.js';
import type { ChatMessage } from '../llm/types.js';
import { executeTool, listToolSpecs } from './tools/registry.js';
import type { ToolContext } from './tools/types.js';
import { AppError } from '../lib/errors.js';

export type SseWriter = {
  write: (event: string, data: unknown) => void;
  end: () => void;
};

const MAX_STEPS = 8;

export async function runAgentTurn(input: {
  sessionId: string;
  userText: string;
  ctx: ToolContext;
  sse: SseWriter;
}) {
  const session = await prisma.agentSession.findUnique({
    where: { id: input.sessionId },
  });
  if (!session) throw new AppError('not_found', '会话不存在', 404);
  if (
    session.tenantId !== input.ctx.tenantId ||
    session.projectId !== input.ctx.projectId
  ) {
    throw new AppError('forbidden', '无权访问该会话', 403);
  }

  await prisma.agentMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: { text: input.userText },
    },
  });

  const history = await prisma.agentMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是展馆出模助手。简单几何/展台用 threejs_draft（JSON scene graph）。不要编造 tenantId。',
    },
  ];
  for (const m of history) {
    const c = m.content as { text?: string; toolCalls?: unknown; toolResult?: unknown };
    if (m.role === 'user') {
      messages.push({ role: 'user', content: c.text ?? '' });
    } else if (m.role === 'assistant') {
      messages.push({ role: 'assistant', content: c.text ?? '' });
    } else if (m.role === 'tool') {
      messages.push({
        role: 'tool',
        content: JSON.stringify(c.toolResult ?? c),
        tool_call_id: (c as { toolCallId?: string }).toolCallId ?? 'tool',
      });
    }
  }

  const { apiKey, row, models } = await getDecryptedProvider(session.llmProviderId);
  const model = session.model || models[0] || 'mock';
  const tools = listToolSpecs();

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const out = await chatWithTools({
        baseUrl: row.baseUrl,
        apiKey,
        model,
        messages,
        tools,
      });

      if (!out.toolCalls?.length) {
        const text = out.message.content ?? '';
        input.sse.write('token', { text });
        await prisma.agentMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: { text },
          },
        });
        break;
      }

      messages.push({
        role: 'assistant',
        content: out.message.content ?? null,
        tool_calls: out.toolCalls,
      });

      for (const call of out.toolCalls) {
        input.sse.write('tool_start', { name: call.function.name, id: call.id });
        let result: Record<string, unknown>;
        try {
          result = await executeTool(call.function.name, call.function.arguments, {
            ...input.ctx,
            sessionId: session.id,
          });
        } catch (e) {
          result = {
            error: e instanceof AppError ? e.message : 'tool_failed',
          };
        }
        input.sse.write('tool_end', { name: call.function.name, result });
        if (typeof result.glbTempKey === 'string') {
          input.sse.write('preview', {
            glbTempKey: result.glbTempKey,
            previewPath: result.previewPath,
          });
        }
        await prisma.agentMessage.create({
          data: {
            sessionId: session.id,
            role: 'tool',
            content: {
              toolCallId: call.id,
              name: call.function.name,
              toolResult: result,
            },
          },
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    input.sse.write('done', { ok: true });
  } catch (e) {
    const message =
      e instanceof AppError ? e.message : '智能体会话失败';
    input.sse.write('error', { message });
    input.sse.write('done', { ok: false });
  } finally {
    input.sse.end();
  }
}
