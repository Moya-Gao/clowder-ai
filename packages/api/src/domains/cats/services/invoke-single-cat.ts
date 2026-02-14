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

import type { CatId, MessageContent, ContextHealth } from '@cat-cafe/shared';
import { isUnderAllowedRoot } from '../../../utils/project-path.js';
import type { SessionManager } from './SessionManager.js';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IThreadStore } from './ThreadStore.js';
import type { ISessionChainStore } from './SessionChainStore.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from './types.js';
import { getEventAuditLog, AuditEventTypes } from './EventAuditLog.js';
import { createPromptDigest } from './prompt-digest.js';
import { getContextWindowFallback } from '../../../config/context-window-sizes.js';

function isMissingClaudeSessionError(message: string | undefined): boolean {
  if (!message) return false;
  return /No conversation found with session ID/i.test(message);
}

/**
 * Shared dependencies for all cat invocations within one AgentRouter
 */
export interface InvocationDeps {
  readonly registry: InvocationRegistry;
  readonly sessionManager: SessionManager;
  readonly threadStore: IThreadStore | null;
  readonly apiUrl: string;
  /** F24: Session chain store for context health tracking */
  readonly sessionChainStore?: ISessionChainStore;
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
  /** Static identity prompt — services use CLI-specific injection (e.g. --append-system-prompt) */
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
export async function* invokeSingleCat(
  deps: InvocationDeps,
  params: InvocationParams,
): AsyncIterable<AgentMessage> {
  const { registry, sessionManager, threadStore, apiUrl } = deps;
  const { catId, service, prompt, userId, threadId, isLastCat, signal } = params;

  const { invocationId, callbackToken } = registry.create(userId, catId, threadId);
  const callbackEnv: Record<string, string> = {
    CAT_CAFE_API_URL: apiUrl,
    CAT_CAFE_INVOCATION_ID: invocationId,
    CAT_CAFE_CALLBACK_TOKEN: callbackToken,
  };

  const auditLog = getEventAuditLog();
  const promptDigest = createPromptDigest(prompt);
  const startTime = Date.now();

  // === CAT_INVOKED 审计 (fire-and-forget, 缅因猫 review P2-3) ===
  auditLog.append({
    type: AuditEventTypes.CAT_INVOKED,
    threadId,
    data: {
      catId,
      userId,
      invocationId,
      promptDigest,
      isLastCat,
    },
  }).catch((err) => {
    // P2-2: 打印完整错误信息 + 上下文
    console.warn('[audit] CAT_INVOKED write failed', { threadId, invocationId, err });
  });

  let hadStreamError = false;

  try {
    let sessionId: string | undefined;
    try {
      sessionId = await sessionManager.get(userId, catId, threadId);
    } catch {
      // Redis read failure — continue without session
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
      ...(params.systemPrompt ? { systemPrompt: params.systemPrompt } : {}),
    };

    let lastErrorMessage: string | undefined;

    const processAndYield = async function* (msg: AgentMessage): AsyncGenerator<AgentMessage> {
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
        if (deps.sessionChainStore) {
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
        yield {
          type: 'system_info' as const,
          catId,
          content: JSON.stringify({
            type: 'invocation_metrics',
            kind: 'session_started',
            sessionId: msg.sessionId,
            invocationId,
          }),
          timestamp: Date.now(),
        };
      }

      if (msg.type === 'done') {
        // === CAT_RESPONDED / CAT_ERROR 审计 (fire-and-forget) ===
        // P1 fix: when error was yielded during stream, emit CAT_ERROR instead of CAT_RESPONDED
        const durationMs = Date.now() - startTime;
        const auditType = hadStreamError ? AuditEventTypes.CAT_ERROR : AuditEventTypes.CAT_RESPONDED;
        auditLog.append({
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
        }).catch((err) => {
          console.warn(`[audit] ${auditType} write failed`, { threadId, invocationId, err });
        });

        // Push completion metrics for frontend status panel
        yield {
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
        };

        // F8: Push token usage for frontend cost/token display
        if (msg.metadata?.usage) {
          yield {
            type: 'system_info' as const,
            catId,
            content: JSON.stringify({
              type: 'invocation_usage',
              catId,
              usage: msg.metadata.usage,
            }),
            timestamp: Date.now(),
          };

          // F24: Compute and emit context health
          // Use lastTurnInputTokens (per-API-call) for accurate context fill,
          // falling back to aggregated inputTokens only if per-turn data unavailable.
          const windowSize = msg.metadata.usage.contextWindowSize
            ?? getContextWindowFallback(msg.metadata.model ?? '');
          const usedTokens = msg.metadata.usage.lastTurnInputTokens
            ?? msg.metadata.usage.inputTokens ?? 0;
          if (windowSize && usedTokens > 0) {
            const health: ContextHealth = {
              usedTokens,
              windowTokens: windowSize,
              fillRatio: Math.min(usedTokens / windowSize, 1.0),
              source: msg.metadata.usage.contextWindowSize ? 'exact' : 'approx',
              measuredAt: Date.now(),
            };
            // Update SessionRecord (best-effort)
            if (deps.sessionChainStore) {
              try {
                const activeRecord = await deps.sessionChainStore.getActive(catId, threadId);
                if (activeRecord) {
                  await deps.sessionChainStore.update(activeRecord.id, {
                    contextHealth: health,
                    updatedAt: Date.now(),
                  });
                }
              } catch { /* best-effort */ }
            }
            yield {
              type: 'system_info' as const,
              catId,
              content: JSON.stringify({ type: 'context_health', catId, health }),
              timestamp: Date.now(),
            };
          }
        }

        yield { ...msg, isFinal: isLastCat };
      } else {
        yield msg;
      }
    };

    // Claude CLI occasionally returns a stale session bootstrap error:
    // "No conversation found with session ID ...".
    // Self-heal by clearing stored session and retrying once without --resume.
    let allowSessionRetry = Boolean(sessionId);
    while (true) {
      const options: AgentServiceOptions = {
        ...(sessionId ? { sessionId } : {}),
        ...baseOptions,
      };
      let suppressedMissingSessionError: AgentMessage | undefined;
      let shouldRetryWithoutSession = false;

      for await (const msg of service.invoke(prompt, options)) {
        if (
          allowSessionRetry &&
          msg.type === 'error' &&
          isMissingClaudeSessionError(msg.error)
        ) {
          suppressedMissingSessionError = msg;
          continue;
        }

        if (suppressedMissingSessionError) {
          if (msg.type === 'done') {
            shouldRetryWithoutSession = true;
            break;
          }

          for await (const out of processAndYield(suppressedMissingSessionError)) {
            yield out;
          }
          suppressedMissingSessionError = undefined;
        }

        for await (const out of processAndYield(msg)) {
          yield out;
        }
      }

      if (shouldRetryWithoutSession) {
        try {
          await sessionManager.delete(userId, catId, threadId);
        } catch {
          // Redis delete failure — best-effort only
        }
        sessionId = undefined;
        allowSessionRetry = false;
        continue;
      }

      if (suppressedMissingSessionError) {
        for await (const out of processAndYield(suppressedMissingSessionError)) {
          yield out;
        }
      }
      break;
    }
  } catch (err) {
    // === CAT_ERROR 审计 (fire-and-forget, 缅因猫 review P2-3) ===
    const durationMs = Date.now() - startTime;
    auditLog.append({
      type: AuditEventTypes.CAT_ERROR,
      threadId,
      data: {
        catId,
        userId,
        invocationId,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
      },
    }).catch((auditErr) => {
      console.warn('[audit] CAT_ERROR write failed', { threadId, invocationId, err: auditErr });
    });

    yield {
      type: 'error' as const,
      catId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    };
    yield { type: 'done' as const, catId, isFinal: isLastCat, timestamp: Date.now() };
  }
}
