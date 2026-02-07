/**
 * MCP Callback Tools — 三猫共享的回传工具
 * 鉴权: process.env CAT_CAFE_INVOCATION_ID + CAT_CAFE_CALLBACK_TOKEN
 * 通信: HTTP → /api/callbacks/*
 */

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

// ============ HTTP helpers ============

async function callbackPost(
  path: string,
  body: Record<string, unknown>
): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  const url = `${config.apiUrl}${path}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invocationId: config.invocationId,
        callbackToken: config.callbackToken,
        ...body,
      }),
    });

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
}): Promise<ToolResult> {
  return callbackPost('/api/callbacks/post-message', {
    content: input.content,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
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
