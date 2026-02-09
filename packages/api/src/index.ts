/**
 * Cat Cafe API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes, callbacksRoutes, threadsRoutes, uploadsRoutes, projectsRoutes, tasksRoutes, summariesRoutes, exportRoutes, configRoutes, memoryRoutes, commandsRoutes, evidenceRoutes, memoryPublishRoutes } from './routes/index.js';
import { SocketManager } from './infrastructure/websocket/index.js';
import { InvocationRegistry } from './domains/cats/services/InvocationRegistry.js';
import { createMessageStore } from './domains/cats/services/MessageStoreFactory.js';
import { createRedisClient, SessionStore } from '@cat-cafe/shared/utils';
import { createThreadStore } from './domains/cats/services/ThreadStoreFactory.js';
import { createTaskStore } from './domains/cats/services/TaskStoreFactory.js';
import { createSummaryStore } from './domains/cats/services/SummaryStoreFactory.js';
import { createMemoryStore } from './domains/cats/services/MemoryStoreFactory.js';
import { InvocationTracker } from './domains/cats/services/InvocationTracker.js';
import { ClaudeAgentService, getEventAuditLog, AuditEventTypes, createHindsightClient, MemoryGovernanceStore } from './domains/cats/services/index.js';

import type { RedisClient } from '@cat-cafe/shared/utils';

const PORT = parseInt(process.env['API_SERVER_PORT'] ?? '3002', 10);
const HOST = process.env['API_SERVER_HOST'] ?? '127.0.0.1';

let socketManager: SocketManager | null = null;
let redisClient: RedisClient | null = null;

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
  redisClient = redis ?? null;
  const messageStore = createMessageStore(redis);
  const sessionStore = redis ? new SessionStore(redis) : undefined;
  const threadStore = createThreadStore(redis);
  const taskStore = createTaskStore(redis);
  const summaryStore = createSummaryStore(redis);
  const memoryStore = createMemoryStore(redis);

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
  await app.register(threadsRoutes, { threadStore, messageStore, taskStore, memoryStore });
  await app.register(tasksRoutes, { taskStore, socketManager });
  await app.register(summariesRoutes, { summaryStore, socketManager });
  await app.register(projectsRoutes);
  await app.register(exportRoutes, { messageStore, threadStore });
  await app.register(configRoutes);
  await app.register(memoryRoutes, { memoryStore });

  // Evidence search (Hindsight Recall + docs fallback)
  const hindsightClient = createHindsightClient();
  await app.register(evidenceRoutes, {
    hindsightClient,
    sharedBank: 'cat-cafe-shared',
  });

  // Memory governance (publish workflow)
  const governanceStore = new MemoryGovernanceStore();
  await app.register(memoryPublishRoutes, { governanceStore });

  // Commands route needs opus service for task extraction
  const opusService = new ClaudeAgentService();
  await app.register(commandsRoutes, { messageStore, taskStore, socketManager, opusService });

  // Serve uploaded files (images)
  const uploadDir = process.env['UPLOAD_DIR'] ?? './uploads';
  await app.register(uploadsRoutes, { uploadDir });

  // Start listening
  const address = await app.listen({ port: PORT, host: HOST });
  app.log.info(`[api] Server running on ${address}`);
  app.log.info(`[ws] WebSocket server ready`);

  // Log server startup to audit log (best-effort: don't crash if audit dir unwritable)
  const auditLog = getEventAuditLog();
  try {
    await auditLog.append({
      type: AuditEventTypes.SERVER_STARTED,
      data: { address, port: PORT, host: HOST, redis: redisClient ? 'connected' : 'memory' },
    });
  } catch (err) {
    app.log.warn(`[api] Audit log write failed (best-effort): ${String(err)}`);
  }

  // Graceful shutdown handler: persist Redis before exit
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      app.log.info(`[api] Received ${signal} while shutdown already in progress`);
      return;
    }
    shuttingDown = true;

    let exitCode = 0;
    try {
      app.log.info(`[api] Received ${signal}, shutting down gracefully...`);

      // Log shutdown to audit log FIRST (before any cleanup that might fail)
      try {
        await auditLog.append({
          type: AuditEventTypes.SERVER_SHUTDOWN,
          data: { signal, graceful: true },
        });
      } catch {
        // Audit log write failed, but continue with shutdown
      }

      // Trigger Redis BGSAVE to persist in-memory data before exit
      if (redisClient) {
        try {
          app.log.info('[api] Triggering Redis BGSAVE before shutdown...');
          await redisClient.bgsave();
          // Give Redis a moment to start the background save
          await new Promise((r) => setTimeout(r, 500));
          app.log.info('[api] Redis BGSAVE triggered');
        } catch (err) {
          app.log.error(`[api] Redis BGSAVE failed: ${String(err)}`);
        }
      }

      // Close WebSocket connections
      try {
        socketManager?.close();
      } catch (err) {
        exitCode = 1;
        app.log.error(`[api] SocketManager close failed: ${String(err)}`);
      }

      // Close Fastify server
      await app.close();
      app.log.info('[api] Shutdown complete');
    } catch (err) {
      exitCode = 1;
      app.log.error(`[api] Shutdown failed: ${String(err)}`);
    } finally {
      process.exit(exitCode);
    }
  };

  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
}

main().catch((err) => {
  console.error('[api] Fatal error:', err);
  process.exit(1);
});
