/**
 * Cat Cafe API Server
 * 后端 API 入口
 */

import { createServer } from 'node:http';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes } from './routes/index.js';
import { SocketManager } from './infrastructure/websocket/index.js';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);

let socketManager: SocketManager | null = null;

/**
 * Get the SocketManager instance
 * @throws Error if SocketManager is not initialized
 */
export function getSocketManager(): SocketManager {
  if (!socketManager) {
    throw new Error('SocketManager not initialized');
  }
  return socketManager;
}

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  // CORS for frontend
  await app.register(cors, {
    origin: ['http://localhost:3000'],
    credentials: true,
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Create HTTP server from Fastify's server handler
  const httpServer = createServer(app.server);

  // Initialize WebSocket manager BEFORE routes (routes use getSocketManager())
  socketManager = new SocketManager(httpServer);

  // Register routes (safe to call getSocketManager() now)
  await app.register(messagesRoutes);
  await app.register(catsRoutes);

  // Prepare Fastify
  await app.ready();

  // Start listening
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] Server running on http://localhost:${PORT}`);
    console.log(`[ws] WebSocket server ready`);
  });
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
