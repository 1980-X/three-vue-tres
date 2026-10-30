import type { FastifyRequest } from 'fastify';
import { AppError } from './errors.js';

/** PUBLIC_BASE_URL 的 host（含端口），如 127.0.0.1:18700 */
function configuredHost(): string {
  const base = process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:18700';
  return new URL(base).host;
}

/** 浏览器常用环回别名：localhost ↔ 127.0.0.1 ↔ ::1，同端口视为同源 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1']);

function splitHost(host: string): { name: string; port: string } | null {
  try {
    const u = new URL(`http://${host}`);
    return {
      name: u.hostname.replace(/^\[|\]$/g, ''),
      port: u.port || '80',
    };
  } catch {
    return null;
  }
}

/** 供测试与 CSRF 共用：同 host 或同端口环回别名 */
export function hostsMatch(candidate: string, allowed: string): boolean {
  if (candidate === allowed) return true;
  const a = splitHost(candidate);
  const b = splitHost(allowed);
  if (!a || !b) return false;
  if (a.port !== b.port) return false;
  if (LOOPBACK.has(a.name) && LOOPBACK.has(b.name)) return true;
  return a.name === b.name;
}

export function assertCsrf(req: FastifyRequest) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return;
  }
  const allowed = configuredHost();
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (hostsMatch(new URL(origin).host, allowed)) return;
    } catch {
      /* fall through */
    }
    throw new AppError('forbidden', '请求来源不被允许', 403);
  }
  const referer = req.headers.referer;
  if (referer) {
    try {
      if (hostsMatch(new URL(referer).host, allowed)) return;
    } catch {
      /* fall through */
    }
    throw new AppError('forbidden', '请求来源不被允许', 403);
  }
  // Same-origin cookie tools / inject tests: allow missing Origin when Host matches
  const reqHost = req.headers.host;
  if (reqHost && hostsMatch(reqHost, allowed)) return;
  throw new AppError('forbidden', '请求来源不被允许', 403);
}
