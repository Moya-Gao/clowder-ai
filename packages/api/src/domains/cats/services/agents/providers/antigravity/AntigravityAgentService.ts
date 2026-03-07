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
import { AntigravityCdpClient } from './AntigravityCdpClient.js';

/** Duck-typed CDP client interface for dependency injection */
interface CdpClientLike {
  connected: boolean;
  connect(runtimeTitleHint?: string): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(text: string): Promise<void>;
  pollResponse(timeoutMs?: number): Promise<string | null>;
  newConversation(): Promise<void>;
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
    // CDP bridge cannot verify which model Antigravity actually uses —
    // the UI model may differ from the configured variant model.
    // Model switching is Phase 2 (AC-9). Until then, mark as unverified.
    const metadata: MessageMetadata = {
      provider: 'antigravity',
      model: this.model,
      modelVerified: false,
    };

    try {
      if (!this.cdpClient.connected) {
        // Derive titleHint from workingDirectory (last path segment = project name)
        const titleHint = options?.workingDirectory
          ? options.workingDirectory.split('/').filter(Boolean).pop()
          : undefined;
        await this.cdpClient.connect(titleHint);
      }

      await this.cdpClient.newConversation();
      await this.cdpClient.sendMessage(prompt);

      const response = await this.cdpClient.pollResponse(60_000);

      if (response === null) {
        yield {
          type: 'error',
          catId: this.catId,
          error: 'Antigravity response timeout — 60s 内未收到回复',
          metadata,
          timestamp: Date.now(),
        };
      } else {
        yield {
          type: 'text',
          catId: this.catId,
          content: response,
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
