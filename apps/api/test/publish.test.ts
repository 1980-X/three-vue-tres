import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cookieFrom,
  csrfHeaders,
  makeApp,
  resetDb,
  seedProjectWithOwner,
} from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('publish', () => {
  after(async () => {
    await prisma.$disconnect();
  });

  it('publish is idempotent; unpublish is idempotent; public only published', async () => {
    await resetDb();
    const seed = await seedProjectWithOwner();
    const app = await makeApp();
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: csrfHeaders(),
      payload: {
        email: seed.owner.email,
        password: seed.ownerPassword,
        tenantSlug: seed.tenant.slug,
      },
    });
    const cookie = cookieFrom(login);
    const h = { ...csrfHeaders(), cookie };

    const venue = await app.inject({
      method: 'POST',
      url: `/api/projects/${seed.project.id}/venues`,
      headers: h,
      payload: { title: '发布馆' },
    });
    const venueId = venue.json().id as string;

    await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/tracks`,
      headers: h,
      payload: { trackKind: 'panorama', title: '全景' },
    });

    const p1 = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/publish`,
      headers: h,
      payload: {},
    });
    assert.equal(p1.statusCode, 200, p1.body);
    assert.equal(p1.json().version, 1);
    const publicId = p1.json().publicId as string;

    const p2 = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/publish`,
      headers: h,
      payload: {},
    });
    assert.equal(p2.statusCode, 200);
    assert.equal(p2.json().version, 1);
    assert.equal(p2.json().publicId, publicId);

    const pubOk = await app.inject({
      method: 'GET',
      url: `/public/venues/${publicId}`,
    });
    assert.equal(pubOk.statusCode, 200);
    assert.equal(pubOk.json().snapshot.venue.title, '发布馆');

    const un1 = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/unpublish`,
      headers: h,
      payload: {},
    });
    assert.equal(un1.statusCode, 200);

    const un2 = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/unpublish`,
      headers: h,
      payload: {},
    });
    assert.equal(un2.statusCode, 200);

    const pub404 = await app.inject({
      method: 'GET',
      url: `/public/venues/${publicId}`,
    });
    assert.equal(pub404.statusCode, 404);

    await app.close();
  });
});
