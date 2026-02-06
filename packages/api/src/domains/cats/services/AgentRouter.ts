/**
 * Agent Router
 * 解析 @ 提及，路由到对应的 Agent Service
 *
 * Features:
 * - 无 @ 提及时默认路由到布偶猫 (opus)
 * - 支持中英文提及模式
 * - 多猫提及时按出现顺序串行执行
 * - 后一只猫的 prompt 包含前一只猫的回复
 * - Session 管理（内存存储，key 为 userId:catId）
 */

import { CAT_CONFIGS, createCatId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IMessageStore } from './MessageStore.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from './types.js';

/**
 * Parsed mention with position for ordering
 */
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
}

/**
 * Maximum number of sessions to keep in memory
 * Prevents unbounded memory growth before Redis migration in Phase 3
 */
const MAX_SESSIONS = 1000;

/**
 * Router that parses @ mentions and routes to appropriate agent services
 */
export class AgentRouter {
  private claudeService: AgentService;
  private codexService: AgentService;
  private geminiService: AgentService;
  private registry: InvocationRegistry;
  private messageStore: IMessageStore;

  /**
   * In-memory session storage (key: userId:catId, value: sessionId)
   * In Phase 3, this will be migrated to Redis
   * Note: Limited to MAX_SESSIONS entries to prevent unbounded growth
   */
  private sessions: Map<string, string>;

  constructor(options: AgentRouterOptions) {
    this.claudeService = options.claudeService;
    this.codexService = options.codexService;
    this.geminiService = options.geminiService;
    this.registry = options.registry;
    this.messageStore = options.messageStore;
    this.sessions = new Map();
  }

  /**
   * Parse message for @ mentions and return ordered list of cat IDs
   * @param message The user's message
   * @returns Array of cat IDs in order of appearance (deduplicated)
   */
  private parseMentions(message: string): CatId[] {
    const lowerMessage = message.toLowerCase();
    const mentions: ParsedMention[] = [];

    // Check each cat's mention patterns and find the earliest occurrence
    for (const config of Object.values(CAT_CONFIGS)) {
      let earliestPosition = -1;

      // Find the earliest position among all patterns for this cat
      for (const pattern of config.mentionPatterns) {
        const lowerPattern = pattern.toLowerCase();
        const position = lowerMessage.indexOf(lowerPattern);

        if (position !== -1) {
          if (earliestPosition === -1 || position < earliestPosition) {
            earliestPosition = position;
          }
        }
      }

      // If this cat was mentioned, record its earliest position
      if (earliestPosition !== -1) {
        mentions.push({ catId: config.id, position: earliestPosition });
      }
    }

    // Sort by position and extract cat IDs
    mentions.sort((a, b) => a.position - b.position);
    return mentions.map((m) => m.catId);
  }

  /**
   * Get the agent service for a given cat ID
   */
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
   * Get session key for user + cat combination
   */
  private getSessionKey(userId: string, catId: CatId): string {
    return `${userId}:${catId}`;
  }

  /**
   * Store session ID for user + cat combination
   * Evicts oldest entries when MAX_SESSIONS is exceeded (simple LRU)
   */
  private storeSession(userId: string, catId: CatId, sessionId: string): void {
    const key = this.getSessionKey(userId, catId);

    // If key already exists, delete it first so it moves to the end (most recent)
    if (this.sessions.has(key)) {
      this.sessions.delete(key);
    }

    // Evict oldest entries if we're at capacity
    while (this.sessions.size >= MAX_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey !== undefined) {
        this.sessions.delete(oldestKey);
      }
    }

    this.sessions.set(key, sessionId);
  }

  /**
   * Get stored session ID for user + cat combination
   */
  private getSession(userId: string, catId: CatId): string | undefined {
    const key = this.getSessionKey(userId, catId);
    return this.sessions.get(key);
  }

  /**
   * Route message to appropriate agent(s) based on @ mentions
   * @param userId User ID for session management
   * @param message The user's message
   * @returns AsyncIterable of agent messages from all invoked agents
   */
  async *route(userId: string, message: string): AsyncIterable<AgentMessage> {
    // Parse mentions to get ordered list of cats to invoke
    let targetCats = this.parseMentions(message);

    // Default to opus if no mentions
    if (targetCats.length === 0) {
      targetCats = [createCatId('opus')];
    }

    // Store user message to MessageStore
    await this.messageStore.append({
      userId,
      catId: null,
      content: message,
      mentions: targetCats,
      timestamp: Date.now(),
    });

    // Accumulate responses for chaining
    const previousResponses: { catId: CatId; content: string }[] = [];

    // API URL for MCP callback tools
    const apiPort = process.env['API_SERVER_PORT'] ?? '3002';
    const apiUrl = `http://127.0.0.1:${apiPort}`;

    // Invoke each cat in order
    const totalCats = targetCats.length;
    for (const [index, catId] of targetCats.entries()) {
      const isLastCat = index === totalCats - 1;
      const service = this.getService(catId);

      // Build prompt: original message + previous responses
      let prompt = message;
      if (previousResponses.length > 0) {
        const contextParts = previousResponses.map(
          (r) => `[${r.catId} responded: ${r.content}]`
        );
        prompt = `${message}\n\n${contextParts.join('\n')}`;
      }

      // Get stored session for this user + cat
      const sessionId = this.getSession(userId, catId);

      // Create invocation for MCP callback auth
      const { invocationId, callbackToken } = this.registry.create(userId, catId);
      const callbackEnv: Record<string, string> = {
        CAT_CAFE_API_URL: apiUrl,
        CAT_CAFE_INVOCATION_ID: invocationId,
        CAT_CAFE_CALLBACK_TOKEN: callbackToken,
      };

      const options: AgentServiceOptions = {
        ...(sessionId ? { sessionId } : {}),
        callbackEnv,
      };

      // Collect text content for chaining
      let textContent = '';

      try {
        // Invoke the service and yield messages
        for await (const msg of service.invoke(prompt, options)) {
          // Store session ID when we receive session_init
          if (msg.type === 'session_init' && msg.sessionId) {
            this.storeSession(userId, catId, msg.sessionId);
          }

          // Accumulate text content for chaining
          if (msg.type === 'text' && msg.content) {
            textContent += msg.content;
          }

          // For 'done' messages, mark isFinal only for the last cat
          if (msg.type === 'done') {
            yield { ...msg, isFinal: isLastCat };
          } else {
            yield msg;
          }
        }
      } catch (err) {
        // Single cat error should not break the multi-cat chain
        yield {
          type: 'error' as const,
          catId,
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        };
        // Still yield done so the chain can continue
        yield { type: 'done' as const, catId, isFinal: isLastCat, timestamp: Date.now() };
      }

      // Store cat's response for next cat in chain + thread context
      if (textContent) {
        previousResponses.push({ catId, content: textContent });
        await this.messageStore.append({
          userId,
          catId,
          content: textContent,
          mentions: [],
          timestamp: Date.now(),
        });
      }
    }
  }
}
