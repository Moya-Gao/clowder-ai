/**
 * Message Store
 * 内存消息存储，供 MCP 回传工具 get_thread_context / get_pending_mentions 使用
 *
 * 有界数组实现，超过 MAX_MESSAGES 时丢弃最旧消息。
 * Phase 3 将迁移到 Redis。
 */

import { randomUUID } from 'node:crypto';
import type { CatId } from '@cat-cafe/shared';

/**
 * A stored message entry
 */
export interface StoredMessage {
  id: string;
  userId: string;
  /** null = user message, CatId = cat message */
  catId: CatId | null;
  content: string;
  /** CatIds mentioned in this message */
  mentions: readonly CatId[];
  timestamp: number;
}

/**
 * Common interface for message stores (in-memory and Redis).
 * Methods that may hit Redis are async; in-memory returns immediately.
 */
export interface IMessageStore {
  append(msg: Omit<StoredMessage, 'id'>): StoredMessage | Promise<StoredMessage>;
  getRecent(limit?: number, userId?: string): StoredMessage[] | Promise<StoredMessage[]>;
  getMentionsFor(catId: CatId, limit?: number, userId?: string): StoredMessage[] | Promise<StoredMessage[]>;
  getBefore(timestamp: number, limit?: number, userId?: string): StoredMessage[] | Promise<StoredMessage[]>;
}

/** Max messages to keep in memory */
const MAX_MESSAGES = 2000;

/** Default limit for queries */
const DEFAULT_LIMIT = 50;

/**
 * In-memory bounded message store.
 */
export class MessageStore {
  private messages: StoredMessage[] = [];
  private readonly maxMessages: number;

  constructor(options?: { maxMessages?: number }) {
    this.maxMessages = options?.maxMessages ?? MAX_MESSAGES;
  }

  /**
   * Append a message to the store. Returns the stored message with generated id.
   */
  append(
    msg: Omit<StoredMessage, 'id'>
  ): StoredMessage {
    const stored: StoredMessage = { ...msg, id: randomUUID() };
    this.messages.push(stored);

    // Trim oldest if over capacity
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    return stored;
  }

  /**
   * Get the most recent N messages.
   * When userId is provided, only returns messages from that user's session.
   */
  getRecent(limit?: number, userId?: string): StoredMessage[] {
    const n = limit ?? DEFAULT_LIMIT;

    if (!userId) {
      return this.messages.slice(-n);
    }

    const matches: StoredMessage[] = [];
    for (let i = this.messages.length - 1; i >= 0 && matches.length < n; i--) {
      const msg = this.messages[i]!;
      if (msg.userId === userId) {
        matches.push(msg);
      }
    }
    return matches.reverse();
  }

  /**
   * Get recent messages that mention a specific cat.
   * When userId is provided, only returns messages from that user's session.
   */
  getMentionsFor(catId: CatId, limit?: number, userId?: string): StoredMessage[] {
    const n = limit ?? DEFAULT_LIMIT;
    const matches: StoredMessage[] = [];

    // Walk backwards for efficiency
    for (let i = this.messages.length - 1; i >= 0 && matches.length < n; i--) {
      const msg = this.messages[i]!;
      if (msg.mentions.includes(catId) && (!userId || msg.userId === userId)) {
        matches.push(msg);
      }
    }

    // Reverse so oldest first
    return matches.reverse();
  }

  /**
   * Get messages before a given timestamp (cursor-based pagination).
   * Returns messages in chronological order (oldest first).
   */
  getBefore(timestamp: number, limit?: number, userId?: string): StoredMessage[] {
    const n = limit ?? DEFAULT_LIMIT;
    const matches: StoredMessage[] = [];

    // Walk backwards from most recent, collecting messages before the cursor
    for (let i = this.messages.length - 1; i >= 0 && matches.length < n; i--) {
      const msg = this.messages[i]!;
      if (msg.timestamp >= timestamp) continue;
      if (userId && msg.userId !== userId) continue;
      matches.push(msg);
    }

    // Reverse so oldest first
    return matches.reverse();
  }

  /**
   * Current message count (for testing)
   */
  get size(): number {
    return this.messages.length;
  }
}
