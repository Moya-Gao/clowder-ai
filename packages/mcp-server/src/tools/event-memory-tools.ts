/**
 * F227 PR-1 Task 4 — generic teleport MCP tool.
 *
 * cat_cafe_teleport(threadId, messageId) → POST /api/memory/teleport → socket
 * `thread:teleport` → Hub switches thread (if needed) + scrolls to the exact
 * message. Mirrors handleWorkspaceNavigate but for MESSAGE navigation
 * (thread-navigation cell), NOT repo file reveal — so it does NOT extend
 * cat_cafe_workspace_navigate (design gate).
 */
import { z } from 'zod';
import { callbackPost } from './callback-tools.js';
import type { ToolResult } from './file-tools.js';

export const teleportInputSchema = {
  threadId: z.string().min(1).describe('Target Cat Cafe thread id to teleport into.'),
  messageId: z
    .string()
    .min(1)
    .describe(
      'Exact message id to scroll to and highlight. Event Memory coordinate — a real message id, NOT an invocationId.',
    ),
  catId: z.string().min(1).optional().describe('Calling cat id for audit correlation.'),
  agentKeyCatId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Persistent-agent identity selector. Required for shared Antigravity MCP when CAT_CAFE_AGENT_KEY_FILES is configured.',
    ),
};

export async function handleTeleport(input: {
  threadId: string;
  messageId: string;
  catId?: string | undefined;
  agentKeyCatId?: string | undefined;
}): Promise<ToolResult> {
  return callbackPost(
    '/api/memory/teleport',
    {
      threadId: input.threadId,
      messageId: input.messageId,
      ...(input.catId ? { catId: input.catId } : {}),
    },
    { agentKeyCatId: input.agentKeyCatId },
  );
}

export const eventMemoryTools = [
  {
    name: 'cat_cafe_teleport',
    description:
      'Teleport the Hub to an exact thread message (threadId + messageId). ' +
      'Use to jump to where a cognitive-transition event happened — e.g. from an Event Memory / timeline entry to its source message. ' +
      'Result: the Hub switches to the thread if needed and scrolls + highlights the target message. ' +
      'GOTCHA: pass a real messageId (Event Memory coordinate), not an invocationId; shared persistent MCP callers pass agentKeyCatId; do not handwrite curl to /api/memory/teleport.',
    inputSchema: teleportInputSchema,
    handler: handleTeleport,
  },
] as const;
