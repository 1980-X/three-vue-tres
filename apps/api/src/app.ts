import Fastify, { type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import { AppError, sendError } from './lib/errors.js';
import { loadSession } from './lib/auth-context.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { platformRoutes } from './routes/platform.js';
import { projectRoutes } from './routes/projects.js';

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);
  await app.register(cookie);
  app.addHook('onRequest', async (req) => {
    await loadSession(req);
  });
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return sendError(reply, err);
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) {
      return reply.code(429).send({
        error: { code: 'rate_limited', message: '尝试过于频繁，请稍后再试' },
      });
    }
    app.log.error(err);
    return sendError(
      reply,
      new AppError('internal_error', '服务暂时不可用', 500),
    );
  });
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(platformRoutes);
  await app.register(projectRoutes);
  return app;
}
