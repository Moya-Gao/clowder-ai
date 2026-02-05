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
}

/**
 * Router that parses @ mentions and routes to appropriate agent services
 */
export class AgentRouter {
  private claudeService: AgentService;
  private codexService: AgentService;
  private geminiService: AgentService;

  /**
   * In-memory session storage (key: userId:catId, value: sessionId)
   * In Phase 3, this will be migrated to Redis
   */
  private sessions: Map<string, string>;

  constructor(options: AgentRouterOptions) {
    this.claudeService = options.claudeService;
    this.codexService = options.codexService;
    this.geminiService = options.geminiService;
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
    const seenCats = new Set<string>();

    // Check each cat's mention patterns
    for (const config of Object.values(CAT_CONFIGS)) {
      for (const pattern of config.mentionPatterns) {
        const lowerPattern = pattern.toLowerCase();
        const position = lowerMessage.indexOf(lowerPattern);

        if (position !== -1 && !seenCats.has(config.id)) {
          mentions.push({ catId: config.id, position });
          seenCats.add(config.id);
          break; // Found a match for this cat, no need to check other patterns
        }
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
   */
  private storeSession(userId: string, catId: CatId, sessionId: string): void {
    const key = this.getSessionKey(userId, catId);
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

    // Accumulate responses for chaining
    const previousResponses: { catId: CatId; content: string }[] = [];

    // Invoke each cat in order
    for (const catId of targetCats) {
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
      const options: AgentServiceOptions = sessionId ? { sessionId } : {};

      // Collect text content for chaining
      let textContent = '';

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

        // Yield all messages except 'done' for intermediate cats
        // (we want continuous streaming without intermediate 'done' messages)
        yield msg;
      }

      // Store response for next cat in chain
      if (textContent) {
        previousResponses.push({ catId, content: textContent });
      }
    }
  }
}
