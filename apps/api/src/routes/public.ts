import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { getStorage } from '../storage/index.js';
import type { VenueSnapshot } from '../services/publish.js';

export async function publicRoutes(app: FastifyInstance) {
  app.get('/public/venues/:publicId', async (req) => {
    const { publicId } = req.params as { publicId: string };
    const pub = await prisma.publication.findFirst({
      where: { publicId, status: 'published' },
      orderBy: { version: 'desc' },
    });
    if (!pub) throw new AppError('not_found', '展馆已下架或不可用', 404);
    const snapshot = pub.snapshot as unknown as VenueSnapshot;
    return {
      publicId: pub.publicId,
      version: pub.version,
      publishedAt: pub.publishedAt,
      snapshot: {
        ...snapshot,
        assets: snapshot.assets.map((a) => ({
          ...a,
          url: `/public/venues/${pub.publicId}/assets/${a.id}`,
        })),
      },
    };
  });

  app.get('/public/venues/:publicId/assets/:assetId', async (req, reply) => {
    const { publicId, assetId } = req.params as {
      publicId: string;
      assetId: string;
    };
    const pub = await prisma.publication.findFirst({
      where: { publicId, status: 'published' },
      orderBy: { version: 'desc' },
    });
    if (!pub) throw new AppError('not_found', '展馆已下架或不可用', 404);
    const snapshot = pub.snapshot as unknown as VenueSnapshot;
    const asset = snapshot.assets.find((a) => a.id === assetId);
    if (!asset) throw new AppError('not_found', '资产不存在', 404);

    const buf = await getStorage().get(asset.storageKey);
    return reply
      .header('Content-Type', asset.mime || 'application/octet-stream')
      .header('Cache-Control', 'public, max-age=3600')
      .send(buf);
  });
}
