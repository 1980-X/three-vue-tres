import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { getDecryptedProvider } from '../../llm/registry.js';
import { createMeshProvider } from '../../mesh/hunyuan.js';
import { getStorage } from '../../storage/index.js';
import { exportSceneGraphToGlb } from '../../threejs/sandbox.js';
import type { AgentTool } from './types.js';

const Args = z.object({
  jobId: z.string().uuid(),
});

export const meshPollTool: AgentTool = {
  name: 'mesh_poll',
  description: '查询生 3D 任务；成功则写入临时 GLB 并返回 glbTempKey',
  parameters: {
    type: 'object',
    properties: { jobId: { type: 'string' } },
    required: ['jobId'],
  },
  async execute(raw, ctx) {
    const parsed = Args.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('validation_error', 'mesh_poll 参数不合法', 400);
    }
    const job = await prisma.meshJob.findUnique({ where: { id: parsed.data.jobId } });
    if (!job || job.tenantId !== ctx.tenantId || job.projectId !== ctx.projectId) {
      throw new AppError('not_found', '任务不存在', 404);
    }
    if (job.status === 'succeeded' && job.glbTempKey) {
      return {
        status: job.status,
        glbTempKey: job.glbTempKey,
        previewPath: `/api/projects/${ctx.projectId}/agent/tmp-preview?key=${encodeURIComponent(job.glbTempKey)}`,
      };
    }
    const { apiKey, row } = await getDecryptedProvider(job.providerId);
    const provider = createMeshProvider({
      vendor: row.vendor,
      baseUrl: row.baseUrl,
      apiKey,
    });
    const poll = await provider.poll(job.remoteTaskId);
    if (poll.status === 'failed') {
      await prisma.meshJob.update({
        where: { id: job.id },
        data: { status: 'failed', errorMessage: poll.errorMessage ?? 'failed' },
      });
      return { status: 'failed', errorMessage: poll.errorMessage };
    }
    if (poll.status !== 'succeeded') {
      await prisma.meshJob.update({
        where: { id: job.id },
        data: { status: poll.status },
      });
      return { status: poll.status };
    }

    let buf: Buffer;
    if (poll.glbUrl === 'mock://use-threejs-fixture' || !poll.glbUrl) {
      buf = await exportSceneGraphToGlb({
        version: 1,
        nodes: [
          {
            id: 'mesh_mock',
            primitive: 'sphere',
            position: [0, 0.5, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            color: '#66cc99',
          },
        ],
      });
    } else {
      const res = await fetch(poll.glbUrl, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new AppError('provider_error', '下载 GLB 失败', 502);
      buf = Buffer.from(await res.arrayBuffer());
    }
    const glbTempKey = `tmp/agent/${ctx.sessionId}/${randomUUID()}.glb`;
    await getStorage().put(glbTempKey, buf, 'model/gltf-binary');
    await prisma.meshJob.update({
      where: { id: job.id },
      data: { status: 'succeeded', glbTempKey },
    });
    return {
      status: 'succeeded',
      glbTempKey,
      previewPath: `/api/projects/${ctx.projectId}/agent/tmp-preview?key=${encodeURIComponent(glbTempKey)}`,
    };
  },
};
