import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const NodeSchema = z.object({
  id: z.string().min(1).max(64),
  primitive: z.enum(['box', 'sphere', 'cylinder', 'plane']),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  scale: z.tuple([z.number(), z.number(), z.number()]).default([1, 1, 1]),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#888888'),
});

export const SceneGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(NodeSchema).min(1).max(32),
});

export type SceneGraph = z.infer<typeof SceneGraphSchema>;

export function parseSceneGraph(input: unknown): SceneGraph {
  const parsed = SceneGraphSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError('validation_error', '场景图不合法或超出节点上限', 400);
  }
  for (const n of parsed.data.nodes) {
    for (const v of [...n.scale, ...n.position]) {
      if (!Number.isFinite(v) || Math.abs(v) > 50) {
        throw new AppError('validation_error', '场景图数值超出允许范围', 400);
      }
    }
  }
  return parsed.data;
}
