import type { FastifyInstance } from 'fastify';
import { TrackKind, type Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { requireMember } from '../lib/auth-context.js';
import { requireProjectRole } from '../lib/rbac.js';
import {
  assertVenueDeletable,
  publishVenue,
  unpublishVenue,
} from '../services/publish.js';

const trackKindSchema = z.nativeEnum(TrackKind);

async function loadVenueForMember(
  venueId: string,
  tenantId: string,
  memberId: string,
  need: 'viewer' | 'editor' | 'admin',
) {
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) throw new AppError('not_found', '展馆不存在', 404);
  if (venue.tenantId !== tenantId) {
    throw new AppError('forbidden', '无权访问该展馆', 403);
  }
  await requireProjectRole(memberId, tenantId, venue.projectId, need);
  return venue;
}

export async function venueRoutes(app: FastifyInstance) {
  app.get('/api/projects/:projectId/venues', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'viewer');
    const items = await prisma.venue.findMany({
      where: { projectId, tenantId: user.tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { tracks: { orderBy: { sortOrder: 'asc' } } },
    });
    return { items, total: items.length };
  });

  app.post('/api/projects/:projectId/venues', async (req) => {
    const user = requireMember(req);
    const { projectId } = req.params as { projectId: string };
    await requireProjectRole(user.memberId, user.tenantId, projectId, 'editor');
    const parsed = z
      .object({
        title: z.string().min(1),
        coverAssetId: z.string().uuid().optional().nullable(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '展馆参数不合法', 400);
    }
    return prisma.venue.create({
      data: {
        tenantId: user.tenantId,
        projectId,
        title: parsed.data.title,
        coverAssetId: parsed.data.coverAssetId ?? null,
      },
    });
  });

  app.get('/api/venues/:venueId', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'viewer');
    return prisma.venue.findUniqueOrThrow({
      where: { id: venueId },
      include: {
        tracks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            hotspots: { orderBy: { sortOrder: 'asc' } },
            tours: true,
          },
        },
      },
    });
  });

  app.patch('/api/venues/:venueId', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
    const parsed = z
      .object({
        title: z.string().min(1).optional(),
        coverAssetId: z.string().uuid().nullable().optional(),
        primaryTrackId: z.string().uuid().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '展馆参数不合法', 400);
    }
    return prisma.venue.update({
      where: { id: venueId },
      data: parsed.data,
    });
  });

  app.delete('/api/venues/:venueId', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'admin');
    await assertVenueDeletable(venueId);
    await prisma.venue.delete({ where: { id: venueId } });
    return { ok: true };
  });

  app.post('/api/venues/:venueId/publish', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
    const pub = await publishVenue({
      venueId,
      tenantId: user.tenantId,
      actorId: user.memberId,
    });
    const base = process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:18700';
    return {
      ...pub,
      viewerUrl: `${base}/v/${pub.publicId}`,
    };
  });

  app.post('/api/venues/:venueId/unpublish', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
    const pub = await unpublishVenue({
      venueId,
      tenantId: user.tenantId,
      actorId: user.memberId,
    });
    return { ok: true, publication: pub };
  });

  app.get('/api/venues/:venueId/publications', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'viewer');
    const items = await prisma.publication.findMany({
      where: { venueId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        publicId: true,
        status: true,
        version: true,
        publishedAt: true,
        unpublishedAt: true,
        createdAt: true,
      },
    });
    return { items, total: items.length };
  });

  app.get('/api/venues/:venueId/tracks', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'viewer');
    const items = await prisma.venueTrack.findMany({
      where: { venueId },
      orderBy: { sortOrder: 'asc' },
    });
    return { items, total: items.length };
  });

  app.post('/api/venues/:venueId/tracks', async (req) => {
    const user = requireMember(req);
    const { venueId } = req.params as { venueId: string };
    const venue = await loadVenueForMember(
      venueId,
      user.tenantId,
      user.memberId,
      'editor',
    );
    const parsed = z
      .object({
        trackKind: trackKindSchema,
        title: z.string().min(1),
        sortOrder: z.number().int().optional(),
        isPrimary: z.boolean().optional(),
        entryAssetId: z.string().uuid().nullable().optional(),
        configJson: z.record(z.unknown()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '轨参数不合法', 400);
    }
    const count = await prisma.venueTrack.count({ where: { venueId } });
    const isPrimary = parsed.data.isPrimary ?? count === 0;
    return prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.venueTrack.updateMany({
          where: { venueId },
          data: { isPrimary: false },
        });
      }
      const track = await tx.venueTrack.create({
        data: {
          venueId,
          tenantId: venue.tenantId,
          trackKind: parsed.data.trackKind,
          title: parsed.data.title,
          sortOrder: parsed.data.sortOrder ?? count,
          isPrimary,
          entryAssetId: parsed.data.entryAssetId ?? null,
          configJson: (parsed.data.configJson ?? {}) as Prisma.InputJsonValue,
        },
      });
      if (isPrimary) {
        await tx.venue.update({
          where: { id: venueId },
          data: { primaryTrackId: track.id },
        });
      }
      return track;
    });
  });

  app.patch('/api/venues/:venueId/tracks/:trackId', async (req) => {
    const user = requireMember(req);
    const { venueId, trackId } = req.params as {
      venueId: string;
      trackId: string;
    };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
    const track = await prisma.venueTrack.findFirst({
      where: { id: trackId, venueId },
    });
    if (!track) throw new AppError('not_found', '轨不存在', 404);
    const parsed = z
      .object({
        title: z.string().min(1).optional(),
        sortOrder: z.number().int().optional(),
        isPrimary: z.boolean().optional(),
        entryAssetId: z.string().uuid().nullable().optional(),
        configJson: z.record(z.unknown()).optional(),
        trackKind: trackKindSchema.optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '轨参数不合法', 400);
    }
    return prisma.$transaction(async (tx) => {
      if (parsed.data.isPrimary === true) {
        await tx.venueTrack.updateMany({
          where: { venueId },
          data: { isPrimary: false },
        });
        await tx.venue.update({
          where: { id: venueId },
          data: { primaryTrackId: trackId },
        });
      }
      return tx.venueTrack.update({
        where: { id: trackId },
        data: {
          title: parsed.data.title,
          sortOrder: parsed.data.sortOrder,
          isPrimary: parsed.data.isPrimary,
          entryAssetId: parsed.data.entryAssetId,
          configJson: parsed.data.configJson as Prisma.InputJsonValue | undefined,
          trackKind: parsed.data.trackKind,
        },
      });
    });
  });

  app.delete('/api/venues/:venueId/tracks/:trackId', async (req) => {
    const user = requireMember(req);
    const { venueId, trackId } = req.params as {
      venueId: string;
      trackId: string;
    };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
    const track = await prisma.venueTrack.findFirst({
      where: { id: trackId, venueId },
    });
    if (!track) throw new AppError('not_found', '轨不存在', 404);
    if (track.isPrimary) {
      throw new AppError('conflict', '请先将其他轨设为 primary 再删除', 409);
    }
    await prisma.venueTrack.delete({ where: { id: trackId } });
    return { ok: true };
  });

  app.get('/api/venues/:venueId/tracks/:trackId/hotspots', async (req) => {
    const user = requireMember(req);
    const { venueId, trackId } = req.params as {
      venueId: string;
      trackId: string;
    };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'viewer');
    const items = await prisma.hotspot.findMany({
      where: { venueId, trackId },
      orderBy: { sortOrder: 'asc' },
    });
    return { items, total: items.length };
  });

  app.post('/api/venues/:venueId/tracks/:trackId/hotspots', async (req) => {
    const user = requireMember(req);
    const { venueId, trackId } = req.params as {
      venueId: string;
      trackId: string;
    };
    const venue = await loadVenueForMember(
      venueId,
      user.tenantId,
      user.memberId,
      'editor',
    );
    const track = await prisma.venueTrack.findFirst({
      where: { id: trackId, venueId },
    });
    if (!track) throw new AppError('not_found', '轨不存在', 404);
    const parsed = z
      .object({
        title: z.string().min(1),
        payloadJson: z.record(z.unknown()).optional(),
        sortOrder: z.number().int().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '热点参数不合法', 400);
    }
    return prisma.hotspot.create({
      data: {
        venueId,
        trackId,
        tenantId: venue.tenantId,
        title: parsed.data.title,
        payloadJson: (parsed.data.payloadJson ?? {}) as Prisma.InputJsonValue,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    });
  });

  app.patch(
    '/api/venues/:venueId/tracks/:trackId/hotspots/:hotspotId',
    async (req) => {
      const user = requireMember(req);
      const { venueId, trackId, hotspotId } = req.params as {
        venueId: string;
        trackId: string;
        hotspotId: string;
      };
      await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
      const hotspot = await prisma.hotspot.findFirst({
        where: { id: hotspotId, venueId, trackId },
      });
      if (!hotspot) throw new AppError('not_found', '热点不存在', 404);
      const parsed = z
        .object({
          title: z.string().min(1).optional(),
          payloadJson: z.record(z.unknown()).optional(),
          sortOrder: z.number().int().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('validation_error', '热点参数不合法', 400);
      }
      return prisma.hotspot.update({
        where: { id: hotspotId },
        data: {
          title: parsed.data.title,
          sortOrder: parsed.data.sortOrder,
          payloadJson: parsed.data.payloadJson as Prisma.InputJsonValue | undefined,
        },
      });
    },
  );

  app.delete(
    '/api/venues/:venueId/tracks/:trackId/hotspots/:hotspotId',
    async (req) => {
      const user = requireMember(req);
      const { venueId, trackId, hotspotId } = req.params as {
        venueId: string;
        trackId: string;
        hotspotId: string;
      };
      await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
      await prisma.hotspot.deleteMany({
        where: { id: hotspotId, venueId, trackId },
      });
      return { ok: true };
    },
  );

  app.get('/api/venues/:venueId/tracks/:trackId/tours', async (req) => {
    const user = requireMember(req);
    const { venueId, trackId } = req.params as {
      venueId: string;
      trackId: string;
    };
    await loadVenueForMember(venueId, user.tenantId, user.memberId, 'viewer');
    const items = await prisma.tour.findMany({ where: { venueId, trackId } });
    return { items, total: items.length };
  });

  app.post('/api/venues/:venueId/tracks/:trackId/tours', async (req) => {
    const user = requireMember(req);
    const { venueId, trackId } = req.params as {
      venueId: string;
      trackId: string;
    };
    const venue = await loadVenueForMember(
      venueId,
      user.tenantId,
      user.memberId,
      'editor',
    );
    const track = await prisma.venueTrack.findFirst({
      where: { id: trackId, venueId },
    });
    if (!track) throw new AppError('not_found', '轨不存在', 404);
    const parsed = z
      .object({
        title: z.string().min(1),
        stepsJson: z.array(z.unknown()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('validation_error', '导览参数不合法', 400);
    }
    return prisma.tour.create({
      data: {
        venueId,
        trackId,
        tenantId: venue.tenantId,
        title: parsed.data.title,
        stepsJson: (parsed.data.stepsJson ?? []) as Prisma.InputJsonValue,
      },
    });
  });

  app.patch(
    '/api/venues/:venueId/tracks/:trackId/tours/:tourId',
    async (req) => {
      const user = requireMember(req);
      const { venueId, trackId, tourId } = req.params as {
        venueId: string;
        trackId: string;
        tourId: string;
      };
      await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
      const tour = await prisma.tour.findFirst({
        where: { id: tourId, venueId, trackId },
      });
      if (!tour) throw new AppError('not_found', '导览不存在', 404);
      const parsed = z
        .object({
          title: z.string().min(1).optional(),
          stepsJson: z.array(z.unknown()).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('validation_error', '导览参数不合法', 400);
      }
      return prisma.tour.update({
        where: { id: tourId },
        data: {
          title: parsed.data.title,
          stepsJson: parsed.data.stepsJson as Prisma.InputJsonValue | undefined,
        },
      });
    },
  );

  app.delete(
    '/api/venues/:venueId/tracks/:trackId/tours/:tourId',
    async (req) => {
      const user = requireMember(req);
      const { venueId, trackId, tourId } = req.params as {
        venueId: string;
        trackId: string;
        tourId: string;
      };
      await loadVenueForMember(venueId, user.tenantId, user.memberId, 'editor');
      await prisma.tour.deleteMany({ where: { id: tourId, venueId, trackId } });
      return { ok: true };
    },
  );
}
