/**
 * Serial Route Strategy
 * Cats respond one by one, each seeing previous responses.
 *
 * A2A support: after each cat completes, its response is checked for @mentions.
 * If a mention is detected and depth allows, the mentioned cat is appended to the
 * worklist — extending the chain within the SAME function call. This preserves
 * previousResponses continuity and correct isFinal semantics (缅因猫 P1-1, P1-2).
 *
 * A2A only triggers here in routeSerial; routeParallel never chains (MVP safety boundary).
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import { buildStaticIdentity, buildInvocationContext } from '../../context/SystemPromptBuilder.js';
import { needsMcpInjection, buildMcpCallbackInstructions } from '../invocation/McpPromptInjector.js';
import { invokeSingleCat } from '../invocation/invoke-single-cat.js';
import type { StoredToolEvent } from '../../stores/ports/MessageStore.js';
import type { AgentMessage, AgentMessageType, MessageMetadata } from '../../types.js';
import { parseA2AMentions, getMaxA2ADepth } from '../routing/a2a-mentions.js';
import { registerWorklist, unregisterWorklist } from '../routing/WorklistRegistry.js';
import { assembleContext } from '../../context/ContextAssembler.js';
import { getCatContextBudget } from '../../../../../config/cat-budgets.js';
import { estimateTokens } from '../../../../../utils/token-counter.js';
import { getEventAuditLog, AuditEventTypes } from '../../orchestration/EventAuditLog.js';
import { formatDegradationMessage } from '../../orchestration/DegradationPolicy.js';
import { buildSessionBootstrap } from '../../session/SessionBootstrap.js';
import { isSessionChainEnabled } from '../../../../../config/cat-config-loader.js';
import {
  getService,
  detectContextDegradation,
  toStoredToolEvent,
  sanitizeInjectedContent,
  routeContentBlocksForCat,
  assembleIncrementalContext,
} from './route-helpers.js';
import type { RouteStrategyDeps, RouteOptions } from './route-helpers.js';

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
  // F27: Register worklist so callback A2A can push targets here
  const worklist = [...targetCats];
  const maxDepth = options.maxA2ADepth ?? getMaxA2ADepth();
  const worklistEntry = registerWorklist(threadId, worklist, maxDepth);

  let index = 0;
  // F27: Track how many worklist entries have had a2a_handoff emitted
  let handoffEmitted = targetCats.length; // Original targets don't get handoff events
  try {
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
      a2aEnabled: worklistEntry.a2aCount < maxDepth,
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
    const collectedToolEvents: StoredToolEvent[] = [];

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
      // Accumulate tool events for persistence
      const toolEvt = toStoredToolEvent(msg);
      if (toolEvt) {
        collectedToolEvents.push(toolEvt);
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
          ...(collectedToolEvents.length > 0 ? { toolEvents: collectedToolEvents } : {}),
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
      // F27: dedup only against pending (not-yet-executed) tail — cats that already ran
      // can be re-enqueued for another round (e.g. A→B→A review ping-pong).
      if (a2aMentions.length > 0 && worklistEntry.a2aCount < maxDepth && !signal?.aborted) {
        const pendingTail = worklist.slice(index + 1);
        for (const nextCat of a2aMentions) {
          if (worklistEntry.a2aCount >= maxDepth) break;
          if (pendingTail.includes(nextCat)) continue;

          worklist.push(nextCat);
          worklistEntry.a2aCount++;
          pendingTail.push(nextCat); // Keep dedup view in sync
        }
      }

      // F27: Emit a2a_handoff for ALL new A2A targets (both response-text and callback-pushed).
      // We track which targets have already been announced to avoid duplicate handoff events.
      for (let wi = handoffEmitted; wi < worklist.length; wi++) {
        const pendingCat = worklist[wi]!;
        if (wi < targetCats.length) continue; // Skip original targets — not A2A

        // === A2A_HANDOFF 审计 (fire-and-forget, 缅因猫 review P2-3) ===
        const auditLog = getEventAuditLog();
        auditLog.append({
          type: AuditEventTypes.A2A_HANDOFF,
          threadId,
          data: {
            fromCat: catId,
            toCat: pendingCat,
            userId,
            a2aDepth: worklistEntry.a2aCount,
            maxDepth,
          },
        }).catch((err) => {
          console.warn('[audit] A2A_HANDOFF write failed', { threadId, fromCat: catId, toCat: pendingCat, err });
        });

        const nextConfig = CAT_CONFIGS[pendingCat as keyof typeof CAT_CONFIGS];
        yield {
          type: 'a2a_handoff' as AgentMessageType,
          catId,
          content: `${catConfig?.displayName ?? catId} → ${nextConfig?.displayName ?? pendingCat}`,
          timestamp: Date.now(),
        } as AgentMessage;
      }
      handoffEmitted = worklist.length;
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
          ...(collectedToolEvents.length > 0 ? { toolEvents: collectedToolEvents } : {}),
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

    // F27: Advance executedIndex so pushToWorklist knows which cats are done
    worklistEntry.executedIndex = index + 1;
    index++;
  }
  } finally {
    // F27: Always unregister worklist, even on error/abort.
    // Pass owner ref so preempting new invocation's worklist is not deleted (缅因猫 R1 P1-1)
    unregisterWorklist(threadId, worklistEntry);
  }
}
