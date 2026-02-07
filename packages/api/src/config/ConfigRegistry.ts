/**
 * Config Registry
 * 收集所有运行时配置的快照，供 /config 命令展示。
 *
 * 纯函数，每次调用实时读取 (不缓存)。
 * 安全：Redis URL 不暴露，只显示连接状态。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';

export interface ConfigSnapshot {
  context: {
    maxMessages: number;
    maxContentLength: number;
    maxTotalChars: number;
    maxPromptChars: number;
  };
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

  // CLI (from cli-spawn.ts defaults)
  const timeoutMs = 300_000;
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

  // Cats
  const cats: ConfigSnapshot['cats'] = {};
  for (const [id, config] of Object.entries(CAT_CONFIGS)) {
    cats[id] = {
      displayName: config.displayName,
      provider: config.provider,
      model: config.defaultModel,
      mcpSupport: config.mcpSupport,
    };
  }

  // A2A
  const a2aMaxDepth = Number(env['MAX_A2A_DEPTH']) || 2;

  return {
    context: { maxMessages, maxContentLength, maxTotalChars, maxPromptChars },
    cli: { timeoutMs, killGraceMs },
    storage: { messageTTL, threadTTL, taskTTL, maxMessages: maxMessagesStore, maxThreads },
    upload: { maxFileSize, maxFiles },
    server: { port, host, redis },
    cats,
    a2a: { enabled: true, maxDepth: a2aMaxDepth },
  };
}
