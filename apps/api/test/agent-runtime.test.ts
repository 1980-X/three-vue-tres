import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cookieFrom,
  csrfHeaders,
  makeApp,
  resetDb,
  seedProjectWithOwner,
} from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { encryptSecret } from '../src/lib/secret-box.js';
import { setStorageForTests } from '../src/storage/index.js';
import type { StoragePort } from '../src/storage/port.js';

class MemStorage implements StoragePort {
  map = new Map<string, Buffer>();
  async put(key: string, data: Buffer) {
    this.map.set(key, data);
  }
  async get(key: string) {
    const b = this.map.get(key);
    if (!b) throw new Error('missing');
    return b;
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

describe('agent-runtime', () => {
  before(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64');
    process.env.MOCK_LLM = '1';
    setStorageForTests(new MemStorage());
    await resetDb();
  });

  after(async () => {
    setStorageForTests(null);
    await prisma.$disconnect();
  });

  it('SSE threejs_draft yields preview for owner', async () => {
    await resetDb();
    const seed = await seedProjectWithOwner();
    const provider = await prisma.aiProviderConfig.create({
      data: {
        kind: 'llm',
        vendor: 'deepseek',
        name: 'mock',
        baseUrl: 'https://api.deepseek.com',
        apiKeyEnc: encryptSecret('sk-xxxx'),
        modelsJson: ['mock'],
        enabled: true,
        isDefault: true,
      },
    });
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
    const session = await app.inject({
      method: 'POST',
      url: `/api/projects/${seed.project.id}/agent/sessions`,
      headers: { ...csrfHeaders(), cookie },
      payload: { llmProviderId: provider.id },
    });
    assert.equal(session.statusCode, 200);
    const sessionId = session.json().id as string;

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${seed.project.id}/agent/sessions/${sessionId}/messages`,
      headers: { ...csrfHeaders(), cookie },
      payload: { text: '做一个 threejs 展台' },
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes('event: preview') || res.body.includes('event: tool_end'));
    assert.ok(res.body.includes('event: done'));
    await app.close();
  });
});
