import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cookieFrom,
  csrfHeaders,
  makeApp,
  resetDb,
  seedPlatformAdmin,
} from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

describe('platform-ai', () => {
  before(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    process.env.MOCK_LLM = '1';
    await resetDb();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('rejects non-admin list with 401', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/platform/ai/providers' });
    assert.equal(res.statusCode, 401);
    await app.close();
  });

  it('creates provider without leaking apiKey', async () => {
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
    const cookie = cookieFrom(login);

    const created = await app.inject({
      method: 'POST',
      url: '/platform/ai/providers',
      headers: { ...csrfHeaders(), cookie },
      payload: {
        kind: 'llm',
        vendor: 'deepseek',
        name: 'DS',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-secret-key-9999',
        models: ['deepseek-chat'],
        isDefault: true,
      },
    });
    assert.equal(created.statusCode, 200);
    const body = created.json();
    assert.equal(body.apiKeyLast4, '9999');
    assert.equal(body.apiKey, undefined);

    const list = await app.inject({
      method: 'GET',
      url: '/platform/ai/providers',
      headers: { cookie },
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().items.length, 1);
    assert.equal(list.json().items[0].apiKey, undefined);
    await app.close();
  });
});
