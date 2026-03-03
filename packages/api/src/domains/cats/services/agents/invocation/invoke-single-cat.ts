/**
 * Single Cat Invocation
 * 单猫调用的核心逻辑，从 AgentRouter 提取。
 *
 * 处理: credentials 创建、session 获取、workingDirectory 解析、
 *       CLI 调用、消息 yield、错误处理、审计日志。
 *
 * 不处理: system prompt 构建（由调用方负责 prepend）、
 *         消息存储（由调用方在 yield 后累积并存储）。
 */

import type { CatId, ContextHealth, MessageContent } from '@cat-cafe/shared';
import { isSessionChainEnabled } from '../../../../../config/cat-config-loader.js';
import { getContextWindowFallback } from '../../../../../config/context-window-sizes.js';
import { getSessionStrategy, shouldTakeAction } from '../../../../../config/session-strategy.js';
import { isUnderAllowedRoot } from '../../../../../utils/project-path.js';
import { createPromptDigest } from '../../context/prompt-digest.js';
import { AuditEventTypes, getEventAuditLog } from '../../orchestration/EventAuditLog.js';
import type { SessionManager } from '../../session/SessionManager.js';
import type { ISessionSealer } from '../../session/SessionSealer.js';
import type { TranscriptSessionInfo, TranscriptWriter } from '../../session/TranscriptWriter.js';
import type { ISessionChainStore } from '../../stores/ports/SessionChainStore.js';
import type { IThreadStore } from '../../stores/ports/ThreadStore.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from '../../types.js';
import type { InvocationRegistry } from '../invocation/InvocationRegistry.js';
import {
  classifyResumeFailure,
  extractTaskProgress,
  isMissingClaudeSessionError,
  isTransientCliExitCode1,
} from './invoke-helpers.js';
import type { TaskProgressItem, TaskProgressStatus, TaskProgressStore } from './TaskProgressStore.js';

/**
 * F-BLOAT: Context compression detection for non-Claude providers (Codex/Gemini).
 *
 * Track last known context fill per cat:thread. When usedTokens drops >60%
 * between turns, mark for systemPrompt re-injection on the next invocation.
 * This handles the edge case where auto-compact fires before our seal threshold.
 *
 * Note: module-level state — lost on server restart (acceptable, seal handles 95% of cases).
 */
const _prevContextFill = new Map<string, number>();
const _needsReinjection = new Set<string>();

/** @internal Exposed for testing */
export function _resetCompressionDetection(): void {
  _prevContextFill.clear();
  _needsReinjection.clear();
}

/**
 * Shared dependencies for all cat invocations within one AgentRouter
 */
export interface InvocationDeps {
  readonly registry: InvocationRegistry;
  readonly sessionManager: SessionManager;
  readonly threadStore: IThreadStore | null;
  readonly apiUrl: string;
  /** F045 Gap #4: Redis-backed task progress snapshots (optional in memory mode/tests) */
  readonly taskProgressStore?: TaskProgressStore;
  /** F24: Session chain store for context health tracking */
  readonly sessionChainStore?: ISessionChainStore;
  /** F24 Phase B: Session sealer for auto-seal when context threshold reached */
  readonly sessionSealer?: ISessionSealer;
  /** F24 Phase C: Transcript writer for event collection + flush on seal */
  readonly transcriptWriter?: TranscriptWriter;
  /** F24 Phase D: Transcript reader for reading sealed session data */
  readonly transcriptReader?: import('../../session/TranscriptReader.js').TranscriptReader;
}

/**
 * Per-invocation parameters
 */
export interface InvocationParams {
  readonly catId: CatId;
  readonly service: AgentService;
  /** The fully-orchestrated prompt (dynamic context + chain context already prepended by caller) */
  readonly prompt: string;
  readonly userId: string;
  readonly threadId: string;
  readonly contentBlocks?: readonly MessageContent[];
  readonly uploadDir?: string;
  readonly signal?: AbortSignal;
  readonly isLastCat: boolean;
  /** Static identity prompt — prepended to prompt on new sessions (gated by F-BLOAT logic) */
  readonly systemPrompt?: string;
}

/**
 * Invoke a single cat agent and yield messages.
 *
 * The caller is responsible for:
 * - Building and prepending the system prompt to params.prompt
 * - Accumulating text/metadata from yielded messages
 * - Storing the final response in messageStore
 */
export async function* invokeSingleCat(deps: InvocationDeps, params: InvocationParams): AsyncIterable<AgentMessage> {
  const { registry, sessionManager, threadStore, apiUrl } = deps;
  const { catId, service, prompt, userId, threadId, isLastCat, signal } = params;

  const { invocationId, callbackToken } = registry.create(userId, catId, threadId);

  // F22 R2 P1-1: Expose invocationId to caller (route-serial/parallel) so they can
  // use it for RichBlockBuffer.consume() instead of getLatestId() which is wrong
  // under preemption — old invocation A would steal new invocation B's blocks.
  yield {
    type: 'system_info' as const,
    catId,
    content: JSON.stringify({ type: 'invocation_created', invocationId }),
    timestamp: Date.now(),
  };

  const callbackEnv: Record<string, string> = {
    CAT_CAFE_API_URL: apiUrl,
    CAT_CAFE_INVOCATION_ID: invocationId,
    CAT_CAFE_CALLBACK_TOKEN: callbackToken,
    CAT_CAFE_USER_ID: userId,
    ...(process.env['CAT_CAFE_SIGNAL_USER']
      ? { CAT_CAFE_SIGNAL_USER: process.env['CAT_CAFE_SIGNAL_USER'] }
      : {}),
  };

  const auditLog = getEventAuditLog();
  const promptDigest = createPromptDigest(prompt);
  const startTime = Date.now();

  // === CAT_INVOKED 审计 (fire-and-forget, 缅因猫 review P2-3) ===
  auditLog
    .append({
      type: AuditEventTypes.CAT_INVOKED,
      threadId,
      data: {
        catId,
        userId,
        invocationId,
        promptDigest,
        isLastCat,
      },
    })
    .catch((err) => {
      // P2-2: 打印完整错误信息 + 上下文
      console.warn('[audit] CAT_INVOKED write failed', { threadId, invocationId, err });
    });

  let hadStreamError = false;
  let hadError = false;
  let lastTasks: TaskProgressItem[] | null = null;
  let terminalTaskProgressStatus: TaskProgressStatus | null = null;
  let terminalInterruptReason: 'error' | 'aborted' | null = null;
  let finalizedTaskProgressStatus: TaskProgressStatus | null = null;

  const maybePersistTaskProgress = async (out: AgentMessage): Promise<void> => {
    if (!deps.taskProgressStore) return;
    if (out.type !== 'system_info' || !out.content) return;
    let tasks: TaskProgressItem[] | null = null;
    try {
      const parsed = JSON.parse(out.content) as { type?: string; tasks?: unknown };
      if (parsed.type !== 'task_progress' || !Array.isArray(parsed.tasks)) return;
      tasks = parsed.tasks as TaskProgressItem[];
      lastTasks = tasks;
    } catch {
      return;
    }

    try {
      await deps.taskProgressStore.setSnapshot({
        threadId,
        catId,
        tasks,
        status: 'running',
        updatedAt: Date.now(),
        lastInvocationId: invocationId,
      });
    } catch (err) {
      console.warn('[task_progress] persist running snapshot failed (degrading)', {
        threadId,
        catId,
        invocationId,
        err,
      });
    }
  };

  const finalizeTaskProgress = async (): Promise<void> => {
    if (!deps.taskProgressStore || !lastTasks) return;
    const wasAborted = Boolean(signal?.aborted);

    // Determine the terminal status once per invocation and keep it stable.
    // In particular: if we already reached a successful terminal (`done` without error),
    // later `AbortSignal` flips (client disconnect / iterator.return()) must NOT
    // downgrade the snapshot to `interrupted`.
    const status: TaskProgressStatus =
      terminalTaskProgressStatus ??
      (hadError || wasAborted ? 'interrupted' : 'completed');
    const interruptReason =
      terminalInterruptReason ??
      (status === 'interrupted' ? (hadError ? 'error' : (wasAborted ? 'aborted' : undefined)) : undefined);

    // Once we have persisted a "completed" snapshot, don't downgrade it to
    // "interrupted" just because the request was aborted after completion
    // (e.g. client disconnect / iterator.return()).
    if (finalizedTaskProgressStatus === 'completed' && status === 'interrupted' && !hadError) return;
    // Similarly, don't upgrade an interrupted snapshot back to completed.
    if (finalizedTaskProgressStatus === 'interrupted' && status === 'completed') return;
    if (finalizedTaskProgressStatus === status) return;

    try {
      await deps.taskProgressStore.setSnapshot({
        threadId,
        catId,
        tasks: lastTasks,
        status,
        updatedAt: Date.now(),
        lastInvocationId: invocationId,
        ...(interruptReason ? { interruptReason } : {}),
      });
      finalizedTaskProgressStatus = status;
    } catch (err) {
      console.warn('[task_progress] persist final snapshot failed (degrading)', {
        threadId,
        catId,
        invocationId,
        status,
        err,
      });
    }
  };

  try {
    let sessionId: string | undefined;
    try {
      sessionId = await sessionManager.get(userId, catId, threadId);
    } catch {
      // Redis read failure — continue without session
    }

    // R8 P1: Read-side short-circuit — if sessionChainStore has sealed/sealing sessions
    // but NO active session, the previous session was sealed. Discard the persisted CLI
    // sessionId to prevent --resume into a sealed session. This eliminates the race
    // window between fire-and-forget delete and next get().
    // Only applies when chain is non-empty (empty chain = fresh thread, keep sessionId).
    //
    // R11 P1-1: When active record exists, its cliSessionId is the authoritative value.
    // sessionManager.get() may return a stale value if session_init updated the record
    // but sessionManager wasn't re-written. Always align to the active record.
    //
    // F33-fix: Always check chain even when sessionManager returns nothing.
    // The PATCH bind endpoint writes to sessionChainStore but not sessionManager,
    // so a freshly-bound session would be missed if we gate on sessionId being truthy.
    const sessionChainActive = isSessionChainEnabled(catId);
    if (deps.sessionChainStore && sessionChainActive) {
      try {
        const chain = await deps.sessionChainStore.getChain(catId, threadId);
        if (chain.length > 0) {
          const activeRec = chain.find((s) => s.status === 'active');
          if (!activeRec) {
            // Chain exists but no active session → previous was sealed; don't resume
            sessionId = undefined;
          } else if (activeRec.cliSessionId) {
            // Active record's cliSessionId is authoritative (includes F33 manual bind)
            sessionId = activeRec.cliSessionId;
          }
        }
      } catch {
        // R9 P1: Fail-closed — if chain store read fails, discard sessionId.
        // Rationale: requestSeal accepted = hard seal boundary. When we can't
        // verify chain state, it's safer to start fresh than risk --resume
        // into a sealed session. Lost resume is recoverable; sealed-session
        // corruption is not.
        sessionId = undefined;
      }
    }

    // Resolve workingDirectory from thread's projectPath
    let workingDirectory: string | undefined;
    if (threadStore) {
      const thread = await threadStore.get(threadId);
      if (thread?.projectPath && thread.projectPath !== 'default') {
        if (isUnderAllowedRoot(thread.projectPath)) {
          workingDirectory = thread.projectPath;
        }
      }
    }

    // F-BLOAT: Only inject staticIdentity (systemPrompt) on new sessions for cats
    // that support persistent sessions (sessionChain=true).
    // Cats with sessionChain=false (e.g. Gemini) always need it — each turn is effectively new.
    // Exception: compression detected → force re-inject (see _needsReinjection)
    //
    // Injection method: prepend to prompt string (universal, all CLIs).
    // --append-system-prompt proved unreliable (cats didn't receive content).
    // Codex/Gemini AgentServices also prepend if options.systemPrompt is set,
    // so we intentionally do NOT pass systemPrompt in options to avoid double injection.
    const isResume = !!sessionId;
    const canSkipOnResume = isSessionChainEnabled(catId);
    const compressionKey = `${userId}:${catId as string}:${threadId}`;
    const forceReinjection = _needsReinjection.delete(compressionKey);
    const injectSystemPrompt = !canSkipOnResume || !isResume || forceReinjection;

    // Prepend staticIdentity to prompt when injection is needed
    const effectivePrompt = (injectSystemPrompt && params.systemPrompt)
      ? `${params.systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    const baseOptions: AgentServiceOptions = {
      callbackEnv,
      auditContext: {
        invocationId,
        threadId,
        userId,
        catId,
      },
      ...(workingDirectory ? { workingDirectory } : {}),
      ...(params.contentBlocks ? { contentBlocks: params.contentBlocks } : {}),
      ...(params.uploadDir ? { uploadDir: params.uploadDir } : {}),
      ...(signal ? { signal } : {}),
    };

    let lastErrorMessage: string | undefined;

    const processMessage = async (msg: AgentMessage): Promise<AgentMessage[]> => {
      const outputs: AgentMessage[] = [];

      if (msg.type === 'error') {
        hadStreamError = true;
        lastErrorMessage = msg.error;
      }

      if (msg.type === 'session_init' && msg.sessionId) {
        try {
          await sessionManager.store(userId, catId, threadId, msg.sessionId);
        } catch {
          // Redis write failure — session won't persist, but chain continues
        }

        // F24: Ensure SessionRecord exists for this session
        if (deps.sessionChainStore && sessionChainActive) {
          try {
            const existing = await deps.sessionChainStore.getActive(catId, threadId);
            if (existing) {
              // Update cliSessionId if it changed (e.g. new CLI session after restart)
              if (existing.cliSessionId !== msg.sessionId) {
                await deps.sessionChainStore.update(existing.id, {
                  cliSessionId: msg.sessionId,
                  updatedAt: Date.now(),
                });
              }
            } else {
              // First invocation in this thread — create a new SessionRecord
              await deps.sessionChainStore.create({
                cliSessionId: msg.sessionId,
                threadId,
                catId,
                userId,
              });
            }
          } catch {
            // Best-effort — don't break the invocation chain
          }
        }

        // Push session info as system_info for frontend status panel
        // Include sessionSeq if SessionChainStore is available
        let sessionSeq: number | undefined;
        if (deps.sessionChainStore && sessionChainActive) {
          try {
            const activeRec = await deps.sessionChainStore.getActive(catId, threadId);
            sessionSeq = activeRec != null ? activeRec.seq + 1 : undefined;
          } catch {
            /* best-effort */
          }
        }
        outputs.push({
          type: 'system_info' as const,
          catId,
          content: JSON.stringify({
            type: 'invocation_metrics',
            kind: 'session_started',
            sessionId: msg.sessionId,
            invocationId,
            ...(sessionSeq !== undefined ? { sessionSeq } : {}),
          }),
          timestamp: Date.now(),
        });
      }

      if (msg.type === 'done') {
        // === CAT_RESPONDED / CAT_ERROR 审计 (fire-and-forget) ===
        // P1 fix: when error was yielded during stream, emit CAT_ERROR instead of CAT_RESPONDED
        const durationMs = Date.now() - startTime;
        const auditType = hadStreamError ? AuditEventTypes.CAT_ERROR : AuditEventTypes.CAT_RESPONDED;
        auditLog
          .append({
            type: auditType,
            threadId,
            data: {
              catId,
              userId,
              invocationId,
              durationMs,
              ...(hadStreamError ? { error: lastErrorMessage ?? 'unknown stream error' } : {}),
              isFinal: isLastCat,
              metadata: msg.metadata,
            },
          })
          .catch((err) => {
            console.warn(`[audit] ${auditType} write failed`, { threadId, invocationId, err });
          });

        // Push completion metrics for frontend status panel
        outputs.push({
          type: 'system_info' as const,
          catId,
          content: JSON.stringify({
            type: 'invocation_metrics',
            kind: 'invocation_complete',
            invocationId,
            durationMs,
            sessionId: msg.metadata?.sessionId,
          }),
          timestamp: Date.now(),
        });

        // F8: Push token usage for frontend cost/token display
        if (msg.metadata?.usage) {
          outputs.push({
            type: 'system_info' as const,
            catId,
            content: JSON.stringify({
              type: 'invocation_usage',
              catId,
              usage: msg.metadata.usage,
            }),
            timestamp: Date.now(),
          });

          // F24: Compute and emit context health (only when session chain is enabled)
          if (sessionChainActive) {
            // Use lastTurnInputTokens (per-API-call) for accurate context fill,
            // then fallback to aggregated inputTokens, and finally totalTokens
            // for providers (Gemini CLI) that only expose a total count.
            const windowSize =
              msg.metadata.usage.contextWindowSize ?? getContextWindowFallback(msg.metadata.model ?? '');
            const usedFrom =
              msg.metadata.usage.lastTurnInputTokens != null
                ? 'last_turn'
                : msg.metadata.usage.inputTokens != null
                  ? 'input'
                  : msg.metadata.usage.totalTokens != null
                    ? 'total'
                    : null;
            const usedTokens =
              usedFrom === 'last_turn'
                ? msg.metadata.usage.lastTurnInputTokens!
                : usedFrom === 'input'
                  ? msg.metadata.usage.inputTokens!
                  : usedFrom === 'total'
                    ? msg.metadata.usage.totalTokens!
                    : 0;
            if (windowSize && usedTokens > 0) {
              const source: ContextHealth['source'] =
                msg.metadata.usage.contextWindowSize != null && usedFrom !== 'total' ? 'exact' : 'approx';
              const health: ContextHealth = {
                usedTokens,
                windowTokens: windowSize,
                fillRatio: Math.min(usedTokens / windowSize, 1.0),
                source,
                measuredAt: Date.now(),
              };
              // Update SessionRecord (best-effort): persist health + usage snapshot
              if (deps.sessionChainStore) {
                try {
                  const activeRecord = await deps.sessionChainStore.getActive(catId, threadId);
                  if (activeRecord) {
                    const u = msg.metadata!.usage!;
                    await deps.sessionChainStore.update(activeRecord.id, {
                      contextHealth: health,
                      lastUsage: {
                        ...(u.inputTokens != null ? { inputTokens: u.inputTokens } : {}),
                        ...(u.outputTokens != null ? { outputTokens: u.outputTokens } : {}),
                        ...(u.cacheReadTokens != null ? { cacheReadTokens: u.cacheReadTokens } : {}),
                        ...(u.costUsd != null ? { costUsd: u.costUsd } : {}),
                      },
                      updatedAt: Date.now(),
                    });
                  }
                } catch {
                  /* best-effort */
                }
              }
              // F-BLOAT: Detect context compression for re-injection on next turn.
              // When usedTokens drops >60% from previous known value, the CLI
              // auto-compacted its context. Flag for systemPrompt re-injection.
              const cKey = `${userId}:${catId as string}:${threadId}`;
              const prevFill = _prevContextFill.get(cKey);
              _prevContextFill.set(cKey, usedTokens);
              if (prevFill && usedTokens < prevFill * 0.4) {
                _needsReinjection.add(cKey);
              }
              outputs.push({
                type: 'system_info' as const,
                catId,
                content: JSON.stringify({ type: 'context_health', catId, health }),
                timestamp: Date.now(),
              });

              // F33: Strategy-driven seal decision (replaces F24 Phase B shouldSeal)
              if (deps.sessionSealer && deps.sessionChainStore) {
                try {
                  const strategy = getSessionStrategy(catId as string);
                  const activeRecord = await deps.sessionChainStore.getActive(catId, threadId);
                  const action = shouldTakeAction(
                    health.fillRatio,
                    health.windowTokens,
                    health.usedTokens,
                    activeRecord?.compressionCount ?? 0,
                    strategy,
                  );

                  switch (action.type) {
                    case 'none':
                      break;
                    case 'warn':
                      // warn is already emitted via context_health system_info above
                      break;
                    case 'seal':
                    case 'seal_after_compress': {
                      if (activeRecord) {
                        const sealResult = await deps.sessionSealer.requestSeal({
                          sessionId: activeRecord.id,
                          reason: action.reason,
                        });
                        if (sealResult.accepted) {
                          sessionManager.delete(userId, catId, threadId).catch(() => {});
                          outputs.push({
                            type: 'system_info' as const,
                            catId,
                            content: JSON.stringify({
                              type: 'session_seal_requested',
                              catId,
                              sessionId: activeRecord.id,
                              sessionSeq: activeRecord.seq + 1,
                              reason: action.reason,
                              healthSnapshot: health,
                            }),
                            timestamp: Date.now(),
                          });
                          deps.sessionSealer.finalize({ sessionId: activeRecord.id }).catch(() => {});
                        }
                      }
                      break;
                    }
                    case 'allow_compress':
                      // Don't seal — let CLI compress. Log for observability.
                      outputs.push({
                        type: 'system_info' as const,
                        catId,
                        content: JSON.stringify({
                          type: 'strategy_allow_compress',
                          catId,
                          strategy: strategy.strategy,
                          compressionCount: activeRecord?.compressionCount ?? 0,
                          healthSnapshot: health,
                        }),
                        timestamp: Date.now(),
                      });
                      break;
                  }
                } catch {
                  /* best-effort: strategy failure doesn't break invocation */
                }
              }
            }
          }
        }

        outputs.push({ ...msg, isFinal: isLastCat });
      } else {
        outputs.push(msg);

        // F26: Detect task management tools and emit task_progress for frontend
        if (msg.type === 'tool_use' && msg.toolName) {
          const progress = extractTaskProgress(msg.toolName, msg.toolInput);
          if (progress) {
            outputs.push({
              type: 'system_info' as const,
              catId,
              content: JSON.stringify({ type: 'task_progress', catId, ...progress }),
              timestamp: Date.now(),
            });
          }
        }
      }

      // F24 Phase C: Record event to transcript buffer (best-effort)
      if (deps.transcriptWriter && deps.sessionChainStore && sessionChainActive) {
        try {
          const activeRec = await deps.sessionChainStore.getActive(catId, threadId);
          if (activeRec) {
            const sessInfo: TranscriptSessionInfo = {
              sessionId: activeRec.id,
              threadId,
              catId: activeRec.catId,
              cliSessionId: activeRec.cliSessionId,
              seq: activeRec.seq,
            };
            // Record the raw agent message as a transcript event
            deps.transcriptWriter.appendEvent(sessInfo, msg as unknown as Record<string, unknown>, invocationId);
          }
        } catch {
          /* best-effort */
        }
      }

      return outputs;
    };

    // Self-heal policy (at most one retry total):
    // 1) stale --resume session: "No conversation found with session ID ..."
    // 2) transient CLI bootstrap exit: "CLI 异常退出 (code: 1, signal: none)"
    const initialResumeSessionId = sessionId;
    const shouldTrackGeminiResumeFailures = catId === 'gemini' && Boolean(initialResumeSessionId);
    const resumeFailureCounts: Partial<Record<'missing_session' | 'cli_exit' | 'auth', number>> = {};
    const maxAttempts = 2;
    let allowSessionRetry = Boolean(sessionId);
    let allowTransientRetry = true;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const options: AgentServiceOptions = {
        ...(sessionId ? { sessionId } : {}),
        ...baseOptions,
      };
      let suppressedMissingSessionError: AgentMessage | undefined;
      let suppressedTransientCliError: AgentMessage | undefined;
      let shouldRetryWithoutSession = false;
      let shouldRetryOnTransientCliExit = false;
      let attemptHasContentOutput = false;

      for await (const msg of service.invoke(effectivePrompt, options)) {
        if (shouldTrackGeminiResumeFailures && options.sessionId && msg.type === 'error') {
          const failureKind = classifyResumeFailure(msg.error);
          if (failureKind) {
            resumeFailureCounts[failureKind] = (resumeFailureCounts[failureKind] ?? 0) + 1;
          }
        }

        if (allowSessionRetry && msg.type === 'error' && isMissingClaudeSessionError(msg.error)) {
          suppressedMissingSessionError = msg;
          continue;
        }
        if (
          allowTransientRetry &&
          !attemptHasContentOutput &&
          msg.type === 'error' &&
          isTransientCliExitCode1(msg.error)
        ) {
          suppressedTransientCliError = msg;
          continue;
        }

        if (suppressedMissingSessionError || suppressedTransientCliError) {
          if (msg.type === 'done') {
            shouldRetryWithoutSession = Boolean(suppressedMissingSessionError);
            shouldRetryOnTransientCliExit = Boolean(suppressedTransientCliError);
            break;
          }

          if (suppressedMissingSessionError) {
            for (const out of await processMessage(suppressedMissingSessionError)) {
              if (out.type === 'error') {
                hadError = true;
                terminalTaskProgressStatus = 'interrupted';
                terminalInterruptReason = 'error';
              }
              await maybePersistTaskProgress(out);
              if (out.type === 'done' && terminalTaskProgressStatus === null) {
                if (hadError) {
                  terminalTaskProgressStatus = 'interrupted';
                  terminalInterruptReason = 'error';
                } else if (signal?.aborted) {
                  terminalTaskProgressStatus = 'interrupted';
                  terminalInterruptReason = 'aborted';
                } else {
                  terminalTaskProgressStatus = 'completed';
                  terminalInterruptReason = null;
                }
              }
              if (out.type === 'done') await finalizeTaskProgress();
              yield out;
            }
            suppressedMissingSessionError = undefined;
          }
          if (suppressedTransientCliError) {
            for (const out of await processMessage(suppressedTransientCliError)) {
              if (out.type === 'error') {
                hadError = true;
                terminalTaskProgressStatus = 'interrupted';
                terminalInterruptReason = 'error';
              }
              await maybePersistTaskProgress(out);
              if (out.type === 'done' && terminalTaskProgressStatus === null) {
                if (hadError) {
                  terminalTaskProgressStatus = 'interrupted';
                  terminalInterruptReason = 'error';
                } else if (signal?.aborted) {
                  terminalTaskProgressStatus = 'interrupted';
                  terminalInterruptReason = 'aborted';
                } else {
                  terminalTaskProgressStatus = 'completed';
                  terminalInterruptReason = null;
                }
              }
              if (out.type === 'done') await finalizeTaskProgress();
              yield out;
            }
            suppressedTransientCliError = undefined;
          }
        }

        for (const out of await processMessage(msg)) {
          if (out.type === 'error') {
            hadError = true;
            terminalTaskProgressStatus = 'interrupted';
            terminalInterruptReason = 'error';
          }
          await maybePersistTaskProgress(out);
          if (out.type === 'done' && terminalTaskProgressStatus === null) {
            if (hadError) {
              terminalTaskProgressStatus = 'interrupted';
              terminalInterruptReason = 'error';
            } else if (signal?.aborted) {
              terminalTaskProgressStatus = 'interrupted';
              terminalInterruptReason = 'aborted';
            } else {
              terminalTaskProgressStatus = 'completed';
              terminalInterruptReason = null;
            }
          }
          if (out.type === 'done') await finalizeTaskProgress();
          yield out;
        }
        if (msg.type !== 'error' && msg.type !== 'done' && msg.type !== 'session_init') {
          attemptHasContentOutput = true;
        }
      }

      if (shouldRetryWithoutSession && attempt + 1 < maxAttempts) {
        try {
          await sessionManager.delete(userId, catId, threadId);
        } catch {
          // Redis delete failure — best-effort only
        }
        sessionId = undefined;
        // F-BLOAT P1: self-heal drops session → retry is now a fresh session.
        // Must re-inject systemPrompt since baseOptions may have omitted it
        // when the original attempt was a resume (injectSystemPrompt=false).
        if (params.systemPrompt && !baseOptions.systemPrompt) {
          baseOptions.systemPrompt = params.systemPrompt;
        }
        allowSessionRetry = false;
        continue;
      }
      if (shouldRetryOnTransientCliExit && attempt + 1 < maxAttempts) {
        allowTransientRetry = false;
        continue;
      }

      if (suppressedMissingSessionError) {
        for (const out of await processMessage(suppressedMissingSessionError)) {
          if (out.type === 'error') {
            hadError = true;
            terminalTaskProgressStatus = 'interrupted';
            terminalInterruptReason = 'error';
          }
          await maybePersistTaskProgress(out);
          if (out.type === 'done' && terminalTaskProgressStatus === null) {
            if (hadError) {
              terminalTaskProgressStatus = 'interrupted';
              terminalInterruptReason = 'error';
            } else if (signal?.aborted) {
              terminalTaskProgressStatus = 'interrupted';
              terminalInterruptReason = 'aborted';
            } else {
              terminalTaskProgressStatus = 'completed';
              terminalInterruptReason = null;
            }
          }
          if (out.type === 'done') await finalizeTaskProgress();
          yield out;
        }
      }
      if (suppressedTransientCliError) {
        for (const out of await processMessage(suppressedTransientCliError)) {
          if (out.type === 'error') {
            hadError = true;
            terminalTaskProgressStatus = 'interrupted';
            terminalInterruptReason = 'error';
          }
          await maybePersistTaskProgress(out);
          if (out.type === 'done' && terminalTaskProgressStatus === null) {
            if (hadError) {
              terminalTaskProgressStatus = 'interrupted';
              terminalInterruptReason = 'error';
            } else if (signal?.aborted) {
              terminalTaskProgressStatus = 'interrupted';
              terminalInterruptReason = 'aborted';
            } else {
              terminalTaskProgressStatus = 'completed';
              terminalInterruptReason = null;
            }
          }
          if (out.type === 'done') await finalizeTaskProgress();
          yield out;
        }
      }
      break;
    }

    if (shouldTrackGeminiResumeFailures && Object.keys(resumeFailureCounts).length > 0) {
      const total = Object.values(resumeFailureCounts).reduce((sum, count) => sum + (count ?? 0), 0);
      for (const out of await processMessage({
        type: 'system_info' as const,
        catId,
        content: JSON.stringify({
          type: 'resume_failure_stats',
          catId,
          invocationId,
          sessionId: initialResumeSessionId,
          counts: resumeFailureCounts,
          total,
        }),
        timestamp: Date.now(),
      })) {
        await maybePersistTaskProgress(out);
        yield out;
      }
    }
  } catch (err) {
    // === CAT_ERROR 审计 (fire-and-forget, 缅因猫 review P2-3) ===
    const durationMs = Date.now() - startTime;
    auditLog
      .append({
        type: AuditEventTypes.CAT_ERROR,
        threadId,
        data: {
          catId,
          userId,
          invocationId,
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        },
      })
      .catch((auditErr) => {
        console.warn('[audit] CAT_ERROR write failed', { threadId, invocationId, err: auditErr });
      });

    hadError = true;
    yield {
      type: 'error' as const,
      catId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    };
    await finalizeTaskProgress();
    yield { type: 'done' as const, catId, isFinal: isLastCat, timestamp: Date.now() };
  } finally {
    await finalizeTaskProgress();
  }
}
