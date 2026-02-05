/**
 * Cat Cafe API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes } from './routes/index.js';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  // CORS for frontend
  await app.register(cors, {
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Register routes
  await app.register(messagesRoutes);
  await app.register(catsRoutes);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[api] Server running on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
