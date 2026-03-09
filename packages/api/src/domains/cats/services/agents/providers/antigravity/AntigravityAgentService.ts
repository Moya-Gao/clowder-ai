/**
 * Antigravity Agent Service
 * CDP 桥接入口 — 通过 Chrome DevTools Protocol 与 Antigravity IDE 通信
 *
 * 与 GeminiAgentService 的 antigravity adapter 不同:
 *   GeminiAgentService.antigravity = spawn CLI + MCP 回传 (半自动)
 *   AntigravityAgentService       = CDP WebSocket 桥 (全自动, 无需 MCP callback)
 */

import { type CatId, createCatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../../config/cat-models.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from '../../../types.js';
import { AntigravityCdpClient, type PollResponseOptions, type PollResponseResult } from './AntigravityCdpClient.js';

/** Duck-typed CDP client interface for dependency injection */
interface CdpClientLike {
  connected: boolean;
  connect(runtimeTitleHint?: string): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(text: string): Promise<void>;
  pollResponse(idleTimeoutMs?: number, options?: PollResponseOptions): Promise<PollResponseResult | null>;
  newConversation(): Promise<void>;
  getCurrentModel?(): Promise<string | null>;
  switchModel?(targetModelLabel: string): Promise<void>;
}

/** Map cat-config model IDs to Antigravity UI dropdown labels. */
const MODEL_LABEL_MAP: Record<string, string> = {
  'gemini-3.1-pro': 'Gemini 3.1 Pro',
  'gemini-3-flash': 'Gemini 3 Flash',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'gpt-oss-120b': 'GPT-OSS 120B',
};

function resolveModelLabel(modelId: string): string | undefined {
  return MODEL_LABEL_MAP[modelId];
}

export interface AntigravityAgentServiceOptions {
  catId?: CatId;
  model?: string;
  cdpPort?: number;
  /** Substring to match in CDP target title (e.g. project name) */
  titleHint?: string;
  /** Inject mock CDP client for testing */
  cdpClient?: CdpClientLike;
}

export class AntigravityAgentService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;
  private readonly cdpClient: CdpClientLike;

  constructor(options?: AntigravityAgentServiceOptions) {
    this.catId = options?.catId
      ? typeof options.catId === 'string'
        ? createCatId(options.catId)
        : options.catId
      : createCatId('antigravity');
    this.model = options?.model ?? getCatModel(this.catId as string);
    this.cdpClient =
      options?.cdpClient ??
      new AntigravityCdpClient({
        ...(options?.cdpPort ? { port: options.cdpPort } : {}),
        ...(options?.titleHint ? { titleHint: options.titleHint } : {}),
      });
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const metadata: MessageMetadata = { provider: 'antigravity', model: this.model, modelVerified: false };

    try {
      if (!this.cdpClient.connected) {
        const titleHint = options?.workingDirectory
          ? options.workingDirectory.split('/').filter(Boolean).pop()
          : undefined;
        await this.cdpClient.connect(titleHint);
      }

      // Switch model if CDP client supports it (AC-9)
      if (this.cdpClient.switchModel) {
        const label = resolveModelLabel(this.model);
        if (label) {
          await this.cdpClient.switchModel(label);
          metadata.modelVerified = true;
        }
      }

      await this.cdpClient.newConversation();
      await this.cdpClient.sendMessage(prompt);

      const result = await this.cdpClient.pollResponse(60_000);

      if (result === null) {
        yield {
          type: 'error',
          catId: this.catId,
          error: 'Antigravity response timeout — 60s 内未收到回复',
          metadata,
          timestamp: Date.now(),
        };
      } else {
        if (result.thinking) {
          yield {
            type: 'system_info',
            catId: this.catId,
            content: JSON.stringify({ type: 'thinking', text: result.thinking }),
            metadata,
            timestamp: Date.now(),
          };
        }
        yield {
          type: 'text',
          catId: this.catId,
          content: result.text,
          metadata,
          timestamp: Date.now(),
        };
      }

      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } catch (err) {
      yield {
        type: 'error',
        catId: this.catId,
        error: err instanceof Error ? err.message : String(err),
        metadata,
        timestamp: Date.now(),
      };
      yield { type: 'done', catId: this.catId, metadata, timestamp: Date.now() };
    } finally {
      try {
        await this.cdpClient.disconnect();
      } catch {
        /* best effort */
      }
    }
  }
}
