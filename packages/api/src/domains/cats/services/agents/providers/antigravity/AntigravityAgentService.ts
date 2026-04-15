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
  /** Idle stall timeout in ms — resets on each new step (default: 60s) */
  pollTimeoutMs?: number;
  /** Auto-approve pending Antigravity interactions — YOLO mode (default: true) */
  autoApprove?: boolean;
}

export class AntigravityAgentService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;
  private readonly bridge: AntigravityBridge;
  private readonly pollTimeoutMs: number;
  private readonly autoApprove: boolean;

  constructor(options?: AntigravityAgentServiceOptions) {
    this.catId = options?.catId
      ? typeof options.catId === 'string'
        ? createCatId(options.catId)
        : options.catId
      : createCatId('antigravity');
    this.model = options?.model ?? getCatModel(this.catId as string);
    this.bridge = options?.bridge ?? new AntigravityBridge(options?.connection);
    this.pollTimeoutMs = options?.pollTimeoutMs ?? 60_000;
    this.autoApprove = options?.autoApprove ?? process.env['ANTIGRAVITY_AUTO_APPROVE'] !== 'false';
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

      // Antigravity LS validates file paths against its workspace root.
      // Without this hint, the model generates absolute paths that LS rejects.
      // Sanitize path to prevent control-character prompt injection.
      const sanitizedDir = options?.workingDirectory?.split(/[\n\r\x00-\x1f]/)[0]?.trim() ?? '';
      const workspaceHint = sanitizedDir
        ? `\n[Workspace: ${sanitizedDir}]\nAll file paths must be relative to this workspace root. Do not use absolute paths.`
        : '';

      const effectivePrompt = options?.systemPrompt
        ? `${options.systemPrompt}${workspaceHint}\n\n---\n\n${prompt}`
        : workspaceHint
          ? `${workspaceHint.trimStart()}\n\n---\n\n${prompt}`
          : prompt;

      // Create cascade and send message
      const threadId = options?.auditContext?.threadId ?? `ephemeral-${Date.now()}`;
      const cascadeId = await this.bridge.getOrCreateSession(threadId, this.catId as string);
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

      let hasText = false;
      let fatalSeen = false;
      let autoApproveAttempted = false;
      let stallProbed = false;
      let lastDelivered = stepsBefore;
      const pollOnce = async function* (self: AntigravityAgentService, fromStep: number) {
        for await (const batch of self.bridge.pollForSteps(
          cascadeId,
          fromStep,
          self.pollTimeoutMs,
          2_000,
          options?.signal,
        )) {
          if (batch.cursor.awaitingUserInput) {
            if (self.autoApprove && !autoApproveAttempted) {
              autoApproveAttempted = true;
              try {
                await self.bridge.resolveOutstandingSteps(cascadeId);
                log.info(`auto-approved pending interaction for cascade ${cascadeId}`);
                continue;
              } catch (err) {
                log.warn(`auto-approve failed: ${err}`);
              }
            }
            yield {
              type: 'liveness_signal' as const,
              catId: self.catId,
              content: JSON.stringify({ type: 'info', message: 'Antigravity 正在等待权限批准' }),
              metadata,
              errorCode: 'waiting_approval',
              timestamp: Date.now(),
            };
            continue;
          }
          if (batch.steps.length > 0) {
            autoApproveAttempted = false;
            stallProbed = false;
            lastDelivered = batch.cursor.lastDeliveredStepCount;
            const messages = transformTrajectorySteps(batch.steps, self.catId, metadata);
            const fatalErrors: AgentMessage[] = [];
            const seenFatalKeys = new Set<string>();
            for (const msg of messages) {
              if (msg.type === 'text') hasText = true;
              const isFatal = msg.type === 'error' && msg.errorCode && msg.errorCode !== 'tool_error';
              if (isFatal) {
                const key = `${msg.errorCode}:${msg.error}`;
                if (seenFatalKeys.has(key)) {
                  log.info('suppressed duplicate fatal error in same batch: %s', msg.error);
                } else {
                  seenFatalKeys.add(key);
                  fatalErrors.push(msg);
                }
              } else {
                yield msg;
              }
            }
            if (fatalErrors.length > 0) {
              fatalSeen = true;
              const hasUpstreamError = fatalErrors.some((e) => e.errorCode === 'upstream_error');
              for (const err of fatalErrors) {
                if (hasUpstreamError && err.errorCode === 'stream_error') {
                  log.info('suppressed stream_error in favor of upstream_error: %s', err.error);
                  continue;
                }
                yield err;
              }
            }
          }
          if (fatalSeen) {
            log.info('fatal error detected (upstream_error/stream_error), aborting poll loop');
            return;
          }
        }
      };

      // Poll with stall-probe retry: if stall occurs and autoApprove is on,
      // try resolveOutstandingSteps as a probe (LS may not set awaitingUserInput).
      let retry = true;
      while (retry) {
        retry = false;
        try {
          for await (const msg of pollOnce(this, lastDelivered)) {
            yield msg;
          }
        } catch (err) {
          const isStall = err instanceof Error && err.message.includes('stall');
          if (isStall && this.autoApprove && !stallProbed) {
            stallProbed = true;
            try {
              await this.bridge.resolveOutstandingSteps(cascadeId);
              log.info(`probe-approved on stall for cascade ${cascadeId}, retrying poll from step ${lastDelivered}`);
              retry = true;
              continue;
            } catch (probeErr) {
              log.warn(`stall probe failed: ${probeErr}`);
            }
          }
          throw err;
        }
      }

      if (!hasText && !fatalSeen) {
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
