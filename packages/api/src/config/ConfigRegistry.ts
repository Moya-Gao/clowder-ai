/**
 * Config Registry
 * 收集所有运行时配置的快照，供 /config 命令展示。
 *
 * 纯函数，每次调用实时读取 (不缓存)。
 * 安全：Redis URL 不暴露，只显示连接状态。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { ContextBudget } from '@cat-cafe/shared';
import { getCatModel } from './cat-models.js';
import { getAllCatBudgets } from './cat-budgets.js';

export interface ConfigSnapshot {
  context: {
    /** @deprecated Use perCatBudgets for actual limits. This is assembleContext default. */
    maxMessages: number;
    /** @deprecated Use perCatBudgets for actual limits. */
    maxContentLength: number;
    /** @deprecated Use perCatBudgets for actual limits. This is assembleContext default, overridden per-cat at route time. */
    maxTotalChars: number;
    /** @deprecated Use perCatBudgets for actual limits. */
    maxPromptChars: number;
    note: string;
  };
  /** Per-cat context budgets (Phase 4.0) — the actual limits used at route time */
  perCatBudgets: Record<string, ContextBudget>;
  cli: {
    timeoutMs: number;
    killGraceMs: number;
  };
  storage: {
    messageTTL: string;
    threadTTL: string;
    taskTTL: string;
    maxMessages: number;
    maxThreads: number;
  };
  upload: {
    maxFileSize: string;
    maxFiles: number;
  };
  server: {
    port: number;
    host: string;
    redis: 'connected' | 'memory';
  };
  cats: Record<string, {
    displayName: string;
    provider: string;
    model: string;
    mcpSupport: boolean;
  }>;
  a2a: {
    enabled: boolean;
    maxDepth: number;
  };
  /** Memory store settings (F3-lite) */
  memory: {
    enabled: boolean;
    maxKeysPerThread: number;
  };
  /** Governance settings (4-D-lite) */
  governance: {
    degradationEnabled: boolean;
    doneTimeoutMs: number;
    heartbeatIntervalMs: number;
  };
  /** Deliberate mode status (4-E) */
  deliberate: {
    status: 'types_only';
  };
  /** Hindsight long-term memory integration (Phase 5.1) */
  hindsight: {
    enabled: boolean;
    baseUrl: string;
    sharedBank: string;
    recallDefaults: {
      budget: 'low' | 'mid' | 'high';
      tagsMatch: 'all_strict' | 'any_strict' | 'all' | 'any';
      limit: number;
    };
    retainPolicy: {
      narrativeFactRequired: boolean;
      minUsefulHorizonDays: number;
    };
    reflect: {
      dispositionMode: 'off' | 'template_only';
    };
  };
}

/**
 * Collect a snapshot of all runtime configuration values.
 * Sources: process.env + hardcoded defaults + CAT_CONFIGS.
 */
export function collectConfigSnapshot(): ConfigSnapshot {
  const env = process.env;

  // Context (from ContextAssembler defaults + env overrides)
  const maxMessages = Number(env['CONTEXT_HISTORY_LIMIT']) || 20;
  const maxContentLength = Number(env['MAX_CONTEXT_MSG_CHARS']) || 1500;
  const maxTotalChars = 8000;
  const maxPromptChars = Number(env['MAX_PROMPT_CHARS']) || 32000;

  // CLI (from cli-spawn.ts defaults, configurable via CLI_TIMEOUT_MS, 0 = disable)
  const rawCliTimeout = env['CLI_TIMEOUT_MS'];
  const parsedCliTimeout = rawCliTimeout != null && rawCliTimeout.trim() !== ''
    ? Number(rawCliTimeout)
    : NaN;
  const timeoutMs = Number.isFinite(parsedCliTimeout) && parsedCliTimeout >= 0
    ? parsedCliTimeout
    : 1_800_000;
  const killGraceMs = 3_000;

  // Storage (from Redis/memory store defaults)
  const messageTTL = '7 days';
  const threadTTL = '30 days';
  const taskTTL = '30 days';
  const maxMessagesStore = 2000;
  const maxThreads = 100;

  // Upload (from messages route)
  const maxFileSize = '10 MB';
  const maxFiles = 5;

  // Server
  const port = parseInt(env['API_SERVER_PORT'] ?? '3002', 10);
  const host = env['API_SERVER_HOST'] ?? '127.0.0.1';
  const redis: 'connected' | 'memory' = env['REDIS_URL'] ? 'connected' : 'memory';

  // Cats (with env override support)
  const cats: ConfigSnapshot['cats'] = {};
  for (const [id, config] of Object.entries(CAT_CONFIGS)) {
    const catName = id as 'opus' | 'codex' | 'gemini';
    cats[id] = {
      displayName: config.displayName,
      provider: config.provider,
      model: getCatModel(catName),
      mcpSupport: config.mcpSupport,
    };
  }

  // A2A
  const a2aMaxDepth = Number(env['MAX_A2A_DEPTH']) || 2;

  return {
    context: {
      maxMessages,
      maxContentLength,
      maxTotalChars,
      maxPromptChars,
      note: 'These are assembleContext defaults; see perCatBudgets for actual per-cat limits',
    },
    perCatBudgets: getAllCatBudgets(),
    cli: { timeoutMs, killGraceMs },
    storage: { messageTTL, threadTTL, taskTTL, maxMessages: maxMessagesStore, maxThreads },
    upload: { maxFileSize, maxFiles },
    server: { port, host, redis },
    cats,
    a2a: { enabled: true, maxDepth: a2aMaxDepth },
    memory: { enabled: true, maxKeysPerThread: 50 },
    governance: {
      degradationEnabled: true,
      doneTimeoutMs: 5 * 60 * 1000,
      heartbeatIntervalMs: 30_000,
    },
    deliberate: { status: 'types_only' },
    hindsight: {
      enabled: true,
      baseUrl: env['HINDSIGHT_URL'] ?? 'http://localhost:8888',
      sharedBank: 'cat-cafe-shared',
      recallDefaults: {
        budget: 'mid',
        tagsMatch: 'all_strict',
        limit: 5,
      },
      retainPolicy: {
        narrativeFactRequired: true,
        minUsefulHorizonDays: 180,
      },
      reflect: {
        dispositionMode: 'template_only',
      },
    },
  };
}
