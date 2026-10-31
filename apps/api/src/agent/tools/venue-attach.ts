import { z } from 'zod';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AgentTool } from './types.js';

const Args = z.object({
  assetId: z.string().uuid(),
  venueId: z.string().uuid(),
  trackId: z.string().uuid().optional(),
});

export const venueAttachTool: AgentTool = {
  name: 'venue_attach',
  description: '将 Asset 挂到展馆轨 entryAssetId（默认 primary 或指定 trackId）',
  parameters: {
    type: 'object',
    properties: {
      assetId: { type: 'string' },
      venueId: { type: 'string' },
      trackId: { type: 'string' },
    },
    required: ['assetId', 'venueId'],
  },
  async execute(raw, ctx) {
    const parsed = Args.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('validation_error', 'venue_attach 参数不合法', 400);
    }
    const asset = await prisma.asset.findFirst({
      where: {
        id: parsed.data.assetId,
        tenantId: ctx.tenantId,
        projectId: ctx.projectId,
      },
    });
    if (!asset) throw new AppError('not_found', '资产不存在', 404);
    const venue = await prisma.venue.findFirst({
      where: {
        id: parsed.data.venueId,
        tenantId: ctx.tenantId,
        projectId: ctx.projectId,
      },
    });
    if (!venue) throw new AppError('not_found', '展馆不存在', 404);

    let trackId = parsed.data.trackId;
    if (!trackId) {
      trackId = venue.primaryTrackId ?? undefined;
    }
    if (!trackId) {
      const first = await prisma.venueTrack.findFirst({
        where: { venueId: venue.id },
        orderBy: { sortOrder: 'asc' },
      });
      trackId = first?.id;
    }
    if (!trackId) throw new AppError('validation_error', '展馆无可用轨', 400);

    const track = await prisma.venueTrack.findFirst({
      where: { id: trackId, venueId: venue.id, tenantId: ctx.tenantId },
    });
    if (!track) throw new AppError('not_found', '轨不存在', 404);

    await prisma.venueTrack.update({
      where: { id: track.id },
      data: { entryAssetId: asset.id },
    });
    return { ok: true, trackId: track.id, assetId: asset.id };
  },
};
