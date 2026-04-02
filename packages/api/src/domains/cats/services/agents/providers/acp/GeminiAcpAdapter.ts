/**
 * GeminiAcpAdapter — AgentService implementation backed by ACP protocol.
 *
 * Replaces GeminiAgentService's headless CLI path with a proper ACP
 * client (JSON-RPC 2.0 over NDJSON). The old CLI path remains available
 * via GeminiAgentService; startup chooses based on cat-config.json `acp` section.
 *
 * Key behaviors:
 *   - Lazy init: first invoke() spawns + initializes AcpClient; subsequent reuse
 *   - Session per invocation: each invoke() calls newSession(); session reuse is Phase C
 *   - Failure classification: init_failure / prompt_failure / model_capacity
 *   - System prompt: prepended to prompt text (same as GeminiAgentService)
 */

import { spawn as nodeSpawn } from 'node:child_process';
import type { CatId } from '@cat-cafe/shared';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from '../../../types.js';
import type { AcpClientConfig } from './AcpClient.js';
import { AcpClient, AcpProtocolError, AcpTimeoutError } from './AcpClient.js';
import { transformAcpEvent } from './acp-event-transformer.js';

const log = createModuleLogger('gemini-acp');

export interface GeminiAcpAdapterConfig {
  catId: CatId;
  acpConfig: { command: string; startupArgs: string[]; mcpWhitelist?: string[] };
  workingDirectory?: string;
  /** Inject spawn function for testing */
  spawnFn?: typeof nodeSpawn;
}

export class GeminiAcpAdapter implements AgentService {
  readonly catId: CatId;
  private client: AcpClient | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly config: GeminiAcpAdapterConfig;

  constructor(config: GeminiAcpAdapterConfig) {
    this.catId = config.catId;
    this.config = config;
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const metadata: MessageMetadata = { provider: 'google', model: 'gemini-acp' };

    // P2 fix: pre-aborted signal short-circuits immediately
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

    try {
      await this.ensureInitialized();
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

    const cwd = options?.workingDirectory ?? this.config.workingDirectory ?? process.cwd();
    let sessionId: string | undefined;

    // P1-1 fix: abort cancels the specific session, not the shared client
    const onAbort = options?.signal
      ? () => {
          log.info({ catId: this.catId, sessionId }, 'ACP session cancelled via abort signal');
          if (sessionId && this.client) {
            this.client.cancelSession(sessionId);
          }
        }
      : undefined;
    if (onAbort && options?.signal) {
      options.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const session = await this.client!.newSession(cwd);
      sessionId = session.sessionId;
      metadata.sessionId = sessionId;

      // R2 fix: abort may have fired during newSession — check before proceeding
      if (options?.signal?.aborted) {
        this.client!.cancelSession(sessionId);
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

      // R3 fix: consumer may abort during the yield above — check before prompt
      if (options?.signal?.aborted) {
        this.client!.cancelSession(sessionId);
        yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
        return;
      }

      // Prepend system prompt (Gemini CLI/ACP has no system prompt flag)
      const effectivePrompt = options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt;

      for await (const event of this.client!.promptStream(sessionId, effectivePrompt)) {
        const msg = transformAcpEvent(event, this.catId, metadata);
        if (msg) yield msg;
      }

      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      const { errorCode, errorMsg } = classifyError(err);
      log.error({ catId: this.catId, errorCode, err: errorMsg }, 'ACP prompt failure');
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
      if (onAbort && options?.signal) {
        options.signal.removeEventListener('abort', onAbort);
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.client?.isAlive) return;

    // Reset stale client
    if (this.client) {
      await this.client.close().catch(() => {});
      this.client = null;
      this.initPromise = null;
    }

    if (!this.initPromise) {
      this.initPromise = this.doInitialize();
    }
    await this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const clientConfig: AcpClientConfig = {
      command: this.config.acpConfig.command,
      args: this.config.acpConfig.startupArgs,
      cwd: this.config.workingDirectory ?? process.cwd(),
      ...(this.config.spawnFn ? { spawnFn: this.config.spawnFn } : {}),
    };
    this.client = new AcpClient(clientConfig);
    const result = await this.client.initialize();
    log.info(
      { catId: this.catId, agent: result.agentInfo.name, version: result.agentInfo.version },
      'ACP client initialized',
    );
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.initPromise = null;
    }
  }
}

function classifyError(err: unknown): { errorCode: string; errorMsg: string } {
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
    return { errorCode: 'lease_timeout', errorMsg: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('ENOENT') || msg.includes('spawn')) {
    return { errorCode: 'init_failure', errorMsg: msg };
  }
  return { errorCode: 'prompt_failure', errorMsg: msg };
}
