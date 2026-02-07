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
import { isUnderAllowedRoot } from '../../../utils/project-path.js';
import type { SessionStore } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID } from './ThreadStore.js';
import { SessionManager } from './SessionManager.js';
import { buildSystemPrompt } from './SystemPromptBuilder.js';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IMessageStore } from './MessageStore.js';
import type { IThreadStore } from './ThreadStore.js';
import type { AgentMessage, AgentService, AgentServiceOptions, MessageMetadata } from './types.js';

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
  /** Invocation registry for MCP callback auth */
  registry: InvocationRegistry;
  /** Message store for thread context / mentions */
  messageStore: IMessageStore;
  /** Optional Redis session store; falls back to in-memory Map when absent */
  sessionStore?: SessionStore;
  /** Optional thread store for participant tracking */
  threadStore?: IThreadStore;
}

/**
 * Router that parses @ mentions and routes to appropriate agent services
 */
export class AgentRouter {
  private claudeService: AgentService;
  private codexService: AgentService;
  private geminiService: AgentService;
  private registry: InvocationRegistry;
  private messageStore: IMessageStore;
  private sessionManager: SessionManager;
  private threadStore: IThreadStore | null;

  constructor(options: AgentRouterOptions) {
    this.claudeService = options.claudeService;
    this.codexService = options.codexService;
    this.geminiService = options.geminiService;
    this.registry = options.registry;
    this.messageStore = options.messageStore;
    this.sessionManager = new SessionManager(options.sessionStore);
    this.threadStore = options.threadStore ?? null;
  }

  /**
   * Parse message for @ mentions and return ordered list of cat IDs
   */
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
    switch (catId) {
      case 'opus':
        return this.claudeService;
      case 'codex':
        return this.codexService;
      case 'gemini':
        return this.geminiService;
      default:
        throw new Error(`Unknown cat ID: ${catId as string}`);
    }
  }

  /**
   * Resolve target cats using mentions + thread participants.
   * - Has @mentions → route to those cats, update thread participants
   * - No @mentions + thread has participants → route to all participants
   * - No @mentions + no participants → default to opus
   */
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
      if (participants.length > 0) {
        return participants;
      }
    }

    return [createCatId('opus')];
  }

  /**
   * Route message to appropriate agent(s) based on @ mentions and thread participants
   */
  async *route(
    userId: string,
    message: string,
    threadId?: string,
    contentBlocks?: readonly MessageContent[],
    uploadDir?: string
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

    const previousResponses: { catId: CatId; content: string }[] = [];
    const apiPort = process.env['API_SERVER_PORT'] ?? '3002';
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    const totalCats = targetCats.length;

    for (const [index, catId] of targetCats.entries()) {
      const isLastCat = index === totalCats - 1;
      const service = this.getService(catId);

      let prompt = message;
      if (previousResponses.length > 0) {
        const contextParts = previousResponses.map(
          (r) => `[${r.catId} responded: ${r.content}]`
        );
        prompt = `${message}\n\n${contextParts.join('\n')}`;
      }

      // Prepend identity context so the cat knows who it is
      const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
      const systemPrompt = buildSystemPrompt({
        catId,
        mode: totalCats > 1 ? 'serial' : 'independent',
        chainIndex: index + 1,
        chainTotal: totalCats,
        teammates: targetCats.filter((id) => id !== catId),
        mcpAvailable: catConfig?.mcpSupport ?? false,
      });
      if (systemPrompt) {
        prompt = `${systemPrompt}\n\n---\n\n${prompt}`;
      }

      const { invocationId, callbackToken } = this.registry.create(userId, catId, resolvedThreadId);
      const callbackEnv: Record<string, string> = {
        CAT_CAFE_API_URL: apiUrl,
        CAT_CAFE_INVOCATION_ID: invocationId,
        CAT_CAFE_CALLBACK_TOKEN: callbackToken,
      };

      let textContent = '';
      let firstMetadata: MessageMetadata | undefined;

      try {
        let sessionId: string | undefined;
        try {
          sessionId = await this.sessionManager.get(userId, catId);
        } catch {
          // Redis read failure — continue without session
        }

        // Resolve workingDirectory from thread's projectPath (defensive: re-check boundary)
      let workingDirectory: string | undefined;
      if (this.threadStore) {
        const thread = await this.threadStore.get(resolvedThreadId);
        if (thread?.projectPath && thread.projectPath !== 'default') {
          if (isUnderAllowedRoot(thread.projectPath)) {
            workingDirectory = thread.projectPath;
          }
        }
      }

      const options: AgentServiceOptions = {
          ...(sessionId ? { sessionId } : {}),
          callbackEnv,
          ...(workingDirectory ? { workingDirectory } : {}),
          ...(contentBlocks ? { contentBlocks } : {}),
          ...(uploadDir ? { uploadDir } : {}),
        };

        for await (const msg of service.invoke(prompt, options)) {
          if (msg.type === 'session_init' && msg.sessionId) {
            try {
              await this.sessionManager.store(userId, catId, msg.sessionId);
            } catch {
              // Redis write failure — session won't persist, but chain continues
            }
          }

          if (msg.type === 'text' && msg.content) {
            textContent += msg.content;
          }

          if (msg.metadata && !firstMetadata) {
            firstMetadata = msg.metadata;
          }

          if (msg.type === 'done') {
            yield { ...msg, isFinal: isLastCat };
          } else {
            yield msg;
          }
        }
      } catch (err) {
        yield {
          type: 'error' as const,
          catId,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        };
        yield { type: 'done' as const, catId, isFinal: isLastCat, timestamp: Date.now() };
      }

      if (textContent) {
        previousResponses.push({ catId, content: textContent });
        await this.messageStore.append({
          userId,
          catId,
          content: textContent,
          mentions: [],
          timestamp: Date.now(),
          threadId: resolvedThreadId,
          ...(firstMetadata ? { metadata: firstMetadata } : {}),
        });
      }
    }
  }
}
