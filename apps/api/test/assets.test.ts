import { mkdtemp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
import { LocalFsAdapter } from '../src/storage/local-fs.js';
import { setStorageForTests } from '../src/storage/index.js';

function multipartPayload(fields: Record<string, string>, file: {
  name: string;
  filename: string;
  contentType: string;
  body: Buffer;
}) {
  const boundary = '----dtvtestboundary';
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      ),
    );
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`,
    ),
  );
  chunks.push(file.body);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('assets', () => {
  let storageRoot = '';

  before(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'dtv-assets-'));
    setStorageForTests(new LocalFsAdapter(storageRoot));
    process.env.STORAGE_ROOT = storageRoot;
  });

  after(async () => {
    setStorageForTests(null);
    await prisma.$disconnect();
  });

  it('upload list delete removes file', async () => {
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
    const bodyBytes = Buffer.from('fake-image-bytes');
    const mp = multipartPayload(
      { title: '全景1', kind: 'panorama_image' },
      {
        name: 'file',
        filename: 'pano.jpg',
        contentType: 'image/jpeg',
        body: bodyBytes,
      },
    );

    const created = await app.inject({
      method: 'POST',
      url: `/api/projects/${seed.project.id}/assets`,
      headers: {
        'content-type': mp.contentType,
        origin: csrfHeaders().origin,
        cookie,
      },
      payload: mp.payload,
    });
    assert.equal(created.statusCode, 200, created.body);
    const asset = created.json();
    assert.equal(asset.kind, 'panorama_image');
    assert.ok(asset.sha256);
    assert.ok(asset.storageKey);
    assert.equal(asset.byteSize, String(bodyBytes.length));

    const filePath = path.join(storageRoot, asset.storageKey);
    await access(filePath);

    const list = await app.inject({
      method: 'GET',
      url: `/api/projects/${seed.project.id}/assets`,
      headers: { cookie },
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().total, 1);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${seed.project.id}/assets/${asset.id}`,
      headers: { ...csrfHeaders(), cookie },
      payload: {},
    });
    assert.equal(del.statusCode, 200);
    await assert.rejects(() => access(filePath));
    await app.close();
  });
});
