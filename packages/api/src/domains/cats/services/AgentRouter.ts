/**
 * Agent Router
 * 解析 @ 提及，路由到对应的 Agent Service
 *
 * Features:
 * - 有 @ 提及时路由到指定猫 + 更新对话参与者
 * - 无 @ 提及时路由到对话中所有活跃参与者
 * - 无参与者的新对话默认路由到布偶猫 (opus)
 * - 支持中英文提及模式
 * - ideate intent + 多猫 → 并行独立思考 (mergeStreams)
 * - execute intent 或单猫 → 串行执行 (前猫回复注入后猫)
 * - Session 管理委托给 SessionManager
 */

import { CAT_CONFIGS, createCatId } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID } from './ThreadStore.js';
import { SessionManager } from './SessionManager.js';
import { buildSystemPrompt } from './SystemPromptBuilder.js';
import { parseIntent, stripIntentTags } from './IntentParser.js';
import type { IntentResult } from './IntentParser.js';
import { invokeSingleCat } from './invoke-single-cat.js';
import type { InvocationDeps } from './invoke-single-cat.js';
import { mergeStreams } from './stream-merge.js';
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
   * Resolve targets and intent for a message (public, for pre-route broadcast).
   * Does NOT have side effects — call route() to actually execute.
   */
  async resolveTargetsAndIntent(
    message: string,
    threadId?: string,
  ): Promise<{ targetCats: CatId[]; intent: IntentResult }> {
    const resolvedThreadId = threadId ?? DEFAULT_THREAD_ID;
    const targetCats = await this.resolveTargets(message, resolvedThreadId);
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

    await this.messageStore.append({
      userId,
      catId: null,
      content: message,  // Store original (with tags) for audit
      mentions: targetCats,
      timestamp: Date.now(),
      threadId: resolvedThreadId,
      ...(contentBlocks ? { contentBlocks } : {}),
    });

    if (intent.intent === 'ideate' && targetCats.length > 1) {
      yield* this.routeParallel(
        targetCats, cleanMessage, userId, resolvedThreadId,
        contentBlocks, uploadDir, signal, intent.promptTags,
      );
    } else {
      yield* this.routeSerial(
        targetCats, cleanMessage, userId, resolvedThreadId,
        contentBlocks, uploadDir, signal, intent.promptTags,
      );
    }
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
    promptTags?: readonly string[],
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
        ...(promptTags && promptTags.length > 0 ? { promptTags } : {}),
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

  /** Parallel execution: all cats respond independently to the same message */
  private async *routeParallel(
    targetCats: CatId[],
    message: string,
    userId: string,
    threadId: string,
    contentBlocks?: readonly MessageContent[],
    uploadDir?: string,
    signal?: AbortSignal,
    promptTags?: readonly string[],
  ): AsyncIterable<AgentMessage> {
    const deps = this.getInvocationDeps();
    const mcpServerPath = process.env['CAT_CAFE_MCP_SERVER_PATH'];

    const streams = targetCats.map((catId) => {
      const catConfig = CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS];
      const systemPrompt = buildSystemPrompt({
        catId,
        mode: 'parallel',
        teammates: targetCats.filter((id) => id !== catId),
        mcpAvailable: (catConfig?.mcpSupport ?? false) && !!mcpServerPath,
        ...(promptTags && promptTags.length > 0 ? { promptTags } : {}),
      });
      const prompt = systemPrompt
        ? `${systemPrompt}\n\n---\n\n${message}`
        : message;

      return invokeSingleCat(deps, {
        catId,
        service: this.getService(catId),
        prompt,
        userId,
        threadId,
        ...(contentBlocks ? { contentBlocks } : {}),
        ...(uploadDir ? { uploadDir } : {}),
        ...(signal ? { signal } : {}),
        isLastCat: false,
      });
    });

    const catText = new Map<string, string>();
    const catMeta = new Map<string, MessageMetadata>();
    let completedCount = 0;

    for await (const msg of mergeStreams(streams, (idx, err) => {
      console.error(`[routeParallel] Stream ${idx} error:`, err);
    })) {
      if (msg.type === 'text' && msg.content && msg.catId) {
        catText.set(msg.catId, (catText.get(msg.catId) ?? '') + msg.content);
      }
      if (msg.metadata && msg.catId && !catMeta.has(msg.catId)) {
        catMeta.set(msg.catId, msg.metadata);
      }

      if (msg.type === 'done' && msg.catId) {
        completedCount++;
        const text = catText.get(msg.catId);
        if (text) {
          const meta = catMeta.get(msg.catId);
          await this.messageStore.append({
            userId,
            catId: msg.catId as CatId,
            content: text,
            mentions: [],
            timestamp: Date.now(),
            threadId,
            ...(meta ? { metadata: meta } : {}),
          });
        }
        yield { ...msg, isFinal: completedCount === targetCats.length };
      } else {
        yield msg;
      }
    }
  }
}
