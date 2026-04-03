/**
 * GeminiAcpAdapter — AgentService implementation backed by ACP protocol.
 *
 * Phase C: Acquires a client lease from AcpProcessPool per invocation.
 * Pool handles lifecycle (spawn, init, idle TTL, eviction, zombie cleanup).
 *
 * Key behaviors:
 *   - Pool-backed: each invoke() acquires lease, releases in finally
 *   - Session per invocation: each invoke() calls newSession()
 *   - 4-window abort coverage (pre-invoke, post-newSession, post-yield, during-prompt)
 *   - Failure classification: init_failure / prompt_failure / model_capacity / mcp_pollution / lease_timeout
 *   - System prompt: prepended to prompt text (same as GeminiAgentService)
 */

import type { CatId } from '@cat-cafe/shared';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from '../../../types.js';
import { type AcpCapacitySignal, AcpProtocolError, AcpTimeoutError } from './AcpClient.js';
import type { AcpLease, AcpProcessPool, PoolKey } from './AcpProcessPool.js';
import { transformAcpEvent } from './acp-event-transformer.js';

const log = createModuleLogger('gemini-acp');

export interface GeminiAcpAdapterConfig {
  catId: CatId;
  pool: AcpProcessPool;
  poolKey: PoolKey;
  /** Project root (monorepo root) — used as default session cwd */
  projectRoot: string;
}

export class GeminiAcpAdapter implements AgentService {
  readonly catId: CatId;
  private readonly pool: AcpProcessPool;
  private readonly poolKey: PoolKey;
  private readonly projectRoot: string;

  constructor(config: GeminiAcpAdapterConfig) {
    this.catId = config.catId;
    this.pool = config.pool;
    this.poolKey = config.poolKey;
    this.projectRoot = config.projectRoot;
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const metadata: MessageMetadata = { provider: 'google', model: 'gemini-acp' };

    // Window 1: pre-aborted signal short-circuits immediately
    if (options?.signal?.aborted) {
      yield {
        type: 'error',
        catId: this.catId,
        error: 'prompt_failure: aborted before start',
        errorCode: 'prompt_failure',
        metadata,
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
      return;
    }

    let lease: AcpLease | null = null;
    try {
      lease = await this.pool.acquire(this.poolKey);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ catId: this.catId, err: errMsg }, 'ACP init failure');
      yield {
        type: 'error',
        catId: this.catId,
        error: `init_failure: ${errMsg}`,
        errorCode: 'init_failure',
        metadata,
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
      return;
    }

    // Pool returns AcpPoolClient; we know it's actually an AcpClient with full protocol methods
    const client = lease.client as unknown as {
      newSession(cwd: string): Promise<{ sessionId: string }>;
      cancelSession(sessionId: string): void;
      promptStream(sessionId: string, text: string): AsyncGenerator<import('./types.js').AcpSessionUpdate>;
      onCapacity(fn: (signal: AcpCapacitySignal) => void): void;
      offCapacity(fn: (signal: AcpCapacitySignal) => void): void;
      readonly recentCapacitySignal: AcpCapacitySignal | null;
      clearRecentCapacitySignal(): void;
    };
    const cwd = options?.workingDirectory ?? this.projectRoot;
    let sessionId: string | undefined;

    // Per-invoke capacity listener — covers the entire invoke lifecycle (newSession + prompt + grace).
    // This is intentionally invoke-level, not prompt-level: capacity is a provider-level property
    // (same process = same API key = same quota), so signals from any phase are relevant.
    let capacitySignal: AcpCapacitySignal | null = null;
    const onCapacity = (signal: AcpCapacitySignal) => {
      capacitySignal = signal;
    };
    client.onCapacity(onCapacity);

    // Abort handler: cancels the specific session, not the shared client
    const onAbort = options?.signal
      ? () => {
          log.info({ catId: this.catId, sessionId }, 'ACP session cancelled via abort signal');
          if (sessionId && client) {
            client.cancelSession(sessionId);
          }
        }
      : undefined;
    if (onAbort && options?.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    let promptStreamStartedAt = 0;
    let eventCount = 0;

    try {
      log.info({ catId: this.catId, cwd }, 'ACP newSession starting');
      const session = await client.newSession(cwd);
      sessionId = session.sessionId;
      metadata.sessionId = sessionId;
      log.info({ catId: this.catId, sessionId }, 'ACP newSession completed');

      // Window 2: abort may have fired during newSession
      if (options?.signal?.aborted) {
        client.cancelSession(sessionId);
        yield {
          type: 'error',
          catId: this.catId,
          error: 'prompt_failure: aborted during session setup',
          errorCode: 'prompt_failure',
          metadata,
          timestamp: Date.now(),
        };
        yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
        return;
      }

      yield {
        type: 'session_init',
        catId: this.catId,
        sessionId,
        metadata,
        timestamp: Date.now(),
      };

      // Window 3: consumer may abort during the yield above
      if (options?.signal?.aborted) {
        client.cancelSession(sessionId);
        yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
        return;
      }

      // Prepend system prompt (Gemini CLI/ACP has no system prompt flag)
      const effectivePrompt = options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt;

      // Window 4: onAbort listener covers the duration of promptStream
      promptStreamStartedAt = Date.now();
      log.info({ catId: this.catId, sessionId, promptLen: effectivePrompt.length }, 'ACP promptStream starting');
      eventCount = 0;
      for await (const event of client.promptStream(sessionId, effectivePrompt)) {
        eventCount++;
        if (eventCount === 1) {
          const firstEventLatencyMs = Date.now() - promptStreamStartedAt;
          log.info({ catId: this.catId, sessionId, firstEventLatencyMs }, 'ACP first event received');
        }
        const msg = transformAcpEvent(event, this.catId, metadata);
        if (msg) yield msg;
      }
      log.info({ catId: this.catId, sessionId, eventCount }, 'ACP promptStream completed');
      // Successful prompt — provider has recovered; clear stale capacity signal
      client.clearRecentCapacitySignal();

      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      const waitedMs = promptStreamStartedAt ? Date.now() - promptStreamStartedAt : 0;
      // P1: stderr may arrive after timeout — give a grace window for late capacity signals
      if (!capacitySignal && err instanceof AcpTimeoutError) {
        await new Promise((r) => setTimeout(r, 2_000));
      }
      const { errorCode, errorMsg } = classifyError(err, capacitySignal, client.recentCapacitySignal);
      log.error({ catId: this.catId, errorCode, err: errorMsg, eventCount, waitedMs }, 'ACP prompt failure');
      yield {
        type: 'error',
        catId: this.catId,
        error: `${errorCode}: ${errorMsg}`,
        errorCode,
        metadata,
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } finally {
      client.offCapacity(onCapacity);
      if (onAbort && options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
      lease.release();
    }
  }
}

/** Max age (ms) for client-level capacity signal to be used as fallback evidence. */
const RECENT_SIGNAL_MAX_AGE_MS = 10 * 60 * 1000;

function classifyError(
  err: unknown,
  capacitySignal: AcpCapacitySignal | null | undefined,
  clientRecentSignal?: AcpCapacitySignal | null,
): { errorCode: string; errorMsg: string } {
  if (err instanceof AcpProtocolError) {
    if (err.code === -32000 || err.message.includes('capacity')) {
      return { errorCode: 'model_capacity', errorMsg: err.message };
    }
    if (/\bmcp\b/i.test(err.message)) {
      return { errorCode: 'mcp_pollution', errorMsg: err.message };
    }
    return { errorCode: 'prompt_failure', errorMsg: err.message };
  }
  if (err instanceof AcpTimeoutError) {
    // Priority 1: invoke-level listener captured signal in real time
    if (capacitySignal) {
      return {
        errorCode: 'model_capacity',
        errorMsg: `Provider capacity exhausted (upstream 429, evidence: invoke_signal). ${capacitySignal.message}`,
      };
    }
    // Priority 2: client-level signal within window — delayed stderr from CLI buffering
    if (clientRecentSignal && Date.now() - clientRecentSignal.timestamp < RECENT_SIGNAL_MAX_AGE_MS) {
      const ageS = Math.round((Date.now() - clientRecentSignal.timestamp) / 1000);
      return {
        errorCode: 'model_capacity',
        errorMsg: `Provider capacity exhausted (upstream 429, evidence: recent_process_signal, ${ageS}s ago). ${clientRecentSignal.message}`,
      };
    }
    return { errorCode: 'lease_timeout', errorMsg: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('ENOENT') || msg.includes('spawn')) {
    return { errorCode: 'init_failure', errorMsg: msg };
  }
  return { errorCode: 'prompt_failure', errorMsg: msg };
}
