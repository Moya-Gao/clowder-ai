/**
 * Antigravity Agent Service — Bridge-owned writeback architecture.
 *
 * Replaces CDP WebSocket hack with ConnectRPC via AntigravityBridge.
 * Antigravity thinks (via LS cascade), Bridge reads back and yields AgentMessages.
 */
import { type CatId, createCatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../../config/cat-models.js';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from '../../../types.js';
import { AntigravityBridge, type BridgeConnection } from './AntigravityBridge.js';
import { transformTrajectorySteps } from './antigravity-event-transformer.js';

const log = createModuleLogger('antigravity-service');

export interface AntigravityAgentServiceOptions {
  catId?: CatId;
  model?: string;
  /** Manual connection (env vars or explicit config) */
  connection?: Partial<BridgeConnection>;
  /** Inject bridge for testing */
  bridge?: AntigravityBridge;
  /** Poll timeout in ms (default: 180s) */
  pollTimeoutMs?: number;
}

export class AntigravityAgentService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;
  private readonly bridge: AntigravityBridge;
  private readonly pollTimeoutMs: number;

  constructor(options?: AntigravityAgentServiceOptions) {
    this.catId = options?.catId
      ? typeof options.catId === 'string'
        ? createCatId(options.catId)
        : options.catId
      : createCatId('antigravity');
    this.model = options?.model ?? getCatModel(this.catId as string);
    this.bridge = options?.bridge ?? new AntigravityBridge(options?.connection);
    this.pollTimeoutMs = options?.pollTimeoutMs ?? 180_000;
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const metadata: MessageMetadata = {
      provider: 'antigravity',
      model: this.model,
      modelVerified: !!this.bridge.resolveModelId(this.model),
    };

    try {
      // Abort check
      if (options?.signal?.aborted) {
        yield { type: 'error', catId: this.catId, error: 'Aborted before start', metadata, timestamp: Date.now() };
        yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
        return;
      }

      // Prepend system prompt if provided (bridge providers don't have system prompt flags)
      const effectivePrompt = options?.systemPrompt ? `${options.systemPrompt}\n\n---\n\n${prompt}` : prompt;

      // Create cascade and send message
      const threadId = options?.auditContext?.threadId ?? `ephemeral-${Date.now()}`;
      const cascadeId = await this.bridge.getOrCreateSession(threadId);
      log.info(`invoke: cascade=${cascadeId}, thread=${threadId}, model=${this.model}`);

      yield {
        type: 'session_init',
        catId: this.catId,
        sessionId: cascadeId,
        ephemeralSession: true,
        metadata,
        timestamp: Date.now(),
      };

      const stepsBefore = await this.bridge.sendMessage(cascadeId, effectivePrompt, this.model);

      // Abort check after send
      if (options?.signal?.aborted) {
        yield { type: 'error', catId: this.catId, error: 'Aborted after send', metadata, timestamp: Date.now() };
        yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
        return;
      }

      // Poll for new steps only
      const steps = await this.bridge.pollForResponse(cascadeId, stepsBefore, this.pollTimeoutMs);
      const messages = transformTrajectorySteps(steps, this.catId, metadata);

      for (const msg of messages) {
        yield msg;
      }

      if (!messages.some((m) => m.type === 'text')) {
        yield {
          type: 'error',
          catId: this.catId,
          error: 'Antigravity returned no text response',
          errorCode: 'empty_response',
          metadata,
          timestamp: Date.now(),
        };
      }

      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(`invoke failed: ${errorMsg}`);
      yield { type: 'error', catId: this.catId, error: errorMsg, metadata, timestamp: Date.now() };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    }
  }
}
