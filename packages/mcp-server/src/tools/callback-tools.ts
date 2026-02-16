/**
 * MCP Callback Tools — core callbacks
 * 鉴权: process.env CAT_CAFE_INVOCATION_ID + CAT_CAFE_CALLBACK_TOKEN
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ToolResult } from './file-tools.js';
import { errorResult, successResult } from './file-tools.js';
import { sendCallbackRequest } from './callback-outbox.js';

interface CallbackConfig {
  apiUrl: string;
  invocationId: string;
  callbackToken: string;
}

export function getCallbackConfig(): CallbackConfig | null {
  const apiUrl = process.env['CAT_CAFE_API_URL'];
  const invocationId = process.env['CAT_CAFE_INVOCATION_ID'];
  const callbackToken = process.env['CAT_CAFE_CALLBACK_TOKEN'];
  if (!apiUrl || !invocationId || !callbackToken) return null;
  return { apiUrl, invocationId, callbackToken };
}

export const NO_CONFIG_ERROR =
  'Cat Café callback not configured. Missing CAT_CAFE_API_URL, CAT_CAFE_INVOCATION_ID, or CAT_CAFE_CALLBACK_TOKEN environment variables.';
// ============ HTTP helpers ============

export async function callbackPost(
  path: string,
  body: Record<string, unknown>,
  options?: { enableOutbox?: boolean },
): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  const requestBody = {
    invocationId: config.invocationId,
    callbackToken: config.callbackToken,
    ...body,
  };

  const result = await sendCallbackRequest(
    { apiUrl: config.apiUrl, path, body: requestBody },
    { enableOutbox: options?.enableOutbox === true },
  );
  if (result.ok) return successResult(JSON.stringify(result.data));
  return errorResult(result.error);
}

export async function callbackGet(path: string, params?: Record<string, string>): Promise<ToolResult> {
  const config = getCallbackConfig();
  if (!config) return errorResult(NO_CONFIG_ERROR);

  const query = new URLSearchParams({
    invocationId: config.invocationId,
    callbackToken: config.callbackToken,
    ...params,
  });

  try {
    const response = await fetch(`${config.apiUrl}${path}?${query.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      return errorResult(`Callback failed (${response.status}): ${text}`);
    }
    return successResult(JSON.stringify(await response.json()));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Callback request failed: ${message}`);
  }
}

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

export const ackMentionsInputSchema = {
  upToMessageId: z
    .string()
    .min(1)
    .describe('The message ID up to which mentions have been processed. Must be within the last fetched pending window.'),
};

export const getThreadContextInputSchema = {
  limit: z.number().int().min(1).max(200).optional().default(20)
    .describe('Number of recent messages to retrieve (default: 20)'),
};

export const updateTaskInputSchema = {
  taskId: z.string().min(1).describe('The ID of the task to update'),
  status: z.enum(['todo', 'doing', 'blocked', 'done']).optional().describe('New task status'),
  why: z.string().max(1000).optional().describe('Optional note explaining the status change'),
};

export async function handlePostMessage(input: {
  content: string;
  replyTo?: string | undefined;
  clientMessageId?: string | undefined;
}): Promise<ToolResult> {
  const result = await callbackPost('/api/callbacks/post-message', {
    content: input.content,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    clientMessageId: input.clientMessageId ?? randomUUID(),
  }, { enableOutbox: true });

  // If callback expired/failed and message contains @mentions,
  // hint that the agent can mention cats directly in response text.
  if (result.isError && /[@＠]/.test(input.content)) {
    const hint = '\n\n💡 Tip: callback token 已过期。如果你想 @其他猫猫，' +
      '不需要用这个 MCP tool——直接在你的回复文本里另起一行写 @猫名 即可' +
      '（例如另起一行写 @缅因猫），系统会自动检测并触发。';
    return errorResult(
      (result.content[0] as { text: string }).text + hint,
    );
  }

  return result;
}

export async function handleGetPendingMentions(_input: Record<string, never>): Promise<ToolResult> {
  return callbackGet('/api/callbacks/pending-mentions');
}

export async function handleAckMentions(input: {
  upToMessageId: string;
}): Promise<ToolResult> {
  return callbackPost('/api/callbacks/ack-mentions', {
    upToMessageId: input.upToMessageId,
  });
}

export async function handleGetThreadContext(input: { limit?: number }): Promise<ToolResult> {
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

export const requestPermissionInputSchema = {
  action: z
    .string()
    .min(1)
    .describe('The action requiring permission (e.g. "git_commit", "file_delete")'),
  reason: z
    .string()
    .min(1)
    .describe('Why you need this permission'),
  context: z
    .string()
    .max(5000)
    .optional()
    .describe('Optional additional context for the request'),
};

export const checkPermissionStatusInputSchema = {
  requestId: z
    .string()
    .min(1)
    .describe('The requestId returned from a previous request_permission call'),
};

export async function handleRequestPermission(input: {
  action: string;
  reason: string;
  context?: string | undefined;
}): Promise<ToolResult> {
  return callbackPost('/api/callbacks/request-permission', {
    action: input.action,
    reason: input.reason,
    ...(input.context ? { context: input.context } : {}),
  });
}

export async function handleCheckPermissionStatus(input: {
  requestId: string;
}): Promise<ToolResult> {
  return callbackGet('/api/callbacks/permission-status', {
    requestId: input.requestId,
  });
}


export const callbackTools = [
  {
    name: 'cat_cafe_post_message',
    description: 'Post a message to the Cat Café chat. Use this to share results, respond to other cats, or communicate with the user.',
    inputSchema: postMessageInputSchema,
    handler: handlePostMessage,
  },
  {
    name: 'cat_cafe_get_pending_mentions',
    description: 'Get recent messages that @-mention you. Use this to check if anyone is trying to get your attention.',
    inputSchema: getPendingMentionsInputSchema,
    handler: handleGetPendingMentions,
  },
  {
    name: 'cat_cafe_ack_mentions',
    description: 'Acknowledge that you have processed mentions up to a specific message ID. Call this after processing mentions from get_pending_mentions to avoid seeing them again in future sessions.',
    inputSchema: ackMentionsInputSchema,
    handler: handleAckMentions,
  },
  {
    name: 'cat_cafe_get_thread_context',
    description: 'Get recent conversation messages for context. Use this to understand what has been discussed recently.',
    inputSchema: getThreadContextInputSchema,
    handler: handleGetThreadContext,
  },
  {
    name: 'cat_cafe_update_task',
    description: 'Update the status of a task you own. Use this to mark tasks as doing/blocked/done.',
    inputSchema: updateTaskInputSchema,
    handler: handleUpdateTask,
  },
  {
    name: 'cat_cafe_request_permission',
    description:
      'Request permission from the user before performing a sensitive action (e.g. git_commit, file_delete). Returns granted/denied immediately if a rule exists, or pending with a requestId if the user needs to approve.',
    inputSchema: requestPermissionInputSchema,
    handler: handleRequestPermission,
  },
  {
    name: 'cat_cafe_check_permission_status',
    description:
      'Check the status of a previously submitted permission request. Use the requestId returned from request_permission.',
    inputSchema: checkPermissionStatusInputSchema,
    handler: handleCheckPermissionStatus,
  },
] as const;
