import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { writeAudit } from '../lib/audit.js';

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.keys(v as object)
          .sort()
          .map((k) => [k, (v as Record<string, unknown>)[k]]),
      );
    }
    return v;
  });
}

export async function buildVenueSnapshot(venueId: string) {
  const venue = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    include: {
      coverAsset: true,
      tracks: {
        orderBy: { sortOrder: 'asc' },
        include: {
          entryAsset: true,
          hotspots: { orderBy: { sortOrder: 'asc' } },
          tours: true,
        },
      },
    },
  });

  const assetIds = new Set<string>();
  if (venue.coverAssetId) assetIds.add(venue.coverAssetId);
  for (const t of venue.tracks) {
    if (t.entryAssetId) assetIds.add(t.entryAssetId);
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: [...assetIds] } },
  });

  return {
    venue: {
      id: venue.id,
      title: venue.title,
      coverAssetId: venue.coverAssetId,
      primaryTrackId: venue.primaryTrackId,
    },
    tracks: venue.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      trackKind: t.trackKind,
      sortOrder: t.sortOrder,
      isPrimary: t.isPrimary,
      entryAssetId: t.entryAssetId,
      configJson: t.configJson,
      hotspots: t.hotspots.map((h) => ({
        id: h.id,
        title: h.title,
        payloadJson: h.payloadJson,
        sortOrder: h.sortOrder,
      })),
      tours: t.tours.map((tour) => ({
        id: tour.id,
        title: tour.title,
        stepsJson: tour.stepsJson,
      })),
    })),
    assets: assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      mime: a.mime,
      storageKey: a.storageKey,
      sha256: a.sha256,
      byteSize: a.byteSize.toString(),
    })),
  };
}

export type VenueSnapshot = Awaited<ReturnType<typeof buildVenueSnapshot>>;

export async function publishVenue(input: {
  venueId: string;
  tenantId: string;
  actorId: string;
}) {
  const snapshot = await buildVenueSnapshot(input.venueId);
  const latest = await prisma.publication.findFirst({
    where: { venueId: input.venueId },
    orderBy: { version: 'desc' },
  });

  if (
    latest &&
    latest.status === 'published' &&
    stableStringify(latest.snapshot) === stableStringify(snapshot)
  ) {
    return latest;
  }

  const publicId =
    latest?.publicId ?? randomBytes(6).toString('base64url').replace(/[_-]/g, '').slice(0, 10);
  const version = (latest?.version ?? 0) + 1;

  // mark previous published as unpublished history stay; new row is current published
  if (latest?.status === 'published') {
    await prisma.publication.update({
      where: { id: latest.id },
      data: { status: 'unpublished', unpublishedAt: new Date() },
    });
  }

  const pub = await prisma.publication.create({
    data: {
      tenantId: input.tenantId,
      venueId: input.venueId,
      publicId,
      status: 'published',
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      version,
      publishedAt: new Date(),
    },
  });

  await writeAudit({
    tenantId: input.tenantId,
    actorType: 'member',
    actorId: input.actorId,
    action: 'venue.publish',
    resourceType: 'venue',
    resourceId: input.venueId,
    metaJson: { publicationId: pub.id, version, publicId },
  });

  return pub;
}

export async function unpublishVenue(input: {
  venueId: string;
  tenantId: string;
  actorId: string;
}) {
  const current = await prisma.publication.findFirst({
    where: { venueId: input.venueId, status: 'published' },
    orderBy: { version: 'desc' },
  });
  if (!current) {
    // idempotent success: return latest unpublished or empty ok shape
    const latest = await prisma.publication.findFirst({
      where: { venueId: input.venueId },
      orderBy: { version: 'desc' },
    });
    return latest;
  }

  const updated = await prisma.publication.update({
    where: { id: current.id },
    data: { status: 'unpublished', unpublishedAt: new Date() },
  });

  await writeAudit({
    tenantId: input.tenantId,
    actorType: 'member',
    actorId: input.actorId,
    action: 'venue.unpublish',
    resourceType: 'venue',
    resourceId: input.venueId,
    metaJson: { publicationId: updated.id, version: updated.version },
  });

  return updated;
}

export async function assertVenueDeletable(venueId: string) {
  const published = await prisma.publication.findFirst({
    where: { venueId, status: 'published' },
  });
  if (published) {
    throw new AppError('conflict', '请先下架再删除展馆', 409);
  }
}
