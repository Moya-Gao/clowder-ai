import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

function securityHeaders(app: FastifyInstance, _opts: Record<string, never>, done: () => void) {
  app.addHook('onSend', (_request, reply, _payload, next) => {
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Content-Security-Policy', "frame-ancestors 'none'");
    next();
  });
  done();
}

export const securityHeadersPlugin = fp(securityHeaders, {
  name: 'security-headers',
});
