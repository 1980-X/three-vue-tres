import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getDecryptedProvider } from '../../llm/registry.js';
import { createMeshProvider } from '../../mesh/hunyuan.js';
import type { AgentTool } from './types.js';

const Args = z.object({
  prompt: z.string().min(1).max(1024).optional(),
  imageUrl: z.string().url().optional(),
  meshProviderId: z.string().uuid().optional(),
});

export const meshSubmitTool: AgentTool = {
  name: 'mesh_submit',
  description: '提交厂商文/图生 3D 任务（混元等），返回 jobId',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      imageUrl: { type: 'string' },
      meshProviderId: { type: 'string' },
    },
  },
  async execute(raw, ctx) {
    const parsed = Args.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('validation_error', 'mesh_submit 参数不合法', 400);
    }
    if (!parsed.data.prompt && !parsed.data.imageUrl) {
      throw new AppError('validation_error', 'prompt 与 imageUrl 须填其一', 400);
    }
    const providerRow = parsed.data.meshProviderId
      ? await prisma.aiProviderConfig.findFirst({
          where: { id: parsed.data.meshProviderId, kind: 'mesh', enabled: true },
        })
      : await prisma.aiProviderConfig.findFirst({
          where: { kind: 'mesh', enabled: true, isDefault: true },
        }) ??
        (await prisma.aiProviderConfig.findFirst({
          where: { kind: 'mesh', enabled: true },
        }));
    if (!providerRow) {
      throw new AppError('not_found', '未配置可用的生 3D 厂商', 404);
    }
    const { apiKey } = await getDecryptedProvider(providerRow.id);
    const provider = createMeshProvider({
      vendor: providerRow.vendor,
      baseUrl: providerRow.baseUrl,
      apiKey,
    });
    const { remoteTaskId } = await provider.submit({
      prompt: parsed.data.prompt,
      imageUrl: parsed.data.imageUrl,
    });
    const job = await prisma.meshJob.create({
      data: {
        tenantId: ctx.tenantId,
        projectId: ctx.projectId,
        sessionId: ctx.sessionId,
        providerId: providerRow.id,
        remoteTaskId,
        status: 'running',
      },
    });
    return { jobId: job.id, remoteTaskId, status: job.status };
  },
};
