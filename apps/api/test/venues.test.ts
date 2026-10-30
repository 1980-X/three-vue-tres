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

describe('venues tracks hotspots tours', () => {
  after(async () => {
    await prisma.$disconnect();
  });

  it('supports dual tracks primary constraint and cascade', async () => {
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

    const venueRes = await app.inject({
      method: 'POST',
      url: `/api/projects/${seed.project.id}/venues`,
      headers: h,
      payload: { title: '主展馆' },
    });
    assert.equal(venueRes.statusCode, 200);
    const venueId = venueRes.json().id as string;

    const t1 = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/tracks`,
      headers: h,
      payload: { trackKind: 'panorama', title: '全景轨' },
    });
    assert.equal(t1.statusCode, 200);
    assert.equal(t1.json().isPrimary, true);
    const track1 = t1.json().id as string;

    const t2 = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/tracks`,
      headers: h,
      payload: { trackKind: 'scene3d', title: '3D轨' },
    });
    assert.equal(t2.statusCode, 200);
    assert.equal(t2.json().isPrimary, false);
    const track2 = t2.json().id as string;

    const delPrimary = await app.inject({
      method: 'DELETE',
      url: `/api/venues/${venueId}/tracks/${track1}`,
      headers: h,
      payload: {},
    });
    assert.equal(delPrimary.statusCode, 409);

    const hot = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/tracks/${track2}/hotspots`,
      headers: h,
      payload: { title: '热点A', payloadJson: { yaw: 1 } },
    });
    assert.equal(hot.statusCode, 200);

    const tour = await app.inject({
      method: 'POST',
      url: `/api/venues/${venueId}/tracks/${track2}/tours`,
      headers: h,
      payload: { title: '导览1', stepsJson: [{ hotspotId: hot.json().id }] },
    });
    assert.equal(tour.statusCode, 200);

    const delSecondary = await app.inject({
      method: 'DELETE',
      url: `/api/venues/${venueId}/tracks/${track2}`,
      headers: h,
      payload: {},
    });
    assert.equal(delSecondary.statusCode, 200);
    assert.equal(await prisma.hotspot.count({ where: { trackId: track2 } }), 0);
    assert.equal(await prisma.tour.count({ where: { trackId: track2 } }), 0);

    await app.close();
  });
});
