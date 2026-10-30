import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

function allowedHost(): string {
  const base = process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:18700';
  return new URL(base).host;
}

export function assertCsrf(req: FastifyRequest) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return;
  }
  const host = allowedHost();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host === host) return;
    } catch {
      /* fall through */
    }
    throw new AppError('forbidden', '请求来源不被允许', 403);
  }
  const referer = req.headers.referer;
  if (referer) {
    try {
      if (new URL(referer).host === host) return;
    } catch {
      /* fall through */
    }
    throw new AppError('forbidden', '请求来源不被允许', 403);
  }
  // Same-origin cookie tools / inject tests: allow missing Origin when Host matches
  const reqHost = req.headers.host;
  if (reqHost === host) return;
  throw new AppError('forbidden', '请求来源不被允许', 403);
}
