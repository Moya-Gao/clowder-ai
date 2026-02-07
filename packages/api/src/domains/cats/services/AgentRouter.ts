/**
 * Agent Router
 * 解析 @ 提及，路由到对应的 Agent Service
 *
 * Features:
 * - 有 @ 提及时路由到指定猫 + 更新对话参与者
 * - 无 @ 提及时路由到对话中所有活跃参与者
 * - 无参与者的新对话默认路由到布偶猫 (opus)
 * - 支持中英文提及模式
 * - 多猫提及时按出现顺序串行执行
 * - 后一只猫的 prompt 包含前一只猫的回复
 * - Session 管理委托给 SessionManager
 */

import { CAT_CONFIGS, createCatId } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID } from './ThreadStore.js';
import { SessionManager } from './SessionManager.js';
import { buildSystemPrompt } from './SystemPromptBuilder.js';
import { invokeSingleCat } from './invoke-single-cat.js';
import type { InvocationDeps } from './invoke-single-cat.js';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IMessageStore } from './MessageStore.js';
import type { IThreadStore } from './ThreadStore.js';
import type { AgentMessage, AgentService } from './types.js';
import type { MessageMetadata } from './types.js';

/** Parsed mention with position for ordering */
interface ParsedMention {
  catId: CatId;
  position: number;
}

/**
 * Options for AgentRouter constructor
 */
export interface AgentRouterOptions {
  claudeService: AgentService;
  codexService: AgentService;
  geminiService: AgentService;
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  sessionStore?: SessionStore;
  threadStore?: IThreadStore;
}

/**
 * Router that parses @ mentions and routes to appropriate agent services
 */
export class AgentRouter {
  private services: Record<string, AgentService>;
  private registry: InvocationRegistry;
  private messageStore: IMessageStore;
  private sessionManager: SessionManager;
  private threadStore: IThreadStore | null;

  constructor(options: AgentRouterOptions) {
    this.services = {
      opus: options.claudeService,
      codex: options.codexService,
      gemini: options.geminiService,
    };
    this.registry = options.registry;
    this.messageStore = options.messageStore;
    this.sessionManager = new SessionManager(options.sessionStore);
    this.threadStore = options.threadStore ?? null;
  }

  /** Parse message for @ mentions and return ordered list of cat IDs */
  private parseMentions(message: string): CatId[] {
    const lowerMessage = message.toLowerCase();
    const mentions: ParsedMention[] = [];

    for (const config of Object.values(CAT_CONFIGS)) {
      let earliestPosition = -1;
      for (const pattern of config.mentionPatterns) {
        const position = lowerMessage.indexOf(pattern.toLowerCase());
        if (position !== -1 && (earliestPosition === -1 || position < earliestPosition)) {
          earliestPosition = position;
        }
      }
      if (earliestPosition !== -1) {
        mentions.push({ catId: config.id, position: earliestPosition });
      }
    }

    mentions.sort((a, b) => a.position - b.position);
    return mentions.map((m) => m.catId);
  }

  /** Get the agent service for a given cat ID */
  private getService(catId: CatId): AgentService {
    const service = this.services[catId];
    if (!service) throw new Error(`Unknown cat ID: ${catId as string}`);
    return service;
  }

  /** Resolve target cats using mentions + thread participants */
  private async resolveTargets(message: string, threadId: string): Promise<CatId[]> {
    const mentionedCats = this.parseMentions(message);

    if (mentionedCats.length > 0) {
      if (this.threadStore) {
        await this.threadStore.addParticipants(threadId, mentionedCats);
      }
      return mentionedCats;
    }

    if (this.threadStore) {
      const participants = await this.threadStore.getParticipants(threadId);
      if (participants.length > 0) return participants;
    }

    return [createCatId('opus')];
  }

  /** Build shared invocation dependencies */
  private getInvocationDeps(): InvocationDeps {
    const apiPort = process.env['API_SERVER_PORT'] ?? '3002';
    return {
      registry: this.registry,
      sessionManager: this.sessionManager,
      threadStore: this.threadStore,
      apiUrl: `http://127.0.0.1:${apiPort}`,
    };
  }

  /**
   * Route message to appropriate agent(s) based on @ mentions and thread participants
   */
  async *route(
    userId: string,
    message: string,
    threadId?: string,
    contentBlocks?: readonly MessageContent[],
    uploadDir?: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentMessage> {
    const resolvedThreadId = threadId ?? DEFAULT_THREAD_ID;
    const targetCats = await this.resolveTargets(message, resolvedThreadId);

    if (this.threadStore) {
      await this.threadStore.updateLastActive(resolvedThreadId);
    }

    await this.messageStore.append({
      userId,
      catId: null,
      content: message,
      mentions: targetCats,
      timestamp: Date.now(),
      threadId: resolvedThreadId,
      ...(contentBlocks ? { contentBlocks } : {}),
    });

    yield* this.routeSerial(
      targetCats, message, userId, resolvedThreadId,
      contentBlocks, uploadDir, signal,
    );
  }

  /** Serial execution: cats respond one by one, each seeing previous responses */
  private async *routeSerial(
    targetCats: CatId[],
    message: string,
    userId: string,
    threadId: string,
    contentBlocks?: readonly MessageContent[],
    uploadDir?: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentMessage> {
    const previousResponses: { catId: CatId; content: string }[] = [];
    const deps = this.getInvocationDeps();
    const totalCats = targetCats.length;

    for (const [index, catId] of targetCats.entries()) {
      if (signal?.aborted) break;

      let prompt = message;
      if (previousResponses.length > 0) {
        const contextParts = previousResponses.map(
          (r) => `[${r.catId} responded: ${r.content}]`
        );
        prompt = `${message}\n\n${contextParts.join('\n')}`;
      }

      // Build identity system prompt
      const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
      const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];
      const systemPrompt = buildSystemPrompt({
        catId,
        mode: totalCats > 1 ? 'serial' : 'independent',
        chainIndex: index + 1,
        chainTotal: totalCats,
        teammates: targetCats.filter((id) => id !== catId),
        mcpAvailable: (catConfig?.mcpSupport ?? false) && !!mcpServerPath,
      });
      if (systemPrompt) {
        prompt = `${systemPrompt}\n\n---\n\n${prompt}`;
      }

      let textContent = '';
      let firstMetadata: MessageMetadata | undefined;

      for await (const msg of invokeSingleCat(deps, {
        catId,
        service: this.getService(catId),
        prompt,
        userId,
        threadId,
        ...(contentBlocks ? { contentBlocks } : {}),
        ...(uploadDir ? { uploadDir } : {}),
        ...(signal ? { signal } : {}),
        isLastCat: index === totalCats - 1,
      })) {
        if (msg.type === 'text' && msg.content) {
          textContent += msg.content;
        }
        if (msg.metadata && !firstMetadata) {
          firstMetadata = msg.metadata;
        }
        yield msg;
      }

      if (textContent) {
        previousResponses.push({ catId, content: textContent });
        await this.messageStore.append({
          userId,
          catId,
          content: textContent,
          mentions: [],
          timestamp: Date.now(),
          threadId,
          ...(firstMetadata ? { metadata: firstMetadata } : {}),
        });
      }
    }
  }
}
