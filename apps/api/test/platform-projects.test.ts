import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cookieFrom,
  csrfHeaders,
  makeApp,
  resetDb,
  seedPlatformAdmin,
  seedTenantWithOwner,
} from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { hashPassword } from '../src/lib/password.js';

describe('platform and projects', () => {
  before(async () => {
    await resetDb();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('platform admin can create tenant; member cannot', async () => {
    await resetDb();
    await seedPlatformAdmin();
    const app = await makeApp();

    const login = await app.inject({
      method: 'POST',
      url: '/auth/platform/login',
      headers: csrfHeaders(),
      payload: { email: 'root@example.com', password: 'password123' },
    });
    assert.equal(login.statusCode, 200);
    const adminCookie = cookieFrom(login);

    const created = await app.inject({
      method: 'POST',
      url: '/platform/tenants',
      headers: { ...csrfHeaders(), cookie: adminCookie },
      payload: {
        name: 'Beta',
        slug: 'beta',
        ownerEmail: 'owner@beta.test',
        ownerPassword: 'password123',
        ownerDisplayName: 'Beta Owner',
      },
    });
    assert.equal(created.statusCode, 200);
    assert.equal(created.json().slug, 'beta');

    const memberLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: csrfHeaders(),
      payload: {
        email: 'owner@beta.test',
        password: 'password123',
        tenantSlug: 'beta',
      },
    });
    const memberCookie = cookieFrom(memberLogin);
    const forbidden = await app.inject({
      method: 'POST',
      url: '/platform/tenants',
      headers: { ...csrfHeaders(), cookie: memberCookie },
      payload: {
        name: 'X',
        slug: 'x',
        ownerEmail: 'a@b.c',
        ownerPassword: 'password123',
        ownerDisplayName: 'A',
      },
    });
    assert.equal(forbidden.statusCode, 403);
    await app.close();
  });

  it('project RBAC: viewer cannot patch; cross-tenant 403', async () => {
    await resetDb();
    const a = await seedTenantWithOwner({
      slug: 't-a',
      ownerEmail: 'a@t.test',
    });
    const b = await seedTenantWithOwner({
      slug: 't-b',
      ownerEmail: 'b@t.test',
    });
    const viewer = await prisma.member.create({
      data: {
        tenantId: a.tenant.id,
        email: 'viewer@t.test',
        passwordHash: await hashPassword('password123'),
        displayName: 'Viewer',
      },
    });
    const project = await prisma.project.create({
      data: { tenantId: a.tenant.id, name: 'P1' },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, memberId: a.owner.id, role: 'owner' },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, memberId: viewer.id, role: 'viewer' },
    });

    const app = await makeApp();
    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: csrfHeaders(),
      payload: {
        email: 'viewer@t.test',
        password: 'password123',
        tenantSlug: 't-a',
      },
    });
    const viewerCookie = cookieFrom(viewerLogin);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${project.id}`,
      headers: { ...csrfHeaders(), cookie: viewerCookie },
      payload: { name: 'Nope' },
    });
    assert.equal(patch.statusCode, 403);

    const bLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: csrfHeaders(),
      payload: {
        email: b.owner.email,
        password: b.ownerPassword,
        tenantSlug: 't-b',
      },
    });
    const bCookie = cookieFrom(bLogin);
    const cross = await app.inject({
      method: 'GET',
      url: `/api/projects/${project.id}`,
      headers: { ...csrfHeaders(), cookie: bCookie },
    });
    assert.equal(cross.statusCode, 403);
    await app.close();
  });
});
