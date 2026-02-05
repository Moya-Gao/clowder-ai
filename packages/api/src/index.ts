/**
 * Cat Café API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[api] Server running on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
