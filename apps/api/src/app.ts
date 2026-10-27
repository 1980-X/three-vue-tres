import Fastify, { type FastifyServerOptions } from 'fastify';
import { AppError, sendError } from './lib/errors.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof AppError) return sendError(reply, err);
    app.log.error(err);
    return sendError(
      reply,
      new AppError('internal_error', '服务暂时不可用', 500),
    );
  });
  await app.register(healthRoutes);
  return app;
}
