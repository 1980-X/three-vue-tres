import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, apiKeyLast4 } from '../src/lib/secret-box.js';

describe('secret-box', () => {
  it('roundtrips', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const enc = encryptSecret('sk-test');
    assert.notEqual(enc, 'sk-test');
    assert.equal(decryptSecret(enc), 'sk-test');
  });

  it('exposes last4', () => {
    assert.equal(apiKeyLast4('sk-abcdefgh'), 'efgh');
  });
});
