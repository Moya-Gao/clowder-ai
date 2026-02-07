/**
 * Agent Router
 * 解析 @ 提及，路由到对应的 Agent Service
 *
 * Features:
 * - 有 @ 提及时路由到指定猫 + 更新对话参与者
 * - 无 @ 提及时路由到对话中所有活跃参与者
 * - 无参与者的新对话默认路由到布偶猫 (opus)
 * - 支持中英文提及模式
 * - ideate intent + 多猫 → 并行独立思考 (routeParallel)
 * - execute intent 或单猫 → 串行执行 (routeSerial)
 * - Session 管理委托给 SessionManager
 */

import { CAT_CONFIGS, createCatId } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID } from './ThreadStore.js';
import { SessionManager } from './SessionManager.js';
import { parseIntent, stripIntentTags } from './IntentParser.js';
import type { IntentResult } from './IntentParser.js';
import { assembleContext } from './ContextAssembler.js';
import { routeSerial, routeParallel } from './route-strategies.js';
import type { RouteStrategyDeps } from './route-strategies.js';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IMessageStore } from './MessageStore.js';
import type { IThreadStore } from './ThreadStore.js';
import type { AgentMessage, AgentService } from './types.js';

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

  /**
   * Read-only target resolution: mentions → participants → default opus.
   * Does NOT mutate thread participants.
   */
  private async peekTargets(message: string, threadId: string): Promise<CatId[]> {
    const mentionedCats = this.parseMentions(message);
    if (mentionedCats.length > 0) return mentionedCats;

    if (this.threadStore) {
      const participants = await this.threadStore.getParticipants(threadId);
      if (participants.length > 0) return participants;
    }

    return [createCatId('opus')];
  }

  /** Resolve target cats and persist new mentions as thread participants */
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

  /** Build shared strategy dependencies */
  private getStrategyDeps(): RouteStrategyDeps {
    const apiPort = process.env['API_SERVER_PORT'] ?? '3002';
    return {
      services: this.services,
      invocationDeps: {
        registry: this.registry,
        sessionManager: this.sessionManager,
        threadStore: this.threadStore,
        apiUrl: `http://127.0.0.1:${apiPort}`,
      },
      messageStore: this.messageStore,
    };
  }

  /**
   * Read-only peek at targets and intent (for pre-route broadcast).
   * Does NOT mutate thread participants — safe to call before route().
   */
  async resolveTargetsAndIntent(
    message: string,
    threadId?: string,
  ): Promise<{ targetCats: CatId[]; intent: IntentResult }> {
    const resolvedThreadId = threadId ?? DEFAULT_THREAD_ID;
    const targetCats = await this.peekTargets(message, resolvedThreadId);
    const intent = parseIntent(message, targetCats.length);
    return { targetCats, intent };
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
    const intent = parseIntent(message, targetCats.length);
    const cleanMessage = stripIntentTags(message);

    if (this.threadStore) {
      await this.threadStore.updateLastActive(resolvedThreadId);
    }

    // Fetch thread history BEFORE storing user message (so user message isn't doubled)
    const historyLimit = Number(process.env['CONTEXT_HISTORY_LIMIT']) || 20;
    const history = await this.messageStore.getByThread(resolvedThreadId, historyLimit);

    // Token budget: total prompt chars - systemPrompt (~300) - user message - overhead
    const maxPromptChars = Number(process.env['MAX_PROMPT_CHARS']) || 32000;
    const budgetForContext = Math.max(0, maxPromptChars - 300 - message.length - 1000);
    const { contextText: contextHistory } = assembleContext(history, {
      maxTotalChars: budgetForContext,
    });

    await this.messageStore.append({
      userId,
      catId: null,
      content: message,  // Store original (with tags) for audit
      mentions: targetCats,
      timestamp: Date.now(),
      threadId: resolvedThreadId,
      ...(contentBlocks ? { contentBlocks } : {}),
    });

    const strategyDeps = this.getStrategyDeps();
    const routeOptions = {
      contentBlocks, uploadDir, signal,
      promptTags: intent.promptTags,
      contextHistory,
    };

    if (intent.intent === 'ideate' && targetCats.length > 1) {
      yield* routeParallel(
        strategyDeps, targetCats, cleanMessage, userId, resolvedThreadId, routeOptions,
      );
    } else {
      yield* routeSerial(
        strategyDeps, targetCats, cleanMessage, userId, resolvedThreadId, routeOptions,
      );
    }
  }
}
