/**
 * Route Strategies
 * 串行 (routeSerial) / 并行 (routeParallel) 执行策略
 *
 * 从 AgentRouter 提取的纯逻辑，减少 AgentRouter 体积 (379→~160 行)。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import { buildSystemPrompt } from './SystemPromptBuilder.js';
import { invokeSingleCat } from './invoke-single-cat.js';
import type { InvocationDeps } from './invoke-single-cat.js';
import { mergeStreams } from './stream-merge.js';
import type { IMessageStore } from './MessageStore.js';
import type { AgentMessage, AgentService } from './types.js';
import type { MessageMetadata } from './types.js';

/** Dependencies shared across route strategies */
export interface RouteStrategyDeps {
  services: Record<string, AgentService>;
  invocationDeps: InvocationDeps;
  messageStore: IMessageStore;
}

/** Common options for both strategies */
export interface RouteOptions {
  contentBlocks?: readonly MessageContent[] | undefined;
  uploadDir?: string | undefined;
  signal?: AbortSignal | undefined;
  promptTags?: readonly string[] | undefined;
  contextHistory?: string | undefined;
}

/** Get the agent service for a given cat ID */
function getService(services: Record<string, AgentService>, catId: CatId): AgentService {
  const service = services[catId];
  if (!service) throw new Error(`Unknown cat ID: ${catId as string}`);
  return service;
}

/**
 * Serial execution: cats respond one by one, each seeing previous responses.
 */
export async function* routeSerial(
  deps: RouteStrategyDeps,
  targetCats: CatId[],
  message: string,
  userId: string,
  threadId: string,
  options: RouteOptions = {},
): AsyncIterable<AgentMessage> {
  const { contentBlocks, uploadDir, signal, promptTags, contextHistory } = options;
  const previousResponses: { catId: CatId; content: string }[] = [];
  const totalCats = targetCats.length;
  const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];

  for (const [index, catId] of targetCats.entries()) {
    if (signal?.aborted) break;

    let prompt = message;
    if (previousResponses.length > 0) {
      const contextParts = previousResponses.map(
        (r) => `[${r.catId} responded: ${r.content}]`
      );
      prompt = `${message}\n\n${contextParts.join('\n')}`;
    }

    // Build identity system prompt
    const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
    const systemPrompt = buildSystemPrompt({
      catId,
      mode: totalCats > 1 ? 'serial' : 'independent',
      chainIndex: index + 1,
      chainTotal: totalCats,
      teammates: targetCats.filter((id) => id !== catId),
      mcpAvailable: (catConfig?.mcpSupport ?? false) && !!mcpServerPath,
      ...(promptTags && promptTags.length > 0 ? { promptTags } : {}),
    });
    if (systemPrompt) {
      const parts = [systemPrompt];
      if (contextHistory) parts.push(contextHistory);
      prompt = `${parts.join('\n\n---\n\n')}\n\n---\n\n${prompt}`;
    } else if (contextHistory) {
      prompt = `${contextHistory}\n\n---\n\n${prompt}`;
    }

    let textContent = '';
    let firstMetadata: MessageMetadata | undefined;

    for await (const msg of invokeSingleCat(deps.invocationDeps, {
      catId,
      service: getService(deps.services, catId),
      prompt,
      userId,
      threadId,
      ...(contentBlocks ? { contentBlocks } : {}),
      ...(uploadDir ? { uploadDir } : {}),
      ...(signal ? { signal } : {}),
      isLastCat: index === totalCats - 1,
    })) {
      if (msg.type === 'text' && msg.content) {
        textContent += msg.content;
      }
      if (msg.metadata && !firstMetadata) {
        firstMetadata = msg.metadata;
      }
      yield msg;
    }

    if (textContent) {
      previousResponses.push({ catId, content: textContent });
      await deps.messageStore.append({
        userId,
        catId,
        content: textContent,
        mentions: [],
        timestamp: Date.now(),
        threadId,
        ...(firstMetadata ? { metadata: firstMetadata } : {}),
      });
    }
  }
}

/**
 * Parallel execution: all cats respond independently to the same message.
 */
export async function* routeParallel(
  deps: RouteStrategyDeps,
  targetCats: CatId[],
  message: string,
  userId: string,
  threadId: string,
  options: RouteOptions = {},
): AsyncIterable<AgentMessage> {
  const { contentBlocks, uploadDir, signal, promptTags, contextHistory } = options;
  const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];

  const streams = targetCats.map((catId) => {
    const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
    const systemPrompt = buildSystemPrompt({
      catId,
      mode: 'parallel',
      teammates: targetCats.filter((id) => id !== catId),
      mcpAvailable: (catConfig?.mcpSupport ?? false) && !!mcpServerPath,
      ...(promptTags && promptTags.length > 0 ? { promptTags } : {}),
    });
    let prompt: string;
    if (systemPrompt) {
      const parts = [systemPrompt];
      if (contextHistory) parts.push(contextHistory);
      prompt = `${parts.join('\n\n---\n\n')}\n\n---\n\n${message}`;
    } else if (contextHistory) {
      prompt = `${contextHistory}\n\n---\n\n${message}`;
    } else {
      prompt = message;
    }

    return invokeSingleCat(deps.invocationDeps, {
      catId,
      service: getService(deps.services, catId),
      prompt,
      userId,
      threadId,
      ...(contentBlocks ? { contentBlocks } : {}),
      ...(uploadDir ? { uploadDir } : {}),
      ...(signal ? { signal } : {}),
      isLastCat: false,
    });
  });

  const catText = new Map<string, string>();
  const catMeta = new Map<string, MessageMetadata>();
  let completedCount = 0;

  for await (const msg of mergeStreams(streams, (idx, err) => {
    console.error(`[routeParallel] Stream ${idx} error:`, err);
  })) {
    if (msg.type === 'text' && msg.content && msg.catId) {
      catText.set(msg.catId, (catText.get(msg.catId) ?? '') + msg.content);
    }
    if (msg.metadata && msg.catId && !catMeta.has(msg.catId)) {
      catMeta.set(msg.catId, msg.metadata);
    }

    if (msg.type === 'done' && msg.catId) {
      completedCount++;
      const text = catText.get(msg.catId);
      if (text) {
        const meta = catMeta.get(msg.catId);
        await deps.messageStore.append({
          userId,
          catId: msg.catId as CatId,
          content: text,
          mentions: [],
          timestamp: Date.now(),
          threadId,
          ...(meta ? { metadata: meta } : {}),
        });
      }
      yield { ...msg, isFinal: completedCount === targetCats.length };
    } else {
      yield msg;
    }
  }
}
