/**
 * Cat Cafe API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes, callbacksRoutes, threadsRoutes, uploadsRoutes, projectsRoutes, tasksRoutes, summariesRoutes } from './routes/index.js';
import { SocketManager } from './infrastructure/websocket/index.js';
import { InvocationRegistry } from './domains/cats/services/InvocationRegistry.js';
import { createMessageStore } from './domains/cats/services/MessageStoreFactory.js';
import { createRedisClient, SessionStore } from '@cat-cafe/shared/utils';
import { ThreadStore } from './domains/cats/services/ThreadStore.js';
import { TaskStore } from './domains/cats/services/TaskStore.js';
import { SummaryStore } from './domains/cats/services/SummaryStore.js';
import { InvocationTracker } from './domains/cats/services/InvocationTracker.js';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);
const HOST = process.env['API_SERVER_HOST'] ?? '127.0.0.1';

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
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

  // Create invocation tracker for cancellation support
  const invocationTracker = new InvocationTracker();

  // Initialize WebSocket manager BEFORE routes (injected via opts, no circular import).
  // IMPORTANT: Socket.io must attach to the SAME server Fastify listens on.
  socketManager = new SocketManager(app.server, invocationTracker);

  // Create shared service instances for MCP callback flow
  const registry = new InvocationRegistry();
  const redisUrl = process.env['REDIS_URL'];
  const redis = redisUrl ? createRedisClient({ url: redisUrl }) : undefined;
  const messageStore = createMessageStore(redis);
  const sessionStore = redis ? new SessionStore(redis) : undefined;
  const threadStore = new ThreadStore();
  const taskStore = new TaskStore();
  const summaryStore = new SummaryStore();

  // Register routes (socketManager injected, no circular import)
  await app.register(messagesRoutes, {
    registry,
    messageStore,
    socketManager,
    ...(sessionStore ? { sessionStore } : {}),
    threadStore,
    invocationTracker,
  });
  await app.register(catsRoutes);
  await app.register(callbacksRoutes, { registry, messageStore, socketManager, taskStore });
  await app.register(threadsRoutes, { threadStore });
  await app.register(tasksRoutes, { taskStore, socketManager });
  await app.register(summariesRoutes, { summaryStore, socketManager });
  await app.register(projectsRoutes);

  // Serve uploaded files (images)
  const uploadDir = process.env['UPLOAD_DIR'] ?? './uploads';
  await app.register(uploadsRoutes, { uploadDir });

  // Start listening
  const address = await app.listen({ port: PORT, host: HOST });
  app.log.info(`[api] Server running on ${address}`);
  app.log.info(`[ws] WebSocket server ready`);
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
