/**
 * MCP Callback Tools — 三猫共享的回传工具
 * 鉴权: process.env CAT_CAFE_INVOCATION_ID + CAT_CAFE_CALLBACK_TOKEN
 * 通信: HTTP → /api/callbacks/*
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { ToolResult } from './file-tools.js';
import { errorResult, successResult } from './file-tools.js';

// ============ Env-based Auth ============

function getCallbackConfig(): {
  apiUrl: string;
  invocationId: string;
  callbackToken: string;
} | null {
  const apiUrl = process.env['CAT_CAFE_API_URL'];
  const invocationId = process.env['CAT_CAFE_INVOCATION_ID'];
  const callbackToken = process.env['CAT_CAFE_CALLBACK_TOKEN'];

  if (!apiUrl || !invocationId || !callbackToken) {
    return null;
  }

  return { apiUrl, invocationId, callbackToken };
}

const NO_CONFIG_ERROR =
  'Cat Café callback not configured. Missing CAT_CAFE_API_URL, CAT_CAFE_INVOCATION_ID, or CAT_CAFE_CALLBACK_TOKEN environment variables.';

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];
const OUTBOX_FILE_SUFFIX = '.json';

interface CallbackPostFailure {
  error: string;
  retryable: boolean;
}

interface OutboxEntry {
  id: string;
  queuedAt: number;
  apiUrl: string;
  path: string;
  body: Record<string, unknown>;
  attempts: number;
  lastError: string;
}

function getRetryDelaysMs(): number[] {
  const raw = process.env['CAT_CAFE_CALLBACK_RETRY_DELAYS_MS'];
  if (!raw) return DEFAULT_RETRY_DELAYS_MS;
  const parsed = raw
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parsed.length > 0 ? parsed : DEFAULT_RETRY_DELAYS_MS;
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOutboxEnabled(): boolean {
  const raw = (process.env['CAT_CAFE_CALLBACK_OUTBOX_ENABLED'] ?? 'true').toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off';
}

function getOutboxDir(): string {
  const fromEnv = process.env['CAT_CAFE_CALLBACK_OUTBOX_DIR'];
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return join(homedir(), '.cat-cafe', 'callback-outbox');
}

async function enqueueOutbox(entry: OutboxEntry): Promise<string | null> {
  try {
    const dir = getOutboxDir();
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${entry.queuedAt}-${entry.id}${OUTBOX_FILE_SUFFIX}`);
    await writeFile(filePath, JSON.stringify(entry), 'utf8');
    return filePath;
  } catch {
    return null;
  }
}

function parseOutboxEntry(raw: string): OutboxEntry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<OutboxEntry>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.queuedAt !== 'number' ||
      typeof parsed.apiUrl !== 'string' ||
      typeof parsed.path !== 'string' ||
      typeof parsed.attempts !== 'number' ||
      typeof parsed.lastError !== 'string' ||
      typeof parsed.body !== 'object' ||
      parsed.body === null
    ) {
      return null;
    }
    return parsed as OutboxEntry;
  } catch {
    return null;
  }
}

async function flushOutbox(): Promise<void> {
  if (!isOutboxEnabled()) return;

  const dir = getOutboxDir();
  if (!existsSync(dir)) return;

  const retryDelaysMs = getRetryDelaysMs();
  const files = (await readdir(dir))
    .filter((name) => name.endsWith(OUTBOX_FILE_SUFFIX) && !name.endsWith('.processing'))
    .sort();

  for (const name of files) {
    const originalPath = join(dir, name);
    const processingPath = `${originalPath}.processing`;

    try {
      // Claim file (best-effort concurrent safety across processes).
      await rename(originalPath, processingPath);
    } catch {
      continue;
    }

    try {
      const raw = await readFile(processingPath, 'utf8');
      const entry = parseOutboxEntry(raw);
      if (!entry) {
        await unlink(processingPath);
        continue;
      }

      const replay = await postWithRetry(
        `${entry.apiUrl}${entry.path}`,
        JSON.stringify(entry.body),
        retryDelaysMs,
      );

      if (replay.ok) {
        await unlink(processingPath);
        continue;
      }

      if (!replay.failure.retryable) {
        // Poison message (4xx, auth, schema) — drop instead of infinite retry.
        await unlink(processingPath);
        continue;
      }

      const updated: OutboxEntry = {
        ...entry,
        attempts: entry.attempts + 1,
        lastError: replay.failure.error,
      };
      await writeFile(processingPath, JSON.stringify(updated), 'utf8');
      await rename(processingPath, originalPath);
    } catch {
      // If replay pipeline itself fails, move file back for next attempt.
      try {
        await rename(processingPath, originalPath);
      } catch {
        // Ignore: we'll retry on a later process run.
      }
    }
  }
}

async function postWithRetry(
  url: string,
  payload: string,
  retryDelaysMs: number[],
): Promise<{ ok: true; data: unknown } | { ok: false; failure: CallbackPostFailure }> {
  let lastError = 'Callback failed';
  let retryable = true;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (response.ok) {
        const data = await response.json();
        return { ok: true, data };
      }

      const text = await response.text();
      lastError = `Callback failed (${response.status}): ${text}`;
      retryable = shouldRetryStatus(response.status);
      const canRetry = retryable && attempt < retryDelaysMs.length;
      if (!canRetry) {
        return { ok: false, failure: { error: lastError, retryable } };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `Callback request failed: ${message}`;
      retryable = true;
      if (attempt >= retryDelaysMs.length) {
        return { ok: false, failure: { error: lastError, retryable } };
      }
    }

    await sleep(retryDelaysMs[attempt]!);
  }

  return { ok: false, failure: { error: lastError, retryable } };
}

// ============ HTTP helpers ============

async function callbackPost(
  path: string,
  body: Record<string, unknown>,
  options?: { enableOutbox?: boolean },
): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  const enableOutbox = options?.enableOutbox === true && isOutboxEnabled();
  if (enableOutbox) {
    await flushOutbox();
  }

  const url = `${config.apiUrl}${path}`;
  const requestBody = {
    invocationId: config.invocationId,
    callbackToken: config.callbackToken,
    ...body,
  };
  const payload = JSON.stringify(requestBody);
  const retryDelaysMs = getRetryDelaysMs();
  const result = await postWithRetry(url, payload, retryDelaysMs);
  if (result.ok) {
    return successResult(JSON.stringify(result.data));
  }

  if (enableOutbox && result.failure.retryable) {
    const queuedAt = Date.now();
    const entry: OutboxEntry = {
      id: randomUUID(),
      queuedAt,
      apiUrl: config.apiUrl,
      path,
      body: requestBody,
      attempts: 0,
      lastError: result.failure.error,
    };
    const queuedPath = await enqueueOutbox(entry);
    if (queuedPath) {
      return successResult(JSON.stringify({
        status: 'queued_for_retry',
        outboxId: entry.id,
        queuedAt,
      }));
    }
  }

  return errorResult(result.failure.error);
}

async function callbackGet(
  path: string,
  params?: Record<string, string>
): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  const query = new URLSearchParams({
    invocationId: config.invocationId,
    callbackToken: config.callbackToken,
    ...params,
  });

  const url = `${config.apiUrl}${path}?${query.toString()}`;
  try {
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return errorResult(`Callback failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return successResult(JSON.stringify(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Callback request failed: ${message}`);
  }
}

// ============ Tool Input Schemas ============
export const postMessageInputSchema = {
  content: z.string().min(1).describe('The message content to post'),
  replyTo: z
    .string()
    .optional()
    .describe('Optional message ID to reply to'),
  clientMessageId: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe('Optional idempotency key for at-least-once delivery de-duplication'),
};

export const getPendingMentionsInputSchema = {};

export const getThreadContextInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(20)
    .describe('Number of recent messages to retrieve (default: 20)'),
};

export const updateTaskInputSchema = {
  taskId: z.string().min(1).describe('The ID of the task to update'),
  status: z
    .enum(['todo', 'doing', 'blocked', 'done'])
    .optional()
    .describe('New task status'),
  why: z
    .string()
    .max(1000)
    .optional()
    .describe('Optional note explaining the status change'),
};

// ============ Tool Handlers ============

export async function handlePostMessage(input: {
  content: string;
  replyTo?: string | undefined;
  clientMessageId?: string | undefined;
}): Promise<ToolResult> {
  return callbackPost('/api/callbacks/post-message', {
    content: input.content,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    clientMessageId: input.clientMessageId ?? randomUUID(),
  }, { enableOutbox: true });
}

export async function handleGetPendingMentions(
  _input: Record<string, never>
): Promise<ToolResult> {
  return callbackGet('/api/callbacks/pending-mentions');
}

export async function handleGetThreadContext(input: {
  limit?: number;
}): Promise<ToolResult> {
  return callbackGet('/api/callbacks/thread-context', {
    ...(input.limit ? { limit: String(input.limit) } : {}),
  });
}

export async function handleUpdateTask(input: {
  taskId: string;
  status?: string | undefined;
  why?: string | undefined;
}): Promise<ToolResult> {
  return callbackPost('/api/callbacks/update-task', {
    taskId: input.taskId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.why ? { why: input.why } : {}),
  });
}

// ============ Tool Definitions ============

export const callbackTools = [
  {
    name: 'cat_cafe_post_message',
    description:
      'Post a message to the Cat Café chat. Use this to share results, respond to other cats, or communicate with the user.',
    inputSchema: postMessageInputSchema,
    handler: handlePostMessage,
  },
  {
    name: 'cat_cafe_get_pending_mentions',
    description:
      'Get recent messages that @-mention you. Use this to check if anyone is trying to get your attention.',
    inputSchema: getPendingMentionsInputSchema,
    handler: handleGetPendingMentions,
  },
  {
    name: 'cat_cafe_get_thread_context',
    description:
      'Get recent conversation messages for context. Use this to understand what has been discussed recently.',
    inputSchema: getThreadContextInputSchema,
    handler: handleGetThreadContext,
  },
  {
    name: 'cat_cafe_update_task',
    description:
      'Update the status of a task you own. Use this to mark tasks as doing/blocked/done.',
    inputSchema: updateTaskInputSchema,
    handler: handleUpdateTask,
  },
] as const;
