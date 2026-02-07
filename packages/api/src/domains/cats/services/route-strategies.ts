/**
 * Route Strategies
 * 串行 (routeSerial) / 并行 (routeParallel) 执行策略
 *
 * 从 AgentRouter 提取的纯逻辑，减少 AgentRouter 体积 (379→~160 行)。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import { buildSystemPrompt } from './SystemPromptBuilder.js';
import { needsMcpInjection, buildMcpCallbackInstructions } from './McpPromptInjector.js';
import { invokeSingleCat } from './invoke-single-cat.js';
import type { InvocationDeps } from './invoke-single-cat.js';
import { mergeStreams } from './stream-merge.js';
import type { IMessageStore } from './MessageStore.js';
import type { AgentMessage, AgentMessageType, AgentService } from './types.js';
import type { MessageMetadata } from './types.js';
import { parseA2AMentions, MAX_A2A_DEPTH } from './a2a-mentions.js';

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
  /** Max A2A chain depth for routeSerial (default: MAX_A2A_DEPTH env or 2) */
  maxA2ADepth?: number | undefined;
}

/** Get the agent service for a given cat ID */
function getService(services: Record<string, AgentService>, catId: CatId): AgentService {
  const service = services[catId];
  if (!service) throw new Error(`Unknown cat ID: ${catId as string}`);
  return service;
}

/**
 * Serial execution: cats respond one by one, each seeing previous responses.
 *
 * A2A support: after each cat completes, its response is checked for @mentions.
 * If a mention is detected and depth allows, the mentioned cat is appended to the
 * worklist — extending the chain within the SAME function call. This preserves
 * previousResponses continuity and correct isFinal semantics (缅因猫 P1-1, P1-2).
 *
 * A2A only triggers here in routeSerial; routeParallel never chains (MVP safety boundary).
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
  const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];

  // Worklist pattern: starts with targetCats, may grow via A2A mentions
  const worklist = [...targetCats];
  let a2aCount = 0;
  const maxDepth = options.maxA2ADepth ?? MAX_A2A_DEPTH;

  let index = 0;
  while (index < worklist.length) {
    if (signal?.aborted) break;
    const catId = worklist[index]!;

    // Only pass images/uploads for the first cat (user's original target)
    const isOriginalTarget = index < targetCats.length;

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
      mode: worklist.length > 1 ? 'serial' : 'independent',
      chainIndex: index + 1,
      chainTotal: worklist.length,
      teammates: worklist.filter((id) => id !== catId),
      mcpAvailable: (catConfig?.mcpSupport ?? false) && !!mcpServerPath,
      ...(promptTags && promptTags.length > 0 ? { promptTags } : {}),
      a2aEnabled: a2aCount < maxDepth,
    });
    // Inject MCP HTTP callback instructions for non-Claude cats
    const mcpInstructions = needsMcpInjection(catId) && deps.invocationDeps.apiUrl
      ? buildMcpCallbackInstructions({ apiUrl: deps.invocationDeps.apiUrl })
      : '';

    if (systemPrompt || mcpInstructions) {
      const parts = [systemPrompt, mcpInstructions].filter(Boolean);
      if (contextHistory) parts.push(contextHistory);
      prompt = `${parts.join('\n\n---\n\n')}\n\n---\n\n${prompt}`;
    } else if (contextHistory) {
      prompt = `${contextHistory}\n\n---\n\n${prompt}`;
    }

    let textContent = '';
    let firstMetadata: MessageMetadata | undefined;
    let doneMsg: AgentMessage | undefined;

    // Always pass isLastCat:false — we set isFinal AFTER A2A detection
    for await (const msg of invokeSingleCat(deps.invocationDeps, {
      catId,
      service: getService(deps.services, catId),
      prompt,
      userId,
      threadId,
      ...(isOriginalTarget && contentBlocks ? { contentBlocks } : {}),
      ...(isOriginalTarget && uploadDir ? { uploadDir } : {}),
      ...(signal ? { signal } : {}),
      isLastCat: false,
    })) {
      if (msg.type === 'text' && msg.content) {
        textContent += msg.content;
      }
      if (msg.metadata && !firstMetadata) {
        firstMetadata = msg.metadata;
      }
      if (msg.type === 'done') {
        doneMsg = msg; // Buffer — yield after A2A detection
      } else {
        yield msg;
      }
    }

    if (textContent) {
      previousResponses.push({ catId, content: textContent });

      // A2A mention detection (缅因猫 P1-3: only after full text accumulated)
      const a2aMentions = parseA2AMentions(textContent, catId);

      // Store with actual mentions (replaces hardcoded [])
      await deps.messageStore.append({
        userId,
        catId,
        content: textContent,
        mentions: a2aMentions,
        timestamp: Date.now(),
        threadId,
        ...(firstMetadata ? { metadata: firstMetadata } : {}),
      });

      // A2A: extend worklist if mention found + depth allows
      if (a2aMentions.length > 0 && a2aCount < maxDepth && !signal?.aborted) {
        const nextCat = a2aMentions[0]!;
        worklist.push(nextCat);
        a2aCount++;

        // Notify frontend: handoff event
        const nextConfig = CAT_CONFIGS[nextCat as keyof typeof CAT_CONFIGS];
        yield {
          type: 'a2a_handoff' as AgentMessageType,
          catId,
          content: `${catConfig?.displayName ?? catId} → ${nextConfig?.displayName ?? nextCat}`,
          timestamp: Date.now(),
        } as AgentMessage;
      }
    } else {
      // No text content — still store empty mentions
      await deps.messageStore.append({
        userId,
        catId,
        content: '',
        mentions: [],
        timestamp: Date.now(),
        threadId,
        ...(firstMetadata ? { metadata: firstMetadata } : {}),
      });
    }

    // Yield buffered done with correct isFinal (evaluated AFTER worklist may have grown)
    if (doneMsg) {
      yield { ...doneMsg, isFinal: index === worklist.length - 1 };
    }

    index++;
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
    // Inject MCP HTTP callback instructions for non-Claude cats
    const mcpInstructions = needsMcpInjection(catId) && deps.invocationDeps.apiUrl
      ? buildMcpCallbackInstructions({ apiUrl: deps.invocationDeps.apiUrl })
      : '';

    let prompt: string;
    if (systemPrompt || mcpInstructions) {
      const parts = [systemPrompt, mcpInstructions].filter(Boolean);
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
        // A2A only triggers in routeSerial; routeParallel stores mentions
        // but never chains (MVP safety boundary — see Phase 3.9 design doc)
        const mentions = parseA2AMentions(text, msg.catId as CatId);
        await deps.messageStore.append({
          userId,
          catId: msg.catId as CatId,
          content: text,
          mentions,
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
