import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

function keyBuf() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY missing');
  }
  const b = Buffer.from(raw, 'base64');
  return b.length === 32 ? b : createHash('sha256').update(raw).digest();
}

/** AES-256-GCM；输出 base64url(iv|tag|ciphertext) */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBuf(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptSecret(blob: string) {
  const buf = Buffer.from(blob, 'base64url');
  if (buf.length < 28) {
    throw new Error('invalid secret blob');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', keyBuf(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function apiKeyLast4(plain: string) {
  if (plain.length <= 4) return plain;
  return plain.slice(-4);
}
