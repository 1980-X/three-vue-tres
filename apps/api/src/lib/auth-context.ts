import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './errors.js';
import { COOKIE, findSessionByRaw } from './session.js';
import { assertCsrf } from './csrf.js';

export type AuthMember = {
  kind: 'member';
  memberId: string;
  tenantId: string;
  email: string;
  displayName: string;
  isTenantOwner: boolean;
};

export type AuthPlatform = {
  kind: 'platform_admin';
  platformAdminId: string;
  email: string;
};

export type AuthUser = AuthMember | AuthPlatform;

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export async function loadSession(req: FastifyRequest) {
  const raw = req.cookies?.[COOKIE];
  if (!raw) {
    req.authUser = null;
    return;
  }
  const session = await findSessionByRaw(raw);
  if (!session) {
    req.authUser = null;
    return;
  }
  if (session.member) {
    req.authUser = {
      kind: 'member',
      memberId: session.member.id,
      tenantId: session.member.tenantId,
      email: session.member.email,
      displayName: session.member.displayName,
      isTenantOwner: session.member.isTenantOwner,
    };
    return;
  }
  if (session.platformAdmin) {
    req.authUser = {
      kind: 'platform_admin',
      platformAdminId: session.platformAdmin.id,
      email: session.platformAdmin.email,
    };
    return;
  }
  req.authUser = null;
}

export function requireMember(req: FastifyRequest): AuthMember {
  assertCsrf(req);
  if (!req.authUser || req.authUser.kind !== 'member') {
    throw new AppError('unauthorized', '请先登录', 401);
  }
  return req.authUser;
}

export function requirePlatformAdmin(req: FastifyRequest): AuthPlatform {
  assertCsrf(req);
  if (!req.authUser) {
    throw new AppError('unauthorized', '请先登录', 401);
  }
  if (req.authUser.kind !== 'platform_admin') {
    throw new AppError('forbidden', '需要平台管理员权限', 403);
  }
  return req.authUser;
}

export function setSessionCookie(reply: FastifyReply, raw: string) {
  reply.setCookie(COOKIE, raw, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: '/' });
}
