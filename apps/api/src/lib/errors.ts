import type { FastifyReply } from 'fastify';

export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

export function sendError(reply: FastifyReply, err: AppError) {
  return reply.code(err.statusCode).send({
    error: { code: err.code, message: err.message },
  });
}
