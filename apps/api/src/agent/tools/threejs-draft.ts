import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { getStorage } from '../../storage/index.js';
import { parseSceneGraph } from '../../threejs/scene-graph.js';
import { exportSceneGraphToGlb } from '../../threejs/sandbox.js';
import type { AgentTool } from './types.js';

const Args = z.object({
  sceneGraph: z.unknown(),
});

export const threejsDraftTool: AgentTool = {
  name: 'threejs_draft',
  description: '用受限 JSON 场景图生成草模 GLB（box/sphere/cylinder/plane）',
  parameters: {
    type: 'object',
    properties: {
      sceneGraph: {
        type: 'object',
        description: 'version:1 + nodes[] primitive/transform/color',
      },
    },
    required: ['sceneGraph'],
  },
  async execute(raw, ctx) {
    const parsed = Args.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('validation_error', 'threejs_draft 参数不合法', 400);
    }
    const graph = parseSceneGraph(parsed.data.sceneGraph);
    const buf = await exportSceneGraphToGlb(graph);
    const glbTempKey = `tmp/agent/${ctx.sessionId}/${randomUUID()}.glb`;
    await getStorage().put(glbTempKey, buf, 'model/gltf-binary');
    return {
      glbTempKey,
      byteSize: buf.length,
      previewPath: `/api/projects/${ctx.projectId}/agent/tmp-preview?key=${encodeURIComponent(glbTempKey)}`,
    };
  },
};
