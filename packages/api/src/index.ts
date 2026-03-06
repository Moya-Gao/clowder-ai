/**
 * Cat Cafe API Server
 * 后端 API 入口
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { messagesRoutes, catsRoutes, callbacksRoutes, threadsRoutes, uploadsRoutes, projectsRoutes, tasksRoutes, backlogRoutes, summariesRoutes, exportRoutes, configRoutes, memoryRoutes, commandsRoutes, signalsRoutes, evidenceRoutes, memoryPublishRoutes, reflectRoutes, invocationsRoutes, messageActionsRoutes, threadBranchRoutes, auditRoutes, capabilitiesRoutes, callbackAuthRoutes, authorizationRoutes, modesRoutes, sessionChainRoutes, sessionTranscriptRoutes, sessionHooksRoutes, ttsRoutes, pushRoutes, registerCallbackDocsRoutes, sessionStrategyConfigRoutes, skillsRoutes, queueRoutes, quotaRoutes, providerProfilesRoutes, workspaceRoutes } from './routes/index.js';
import { join } from 'path';
import { generateCliConfigs, readCapabilitiesConfig } from './config/capabilities/capability-orchestrator.js';
import { threadExportRoutes } from './routes/thread-export.js';
import { TtsRegistry } from './domains/cats/services/tts/TtsRegistry.js';
import { createPushSubscriptionStore } from './domains/cats/services/stores/factories/PushSubscriptionStoreFactory.js';
import { initPushNotificationService } from './domains/cats/services/push/PushNotificationService.js';
import { MlxAudioTtsProvider } from './domains/cats/services/tts/MlxAudioTtsProvider.js';
import { startTtsCacheCleaner } from './domains/cats/services/tts/tts-cache-cleaner.js';
import { initVoiceBlockSynthesizer } from './domains/cats/services/tts/VoiceBlockSynthesizer.js';
import { SocketManager } from './infrastructure/websocket/index.js';
import { InvocationRegistry } from './domains/cats/services/agents/invocation/InvocationRegistry.js';
import { createMessageStore } from './domains/cats/services/stores/factories/MessageStoreFactory.js';
import { createRedisClient, SessionStore } from '@cat-cafe/shared/utils';
import { createThreadStore } from './domains/cats/services/stores/factories/ThreadStoreFactory.js';
import { createTaskStore } from './domains/cats/services/stores/factories/TaskStoreFactory.js';
import { createBacklogStore } from './domains/cats/services/stores/factories/BacklogStoreFactory.js';
import { createSummaryStore } from './domains/cats/services/stores/factories/SummaryStoreFactory.js';
import { createMemoryStore } from './domains/cats/services/stores/factories/MemoryStoreFactory.js';
import { InvocationTracker } from './domains/cats/services/agents/invocation/InvocationTracker.js';
import { InvocationQueue } from './domains/cats/services/agents/invocation/InvocationQueue.js';
import { QueueProcessor } from './domains/cats/services/agents/invocation/QueueProcessor.js';
import type { InvocationRecordStoreLike, RouterLike } from './domains/cats/services/agents/invocation/QueueProcessor.js';
import { createTaskProgressStore } from './domains/cats/services/agents/invocation/createTaskProgressStore.js';
import { catRegistry } from '@cat-cafe/shared';
import { loadCatConfig, toAllCatConfigs } from './config/cat-config-loader.js';
import { AgentRegistry } from './domains/cats/services/agents/registry/AgentRegistry.js';
import { ClaudeAgentService, CodexAgentService, GeminiAgentService, DareAgentService, AgentRouter, DeliveryCursorStore, getEventAuditLog, AuditEventTypes, createHindsightClient, MemoryGovernanceStore, createInvocationRecordStore, createSessionChainStore, createDraftStore } from './domains/cats/services/index.js';
import type { AgentService } from './domains/cats/services/types.js';
import { AuthorizationManager } from './domains/cats/services/auth/AuthorizationManager.js';
import { createAuthorizationRuleStore } from './domains/cats/services/stores/factories/AuthorizationRuleStoreFactory.js';
import { createPendingRequestStore } from './domains/cats/services/stores/factories/PendingRequestStoreFactory.js';
import { createAuthorizationAuditStore } from './domains/cats/services/stores/factories/AuthorizationAuditStoreFactory.js';
import { AutoSummarizer } from './domains/cats/services/orchestration/AutoSummarizer.js';
import { assertStorageReady } from './config/storage-guard.js';
import { resolveFrontendCorsOrigins } from './config/frontend-origin.js';
import { ModeStore } from './domains/cats/services/stores/ports/ModeStore.js';
import { ModeOrchestrator } from './domains/cats/services/orchestration/ModeOrchestrator.js';
import { TranscriptWriter } from './domains/cats/services/session/TranscriptWriter.js';
import { TranscriptReader } from './domains/cats/services/session/TranscriptReader.js';
import { SessionSealer } from './domains/cats/services/session/SessionSealer.js';
import { startGithubReviewWatcher, stopGithubReviewWatcher, MemoryPrTrackingStore, MemoryProcessedEmailStore, ReviewRouter, ConnectorInvokeTrigger } from './infrastructure/email/index.js';
import { prTrackingRoutes } from './routes/pr-tracking.js';
import { initRuntimeOverrides } from './config/session-strategy-overrides.js';

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
  const app = Fastify({
    logger: {
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
    },
  });

  // CORS for frontend
  await app.register(cors, {
    origin: resolveFrontendCorsOrigins(process.env, app.log),
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

  // Fail-closed: refuse to start without Redis unless explicitly opted into memory mode.
  // Also verify Redis is actually reachable (PING), not just configured.
  if (redis) {
    try {
      await redis.ping();
      app.log.info('[api] Redis PING OK');
    } catch (err) {
      await redis.quit().catch(() => {});
      throw new Error(
        `[api] Redis PING failed: ${err instanceof Error ? err.message : err}. `
        + 'Check REDIS_URL or set MEMORY_STORE=1 for memory mode.',
      );
    }
  }
  const storageResult = assertStorageReady(!!redis);
  app.log.info(`[api] Storage mode: ${storageResult.mode}`);

  const messageStore = createMessageStore(redis);
  const sessionStore = redis ? new SessionStore(redis) : undefined;
  const deliveryCursorStore = new DeliveryCursorStore(sessionStore);
  const threadStore = createThreadStore(redis);
  const taskStore = createTaskStore(redis);
  const backlogStore = createBacklogStore(redis);
  const summaryStore = createSummaryStore(redis);
  const memoryStore = createMemoryStore(redis);
  const taskProgressStore = createTaskProgressStore(redis);
  const invocationRecordStore = createInvocationRecordStore(redis);
  const draftStore = createDraftStore(redis);
  const sessionChainStore = createSessionChainStore(redis);
  // F24: Transcript Writer/Reader for session chain
  const transcriptDataDir = process.env['TRANSCRIPT_DATA_DIR'] ?? './data/transcripts';
  const transcriptWriter = new TranscriptWriter({ dataDir: transcriptDataDir });
  const transcriptReader = new TranscriptReader({ dataDir: transcriptDataDir });
  const sessionSealer = new SessionSealer(sessionChainStore, transcriptWriter);

  const sharedHindsightBank = 'cat-cafe-shared';
  const hindsightClient = createHindsightClient();

  // ── F32-b: Populate CatRegistry from cat-config.json (all variants) ──
  // Must happen BEFORE AgentRouter construction (parseMentions reads catRegistry)
  try {
    const catConfig = loadCatConfig();
    const allConfigs = toAllCatConfigs(catConfig);
    for (const [id, config] of Object.entries(allConfigs)) {
      catRegistry.register(id, config);
    }
    app.log.info(`[api] CatRegistry initialized: ${catRegistry.getAllIds().join(', ')}`);
  } catch (err) {
    app.log.warn(`[api] Failed to load cat-config.json, falling back to built-in CAT_CONFIGS: ${String(err)}`);
    // Fallback: register from static CAT_CONFIGS
    const { CAT_CONFIGS } = await import('@cat-cafe/shared');
    for (const [id, config] of Object.entries(CAT_CONFIGS)) {
      if (!catRegistry.has(id)) catRegistry.register(id, config);
    }
  }

  // ── F32-b: AgentRegistry (catId → AgentService) — one instance per cat ──
  // Each cat gets its own AgentService instance with its catId + model.
  const agentRegistry = new AgentRegistry();
  for (const id of catRegistry.getAllIds()) {
    const entry = catRegistry.tryGet(id as string);
    if (!entry) continue;
    const { provider } = entry.config;
    const catId = entry.config.id;
    // F32-b P1 fix: do NOT pass model here — let constructors resolve via
    // getCatModel(catId) which respects env override (CAT_*_MODEL > config > fallback)
    let service: AgentService;
    switch (provider) {
      case 'anthropic':
        service = new ClaudeAgentService({ catId });
        break;
      case 'openai':
        service = new CodexAgentService({ catId });
        break;
      case 'google':
        service = new GeminiAgentService({ catId });
        break;
      case 'dare':
        service = new DareAgentService({ catId });
        break;
      default:
        app.log.warn(`[api] Unknown provider "${provider}" for cat "${id as string}". It will not be routable.`);
        continue;
    }
    agentRegistry.register(id as string, service);
  }

  // Shared AgentRouter — used by messagesRoutes and invocationsRoutes
  const router = new AgentRouter({
    agentRegistry,
    registry,
    messageStore,
    taskProgressStore,
    ...(deliveryCursorStore ? { deliveryCursorStore } : {}),
    ...(sessionStore ? { sessionStore } : {}),
    ...(threadStore ? { threadStore } : {}),
    sessionChainStore,
    transcriptWriter,
    transcriptReader,
    sessionSealer,
    draftStore,
    taskStore,
  });

  const autoSummarizer = new AutoSummarizer({ messageStore, summaryStore });
  const modeStore = new ModeStore();
  const modeOrchestrator = new ModeOrchestrator({ modeStore, socketManager });

  // F39: Message queue delivery
  const invocationQueue = new InvocationQueue();
  const queueProcessor = new QueueProcessor({
    queue: invocationQueue,
    invocationTracker,
    invocationRecordStore: invocationRecordStore as unknown as InvocationRecordStoreLike,
    router: router as unknown as RouterLike,
    socketManager,
    messageStore,
    log: app.log,
  });

  // Register routes (socketManager injected, no circular import)
  await app.register(messagesRoutes, {
    registry,
    messageStore,
    socketManager,
    router,
    deliveryCursorStore,
    ...(sessionStore ? { sessionStore } : {}),
    threadStore,
    invocationTracker,
    invocationRecordStore,
    autoSummarizer,
    summaryStore,
    draftStore,
    modeStore,
    modeOrchestrator,
    invocationQueue,
    queueProcessor,
  });
  await app.register(queueRoutes, {
    threadStore,
    invocationQueue,
    queueProcessor,
    invocationTracker,
    socketManager,
  });
  await app.register(invocationsRoutes, {
    invocationRecordStore,
    messageStore,
    socketManager,
    router,
    invocationTracker,
    queueProcessor,
  });
  await app.register(messageActionsRoutes, {
    messageStore,
    socketManager,
    threadStore,
  });
  await app.register(catsRoutes);
  await app.register(quotaRoutes);

  // TD091: Create prTrackingStore early so callbacks can use it for MCP registration
  const prTrackingStore = new MemoryPrTrackingStore();

  await app.register(callbacksRoutes, {
    registry,
    messageStore,
    socketManager,
    taskStore,
    backlogStore,
    threadStore,
    hindsightClient,
    sharedBank: sharedHindsightBank,
    router,
    invocationRecordStore,
    invocationTracker,
    deliveryCursorStore,
    prTrackingStore,
  });

  // Authorization system — 猫猫动态权限 (Redis-backed when available)
  const authRuleStore = createAuthorizationRuleStore(redis);
  const authPendingStore = createPendingRequestStore(redis);
  const authAuditStore = createAuthorizationAuditStore(redis);
  const authManager = new AuthorizationManager({
    ruleStore: authRuleStore,
    pendingStore: authPendingStore,
    auditStore: authAuditStore,
    io: socketManager.getIO(),
  });
  await app.register(callbackAuthRoutes, { registry, authManager });
  await app.register(authorizationRoutes, {
    authManager,
    ruleStore: authRuleStore,
    auditStore: authAuditStore,
    socketManager,
  });
  await app.register(threadsRoutes, {
    threadStore,
    messageStore,
    taskStore,
    memoryStore,
    deliveryCursorStore,
    invocationTracker,
    draftStore,
    taskProgressStore,
  });
  await app.register(threadBranchRoutes, {
    threadStore,
    messageStore,
    socketManager,
  });
  await app.register(threadExportRoutes, { threadStore });
  await app.register(tasksRoutes, { taskStore, socketManager });
  await app.register(backlogRoutes, { backlogStore, threadStore, messageStore });
  await app.register(summariesRoutes, { summaryStore, socketManager });
  await app.register(projectsRoutes);
  await app.register(exportRoutes, { messageStore, threadStore });
  await app.register(configRoutes);
  await app.register(providerProfilesRoutes);
  await app.register(auditRoutes, { threadStore });
  await app.register(capabilitiesRoutes);
  await app.register(workspaceRoutes);
  await app.register(skillsRoutes);
  await app.register(memoryRoutes, { memoryStore, threadStore });

  // Session chain (F24)
  await app.register(sessionChainRoutes, { sessionChainStore, threadStore });
  await app.register(sessionTranscriptRoutes, { sessionChainStore, threadStore, transcriptReader });
  const hookToken = process.env['CAT_CAFE_HOOK_TOKEN'] || '';
  await app.register(sessionHooksRoutes, {
    sessionChainStore,
    sessionSealer,
    transcriptReader,
    ...(hookToken ? { hookToken } : {}),
  });

  // F33 Phase 3: Session strategy config (runtime overrides via Redis)
  if (redis) {
    try {
      await initRuntimeOverrides(redis);
      app.log.info('[api] Session strategy runtime overrides hydrated from Redis');
    } catch (err) {
      app.log.warn(`[api] Session strategy hydration failed (best-effort, continuing with empty cache): ${String(err)}`);
    }
  }
  await app.register(sessionStrategyConfigRoutes);

  // Mode system (F11)
  await app.register(modesRoutes, { modeStore, threadStore, socketManager });

  // Evidence search (Hindsight Recall + docs fallback)
  await app.register(evidenceRoutes, {
    hindsightClient,
    sharedBank: sharedHindsightBank,
  });

  // Reflect (Hindsight LLM reflection)
  await app.register(reflectRoutes, {
    hindsightClient,
    sharedBank: sharedHindsightBank,
  });

  // Memory governance (publish workflow)
  const governanceStore = new MemoryGovernanceStore();
  await app.register(memoryPublishRoutes, { governanceStore });

  // Commands route needs opus service for task extraction
  const opusService = new ClaudeAgentService();
  await app.register(commandsRoutes, {
    messageStore,
    taskStore,
    socketManager,
    opusService,
    threadStore,
  });
  await app.register(signalsRoutes);

  // Serve uploaded files (images)
  const uploadDir = process.env['UPLOAD_DIR'] ?? './uploads';
  await app.register(uploadsRoutes, { uploadDir });

  // F34: TTS Provider (mlx-audio → Python TTS server)
  const ttsRegistry = new TtsRegistry();
  const ttsUrl = process.env['TTS_URL'] ?? 'http://localhost:9877';
  ttsRegistry.register(new MlxAudioTtsProvider({ baseUrl: ttsUrl }));
  const ttsCacheDir = process.env['TTS_CACHE_DIR'] ?? './data/tts-cache';
  await app.register(ttsRoutes, { ttsRegistry, cacheDir: ttsCacheDir });
  initVoiceBlockSynthesizer(ttsRegistry, ttsCacheDir);
  startTtsCacheCleaner(ttsCacheDir);

  // C1+C2: Web Push Notifications (optional — requires VAPID keys)
  const vapidPublicKey = process.env['VAPID_PUBLIC_KEY'] ?? '';
  const vapidPrivateKey = process.env['VAPID_PRIVATE_KEY'] ?? '';
  const vapidSubject = process.env['VAPID_SUBJECT'] ?? 'mailto:cat-cafe@localhost';
  const pushSubscriptionStore = createPushSubscriptionStore(redis);
  const pushService = vapidPublicKey && vapidPrivateKey
    ? initPushNotificationService({
        subscriptionStore: pushSubscriptionStore,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject,
      })
    : null;
  if (pushService) {
    app.log.info('[api] Web Push enabled (VAPID configured)');
  } else {
    app.log.info('[api] Web Push disabled (VAPID keys not set)');
  }
  await app.register(pushRoutes, { pushSubscriptionStore, pushService, vapidPublicKey });

  // F-BLOAT: Progressive disclosure docs endpoints (no auth, static content)
  await app.register(registerCallbackDocsRoutes);

  // GitHub Review Watcher stores + routes (BACKLOG #81)
  // Must register routes BEFORE app.listen()
  const processedEmailStore = new MemoryProcessedEmailStore();
  const reviewRouter = new ReviewRouter({
    prTrackingStore,
    processedEmailStore,
    threadStore,
    messageStore,
    socketManager,
    log: app.log,
    defaultUserId: 'default-user',
  });
  await app.register(prTrackingRoutes, { prTrackingStore });

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

  // Best-effort: regenerate CLI configs at startup so .gemini/settings.json
  // always has the latest env placeholders (Gemini MCP env injection)
  try {
    const root = process.cwd();
    const capConfig = await readCapabilitiesConfig(root);
    if (capConfig) {
      await generateCliConfigs(capConfig, {
        anthropic: join(root, '.mcp.json'),
        openai: join(root, '.codex', 'config.toml'),
        google: join(root, '.gemini', 'settings.json'),
      });
      app.log.info('[api] CLI configs regenerated at startup');
    }
  } catch (err) {
    app.log.warn(`[api] CLI config regeneration failed (best-effort): ${String(err)}`);
  }

  // Phase 3b: connector invoke trigger (auto-invoke cat after review email routing)
  const invokeTrigger = new ConnectorInvokeTrigger({
    router,
    socketManager,
    invocationRecordStore,
    invocationTracker,
    invocationQueue,
    queueProcessor,
    log: app.log,
  });

  // Start email watcher AFTER listen (non-blocking, best-effort)
  await startGithubReviewWatcher({
    log: app.log,
    reviewRouter,
    invokeTrigger,
  });

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

      // Stop GitHub review watcher
      try {
        await stopGithubReviewWatcher();
      } catch (err) {
        app.log.error(`[api] GithubReviewWatcher stop failed: ${String(err)}`);
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
