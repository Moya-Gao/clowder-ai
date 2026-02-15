/**
 * Route Strategies
 * 串行 (routeSerial) / 并行 (routeParallel) 执行策略
 *
 * 从 AgentRouter 提取的纯逻辑，减少 AgentRouter 体积 (379→~160 行)。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import { buildStaticIdentity, buildInvocationContext } from './SystemPromptBuilder.js';
import { needsMcpInjection, buildMcpCallbackInstructions } from './McpPromptInjector.js';
import { invokeSingleCat } from './invoke-single-cat.js';
import type { InvocationDeps } from './invoke-single-cat.js';
import { mergeStreams } from './stream-merge.js';
import type { IMessageStore, StoredMessage } from './MessageStore.js';
import { DeliveryCursorStore } from './DeliveryCursorStore.js';
import type { AgentMessage, AgentMessageType, AgentService } from './types.js';
import type { MessageMetadata } from './types.js';
import { parseA2AMentions, getMaxA2ADepth } from './a2a-mentions.js';
import { assembleContext, formatMessage } from './ContextAssembler.js';
import { getCatContextBudget } from '../../../config/cat-budgets.js';
import { estimateTokens } from '../../../utils/token-counter.js';
import { getEventAuditLog, AuditEventTypes } from './EventAuditLog.js';
import { checkContextBudget, formatDegradationMessage, type DegradationResult } from './DegradationPolicy.js';
import { buildSessionBootstrap } from './SessionBootstrap.js';
import { isSessionChainEnabled } from '../../../config/cat-config-loader.js';

/** Dependencies shared across route strategies */
export interface RouteStrategyDeps {
  services: Record<string, AgentService>;
  invocationDeps: InvocationDeps;
  messageStore: IMessageStore;
  deliveryCursorStore?: DeliveryCursorStore;
}

/** Mutable context for tracking persistence failures across the generator boundary.
 *  Caller creates the object, passes it in RouteOptions, and checks after generator exhausts. */
export interface PersistenceContext {
  /** Set to true by route strategies when any messageStore.append() call fails */
  failed: boolean;
  /** Error details for diagnostics */
  errors: Array<{ catId: string; error: string }>;
}

/** Common options for both strategies */
export interface RouteOptions {
  contentBlocks?: readonly MessageContent[] | undefined;
  uploadDir?: string | undefined;
  signal?: AbortSignal | undefined;
  promptTags?: readonly string[] | undefined;
  /** Pre-assembled context (deprecated: use history for per-cat budget) */
  contextHistory?: string | undefined;
  /** Raw thread history for per-cat context assembly */
  history?: StoredMessage[] | undefined;
  /** Current user message ID (enables exact incremental context delivery path) */
  currentUserMessageId?: string | undefined;
  /** Max A2A chain depth for routeSerial (default: MAX_A2A_DEPTH env or 2) */
  maxA2ADepth?: number | undefined;
  /** ADR-008 S3: When provided, cursor boundaries are collected here instead of acking immediately.
   *  Caller acks after invocation succeeds. If absent, legacy immediate ack behavior. */
  cursorBoundaries?: Map<string, string>;
  /** P1-2: When provided, persistence failures are recorded here instead of silently swallowed.
   *  Caller checks after generator exhausts to determine invocation status. */
  persistenceContext?: PersistenceContext;
  /** F11: Mode-specific system prompt section (appended after identity prompt) */
  modeSystemPrompt?: string | undefined;
  /** F11: Per-cat mode prompt override (takes precedence over modeSystemPrompt) */
  modeSystemPromptByCat?: Record<string, string> | undefined;
}

/** Get the agent service for a given cat ID */
function getService(services: Record<string, AgentService>, catId: CatId): AgentService {
  const service = services[catId];
  if (!service) throw new Error(`Unknown cat ID: ${catId as string}`);
  return service;
}

function detectContextDegradation(
  historyCount: number,
  includedCount: number,
  budget: ReturnType<typeof getCatContextBudget>,
): DegradationResult | null {
  // Existing count-based degradation logic
  const byCount = checkContextBudget(historyCount, budget);
  if (byCount.degraded) return byCount;

  // Additional char-budget degradation: history count is within budget, but content still got truncated.
  const maxCountCandidate = Math.min(historyCount, budget.maxMessages);
  if (includedCount < maxCountCandidate) {
    return {
      degraded: true,
      strategy: 'truncated',
      reason: `Token 预算限制，历史从 ${maxCountCandidate} 条截断到 ${includedCount} 条`,
      adjustedMaxMessages: includedCount,
    };
  }

  return null;
}

function sanitizeInjectedContent(content: string): string {
  const lines = content.split('\n');
  const kept: string[] = [];
  let skippingHistoryEnvelope = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isHistoryHeader = line.startsWith('[对话历史 - 最近 ')
      || line.startsWith('[对话历史增量 - 未发送过 ');

    if (!skippingHistoryEnvelope && isHistoryHeader) {
      // Drop known injected history envelopes only.
      skippingHistoryEnvelope = true;
      continue;
    }

    if (skippingHistoryEnvelope) {
      if (trimmed === '---') {
        skippingHistoryEnvelope = false;
      }
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n').trim();
}

/**
 * Route content blocks to the target cat.
 * All cats receive the full content blocks including images —
 * each AgentService (Claude/Codex/Gemini) handles image paths
 * via its own CLI bridge (--add-dir / --image / --include-directories).
 */
function routeContentBlocksForCat(
  _catId: CatId,
  contentBlocks: readonly MessageContent[] | undefined,
): readonly MessageContent[] | undefined {
  return contentBlocks ?? undefined;
}

async function fetchAfterCursor(
  messageStore: IMessageStore,
  threadId: string,
  afterId: string | undefined,
  userId: string,
): Promise<StoredMessage[]> {
  return messageStore.getByThreadAfter(threadId, afterId, undefined, userId);
}

interface IncrementalContextResult {
  contextText: string;
  boundaryId?: string;
  includesCurrentUserMessage: boolean;
}

async function assembleIncrementalContext(
  deps: RouteStrategyDeps,
  userId: string,
  threadId: string,
  catId: CatId,
  currentUserMessageId?: string,
): Promise<IncrementalContextResult> {
  if (!deps.deliveryCursorStore) {
    return { contextText: '', includesCurrentUserMessage: false };
  }

  const cursor = await deps.deliveryCursorStore.getCursor(userId, catId, threadId);
  const unseen = await fetchAfterCursor(deps.messageStore, threadId, cursor, userId);

  const relevant = unseen.filter((m) => m.catId === null || m.catId !== catId);
  const includesCurrentUserMessage = Boolean(
    currentUserMessageId && relevant.some((m) => m.id === currentUserMessageId),
  );
  if (relevant.length === 0) {
    return cursor
      ? { contextText: '', boundaryId: cursor, includesCurrentUserMessage }
      : { contextText: '', includesCurrentUserMessage };
  }

  const lines = relevant.map((m) => {
    const cleanContent = sanitizeInjectedContent(m.content);
    const normalized: StoredMessage = cleanContent === m.content
      ? m
      : { ...m, content: cleanContent };
    const rendered = formatMessage(normalized, { truncate: 2000 });
    return `[${m.id}] ${rendered}`;
  });

  const boundaryId = relevant[relevant.length - 1]!.id;
  return {
    contextText: `[对话历史增量 - 未发送过 ${relevant.length} 条]\n${lines.join('\n')}\n---`,
    boundaryId,
    includesCurrentUserMessage,
  };
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
  const {
    contentBlocks,
    uploadDir,
    signal,
    promptTags,
    contextHistory,
    history,
    currentUserMessageId,
    modeSystemPrompt,
    modeSystemPromptByCat,
  } = options;
  const previousResponses: { catId: CatId; content: string }[] = [];
  const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];
  const incrementalMode = Boolean(currentUserMessageId && deps.deliveryCursorStore);

  // Worklist pattern: starts with targetCats, may grow via A2A mentions
  const worklist = [...targetCats];
  let a2aCount = 0;
  const maxDepth = options.maxA2ADepth ?? getMaxA2ADepth();

  let index = 0;
  while (index < worklist.length) {
    if (signal?.aborted) break;
    const catId = worklist[index]!;

    // Only pass images/uploads for the first cat (user's original target)
    const isOriginalTarget = index < targetCats.length;
    const targetContentBlocks = isOriginalTarget
      ? routeContentBlocksForCat(catId, contentBlocks)
      : undefined;
    const targetUploadDir = targetContentBlocks ? uploadDir : undefined;

    let prompt = message;
    if (!incrementalMode && previousResponses.length > 0) {
      const contextParts = previousResponses.map(
        (r) => `[${r.catId} responded: ${r.content}]`
      );
      prompt = `${message}\n\n${contextParts.join('\n')}`;
    }

    // Build identity: static goes via systemPrompt option, dynamic goes in -p content
    const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
    const staticIdentity = buildStaticIdentity(catId);
    const invocationContext = buildInvocationContext({
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

    // F24 Phase E: Bootstrap context for Session #2+
    let bootstrapContext = '';
    if (isSessionChainEnabled(catId) && deps.invocationDeps.sessionChainStore && deps.invocationDeps.transcriptReader) {
      try {
        const bootstrap = await buildSessionBootstrap(
          {
            sessionChainStore: deps.invocationDeps.sessionChainStore,
            transcriptReader: deps.invocationDeps.transcriptReader,
          },
          catId,
          threadId,
        );
        if (bootstrap) {
          bootstrapContext = bootstrap.text;
        }
      } catch {
        // Best-effort: bootstrap failure doesn't block invocation
      }
    }

    let deliveryBoundaryId: string | undefined;
    if (incrementalMode) {
      // Serial incremental mode depends on AgentRouter having appended current user message first.
      // We still explicitly include `message` when that message is not present in unseen rows.
      const inc = await assembleIncrementalContext(
        deps,
        userId,
        threadId,
        catId,
        currentUserMessageId,
      );
      deliveryBoundaryId = inc.boundaryId;
      const catModePrompt = modeSystemPromptByCat?.[catId as string] ?? modeSystemPrompt;
      const parts = [invocationContext, catModePrompt, bootstrapContext, mcpInstructions].filter(Boolean);
      if (inc.contextText) parts.push(inc.contextText);
      if (!inc.includesCurrentUserMessage) parts.push(message);
      prompt = parts.join('\n\n---\n\n');
    } else {
      // Per-cat context budget (Phase 4.0): assemble context with cat-specific limits
      let catContextHistory = contextHistory; // fallback to legacy pre-assembled
      if (history && history.length > 0 && !contextHistory) {
        const catName = catId as 'opus' | 'codex' | 'gemini';
        const budget = getCatContextBudget(catName);
        // F8: token-based budget — estimate non-context tokens, remainder goes to context
        const systemPartsTokens = estimateTokens(
          [staticIdentity, invocationContext, mcpInstructions].filter(Boolean).join('\n'),
        );
        const promptTokens = estimateTokens(prompt);
        const budgetForContext = Math.max(0, budget.maxPromptTokens - systemPartsTokens - promptTokens - 200);
        const { contextText, messageCount } = assembleContext(history, {
          maxMessages: budget.maxMessages,
          maxContentLength: budget.maxContentLengthPerMsg,
          maxTotalTokens: Math.min(budgetForContext, budget.maxContextTokens),
        });
        catContextHistory = contextText || undefined;

        // Degradation check: notify user if context was truncated (count budget or char budget)
        const degradation = detectContextDegradation(history.length, messageCount, budget);
        if (degradation?.degraded) {
          yield {
            type: 'system_info' as AgentMessageType,
            catId,
            content: formatDegradationMessage(degradation),
            timestamp: Date.now(),
          } as AgentMessage;
        }
      }

      const catModePromptLegacy = modeSystemPromptByCat?.[catId as string] ?? modeSystemPrompt;
      if (invocationContext || catModePromptLegacy || mcpInstructions || bootstrapContext) {
        const parts = [invocationContext, catModePromptLegacy, bootstrapContext, mcpInstructions].filter(Boolean);
        if (catContextHistory) parts.push(catContextHistory);
        prompt = `${parts.join('\n\n---\n\n')}\n\n---\n\n${prompt}`;
      } else if (catContextHistory) {
        prompt = `${catContextHistory}\n\n---\n\n${prompt}`;
      }
    }

    let textContent = '';
    let firstMetadata: MessageMetadata | undefined;
    let doneMsg: AgentMessage | undefined;
    let hadError = false;

    // Always pass isLastCat:false — we set isFinal AFTER A2A detection
    for await (const msg of invokeSingleCat(deps.invocationDeps, {
      catId,
      service: getService(deps.services, catId),
      prompt,
      userId,
      threadId,
      ...(targetContentBlocks ? { contentBlocks: targetContentBlocks } : {}),
      ...(targetUploadDir ? { uploadDir: targetUploadDir } : {}),
      ...(signal ? { signal } : {}),
      ...(staticIdentity ? { systemPrompt: staticIdentity } : {}),
      isLastCat: false,
    })) {
      if (msg.type === 'text' && msg.content) {
        textContent += msg.content;
      }
      if (msg.type === 'error') {
        hadError = true;
        if (msg.error) {
          textContent += (textContent ? '\n\n' : '') + `❌ ${msg.error}`;
        }
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

    let a2aMentions: CatId[] = [];

    if (textContent) {
      const storedContent = sanitizeInjectedContent(textContent);
      if (!incrementalMode) {
        previousResponses.push({ catId, content: storedContent });
      }

      // A2A mention detection (缅因猫 P1-3: only after full text accumulated)
      a2aMentions = parseA2AMentions(storedContent, catId);

      // Store with actual mentions — degrade on failure to ensure done reaches frontend
      // (缅因猫 review P1-2: Redis failure must not block done yield)
      try {
        await deps.messageStore.append({
          userId,
          catId,
          content: storedContent,
          mentions: a2aMentions,
          timestamp: Date.now(),
          threadId,
          ...(firstMetadata ? { metadata: firstMetadata } : {}),
        });
      } catch (err) {
        console.error(`[routeSerial] messageStore.append failed for ${catId as string}, degrading:`, err);
        if (options.persistenceContext) {
          options.persistenceContext.failed = true;
          options.persistenceContext.errors.push({
            catId: catId as string,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // A2A: extend worklist if mention found + depth allows
      if (a2aMentions.length > 0 && a2aCount < maxDepth && !signal?.aborted) {
        const nextCat = a2aMentions[0]!;
        worklist.push(nextCat);
        a2aCount++;

        // === A2A_HANDOFF 审计 (fire-and-forget, 缅因猫 review P2-3) ===
        const auditLog = getEventAuditLog();
        auditLog.append({
          type: AuditEventTypes.A2A_HANDOFF,
          threadId,
          data: {
            fromCat: catId,
            toCat: nextCat,
            userId,
            a2aDepth: a2aCount,
            maxDepth,
          },
        }).catch((err) => {
          console.warn('[audit] A2A_HANDOFF write failed', { threadId, fromCat: catId, toCat: nextCat, err });
        });

        // Notify frontend: handoff event
        const nextConfig = CAT_CONFIGS[nextCat as keyof typeof CAT_CONFIGS];
        yield {
          type: 'a2a_handoff' as AgentMessageType,
          catId,
          content: `${catConfig?.displayName ?? catId} → ${nextConfig?.displayName ?? nextCat}`,
          timestamp: Date.now(),
        } as AgentMessage;
      }
    } else if (!hadError) {
      // No text content and no error — store empty message (cat responded with no text)
      try {
        await deps.messageStore.append({
          userId,
          catId,
          content: '',
          mentions: [],
          timestamp: Date.now(),
          threadId,
          ...(firstMetadata ? { metadata: firstMetadata } : {}),
        });
      } catch (err) {
        console.error(`[routeSerial] messageStore.append failed for ${catId as string}, degrading:`, err);
        if (options.persistenceContext) {
          options.persistenceContext.failed = true;
          options.persistenceContext.errors.push({
            catId: catId as string,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    // hadError && textContent === '' → skip persistence entirely (P1 bug fix)
    // Error events were already yielded to frontend via the stream.

    if (incrementalMode && !hadError && deliveryBoundaryId) {
      if (options.cursorBoundaries) {
        // ADR-008 S3: defer ack — caller acks after invocation succeeds
        options.cursorBoundaries.set(catId, deliveryBoundaryId);
      } else if (deps.deliveryCursorStore) {
        // Legacy: ack immediately (deprecated route() path)
        try {
          await deps.deliveryCursorStore.ackCursor(userId, catId, threadId, deliveryBoundaryId);
        } catch (err) {
          console.error(`[routeSerial] ackCursor failed for ${catId as string}:`, err);
        }
      }
    }

    // Yield buffered done with correct isFinal (evaluated AFTER worklist may have grown)
    // MUST always reach here regardless of append success (缅因猫 review P1-2)
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
  const {
    contentBlocks,
    uploadDir,
    signal,
    promptTags,
    contextHistory,
    history,
    currentUserMessageId,
    modeSystemPrompt,
    modeSystemPromptByCat,
  } = options;
  const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];
  const incrementalMode = Boolean(currentUserMessageId && deps.deliveryCursorStore);

  const degradationMsgs: AgentMessage[] = [];
  const boundaryByCat = new Map<CatId, string | undefined>();

  const streams = await Promise.all(targetCats.map(async (catId) => {
    const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
    const staticIdentity = buildStaticIdentity(catId);
    const invocationContext = buildInvocationContext({
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

    const targetContentBlocks = routeContentBlocksForCat(catId, contentBlocks);
    const targetUploadDir = targetContentBlocks ? uploadDir : undefined;

    // F24 Phase E: Bootstrap context for Session #2+
    let bootstrapCtx = '';
    if (isSessionChainEnabled(catId) && deps.invocationDeps.sessionChainStore && deps.invocationDeps.transcriptReader) {
      try {
        const bootstrap = await buildSessionBootstrap(
          {
            sessionChainStore: deps.invocationDeps.sessionChainStore,
            transcriptReader: deps.invocationDeps.transcriptReader,
          },
          catId,
          threadId,
        );
        if (bootstrap) {
          bootstrapCtx = bootstrap.text;
        }
      } catch {
        // Best-effort: bootstrap failure doesn't block invocation
      }
    }

    let prompt: string;
    if (incrementalMode) {
      const inc = await assembleIncrementalContext(
        deps,
        userId,
        threadId,
        catId,
        currentUserMessageId,
      );
      boundaryByCat.set(catId, inc.boundaryId);
      const parCatModePrompt = modeSystemPromptByCat?.[catId as string] ?? modeSystemPrompt;
      const parts = [invocationContext, parCatModePrompt, bootstrapCtx, mcpInstructions].filter(Boolean);
      if (inc.contextText) parts.push(inc.contextText);
      if (!inc.includesCurrentUserMessage) parts.push(message);
      prompt = parts.join('\n\n---\n\n');
    } else {
      // Per-cat context budget (Phase 4.0)
      let catContextHistory = contextHistory;
      if (history && history.length > 0 && !contextHistory) {
        const catName = catId as 'opus' | 'codex' | 'gemini';
        const budget = getCatContextBudget(catName);
        // F8: token-based budget — estimate non-context tokens, remainder goes to context
        const parSystemTokens = estimateTokens(
          [staticIdentity, invocationContext, mcpInstructions].filter(Boolean).join('\n'),
        );
        const parPromptTokens = estimateTokens(message);
        const budgetForContext = Math.max(0, budget.maxPromptTokens - parSystemTokens - parPromptTokens - 200);
        const { contextText, messageCount } = assembleContext(history, {
          maxMessages: budget.maxMessages,
          maxContentLength: budget.maxContentLengthPerMsg,
          maxTotalTokens: Math.min(budgetForContext, budget.maxContextTokens),
        });
        catContextHistory = contextText || undefined;

        // Degradation check: notify user if context was truncated (count budget or char budget)
        const degradation = detectContextDegradation(history.length, messageCount, budget);
        if (degradation?.degraded) {
          degradationMsgs.push({
            type: 'system_info' as AgentMessageType,
            catId,
            content: formatDegradationMessage(degradation),
            timestamp: Date.now(),
          } as AgentMessage);
        }
      }

      const parCatModePromptLegacy = modeSystemPromptByCat?.[catId as string] ?? modeSystemPrompt;
      if (invocationContext || parCatModePromptLegacy || mcpInstructions || bootstrapCtx) {
        const parts = [invocationContext, parCatModePromptLegacy, bootstrapCtx, mcpInstructions].filter(Boolean);
        if (catContextHistory) parts.push(catContextHistory);
        prompt = `${parts.join('\n\n---\n\n')}\n\n---\n\n${message}`;
      } else if (catContextHistory) {
        prompt = `${catContextHistory}\n\n---\n\n${message}`;
      } else {
        prompt = message;
      }
    }

    return invokeSingleCat(deps.invocationDeps, {
      catId,
      service: getService(deps.services, catId),
      prompt,
      userId,
      threadId,
      ...(targetContentBlocks ? { contentBlocks: targetContentBlocks } : {}),
      ...(targetUploadDir ? { uploadDir: targetUploadDir } : {}),
      ...(signal ? { signal } : {}),
      ...(staticIdentity ? { systemPrompt: staticIdentity } : {}),
      isLastCat: false,
    });
  }));

  // Yield degradation notifications before streaming starts (BACKLOG #32)
  for (const dm of degradationMsgs) {
    yield dm;
  }

  const catText = new Map<string, string>();
  const catMeta = new Map<string, MessageMetadata>();
  const catHadError = new Set<string>();
  let completedCount = 0;

  for await (const msg of mergeStreams(streams, (idx, err) => {
    console.error(`[routeParallel] Stream ${idx} error:`, err);
  })) {
    if (msg.type === 'text' && msg.content && msg.catId) {
      catText.set(msg.catId, (catText.get(msg.catId) ?? '') + msg.content);
    }
    if (msg.type === 'error' && msg.catId) {
      catHadError.add(msg.catId);
      if (msg.error) {
        const prev = catText.get(msg.catId) ?? '';
        catText.set(msg.catId, prev + (prev ? '\n\n' : '') + `❌ ${msg.error}`);
      }
    }
    if (msg.metadata && msg.catId && !catMeta.has(msg.catId)) {
      catMeta.set(msg.catId, msg.metadata);
    }

    if (msg.type === 'done' && msg.catId) {
      completedCount++;
      const text = catText.get(msg.catId);
      if (text) {
        const meta = catMeta.get(msg.catId);
        const storedContent = sanitizeInjectedContent(text);
        // A2A only triggers in routeSerial; routeParallel stores mentions
        // but never chains (MVP safety boundary — see Phase 3.9 design doc)
        const mentions = parseA2AMentions(storedContent, msg.catId as CatId);
        try {
          await deps.messageStore.append({
            userId,
            catId: msg.catId as CatId,
            content: storedContent,
            mentions,
            timestamp: Date.now(),
            threadId,
            ...(meta ? { metadata: meta } : {}),
          });
        } catch (err) {
          console.error(`[routeParallel] messageStore.append failed for ${msg.catId}, degrading:`, err);
          if (options.persistenceContext) {
            options.persistenceContext.failed = true;
            options.persistenceContext.errors.push({
              catId: msg.catId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      if (incrementalMode && !catHadError.has(msg.catId)) {
        const boundaryId = boundaryByCat.get(msg.catId as CatId);
        if (boundaryId) {
          if (options.cursorBoundaries) {
            // ADR-008 S3: defer ack — caller acks after invocation succeeds
            options.cursorBoundaries.set(msg.catId, boundaryId);
          } else if (deps.deliveryCursorStore) {
            // Legacy: ack immediately
            try {
              await deps.deliveryCursorStore.ackCursor(
                userId,
                msg.catId as CatId,
                threadId,
                boundaryId,
              );
            } catch (err) {
              console.error(`[routeParallel] ackCursor failed for ${msg.catId}:`, err);
            }
          }
        }
      }

      const isFinal = completedCount === targetCats.length;

      // F5: When all parallel cats are done, emit follow-up hints for A2A mentions
      if (isFinal) {
        const followupMentions: Array<{ catId: string; mentionedBy: string }> = [];
        for (const [cid, text] of catText.entries()) {
          const ms = parseA2AMentions(text, cid as CatId);
          for (const target of ms) {
            followupMentions.push({ catId: target, mentionedBy: cid });
          }
        }
        if (followupMentions.length > 0) {
          yield {
            type: 'system_info' as AgentMessageType,
            catId: msg.catId as CatId,
            content: JSON.stringify({
              type: 'a2a_followup_available',
              mentions: followupMentions,
            }),
            timestamp: Date.now(),
          };
        }
      }

      yield { ...msg, isFinal };
    } else {
      yield msg;
    }
  }
}
