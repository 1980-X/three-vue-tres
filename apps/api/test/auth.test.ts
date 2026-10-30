import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cookieFrom,
  csrfHeaders,
  makeApp,
  resetDb,
  seedTenantWithOwner,
} from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('auth', () => {
  before(async () => {
    await resetDb();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('rejects bad password with 401', async () => {
    await resetDb();
    const { ownerPassword: _pw, ...seed } = await seedTenantWithOwner();
    void _pw;
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: csrfHeaders(),
      payload: {
        email: seed.owner.email,
        password: 'wrong-password',
        tenantSlug: seed.tenant.slug,
      },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, 'unauthorized');
    const audits = await prisma.auditLog.findMany({
      where: { action: 'auth.login_failed' },
    });
    assert.ok(audits.length >= 1);
    await app.close();
  });

  it('login me logout flow', async () => {
    await resetDb();
    const seed = await seedTenantWithOwner();
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
    assert.equal(login.statusCode, 200);
    const cookie = cookieFrom(login);
    assert.ok(cookie.includes('dtv_session='));

    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie },
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().email, seed.owner.email);

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { ...csrfHeaders(), cookie },
      payload: {},
    });
    assert.equal(logout.statusCode, 200);

    const me2 = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie },
    });
    assert.equal(me2.statusCode, 401);
    await app.close();
  });

  it('rate limits login', async () => {
    process.env.LOGIN_RATE_LIMIT_MAX = '3';
    await resetDb();
    const seed = await seedTenantWithOwner({ slug: 'rate' });
    const app = await makeApp();
    let last = 0;
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: csrfHeaders(),
        payload: {
          email: seed.owner.email,
          password: 'bad',
          tenantSlug: seed.tenant.slug,
        },
      });
      last = res.statusCode;
    }
    assert.equal(last, 429);
    delete process.env.LOGIN_RATE_LIMIT_MAX;
    await app.close();
  });
});
