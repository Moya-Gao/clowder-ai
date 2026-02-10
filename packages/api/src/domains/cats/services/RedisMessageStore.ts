/**
 * Redis Message Store
 * Redis-backed message storage with same interface as in-memory MessageStore.
 *
 * Redis 数据结构:
 *   cat-cafe:msg:{id}                → Hash (消息详情)
 *   cat-cafe:msg:timeline            → Sorted Set (全局时间线, score=timestamp)
 *   cat-cafe:msg:user:{userId}       → Sorted Set (用户维度)
 *   cat-cafe:msg:mentions:{catId}    → Sorted Set (提及维度)
 *   cat-cafe:msg:thread:{threadId}   → Sorted Set (对话维度)
 *
 * 消息 TTL 可配置 (默认 7 天)。
 */

import type { CatId, MessageContent } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID, generateSortableId } from './MessageStore.js';
import type { AppendMessageInput, StoredMessage } from './MessageStore.js';
import type { MessageMetadata } from './types.js';
import { MessageKeys } from './message-keys.js';

const DEFAULT_LIMIT = 50;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class RedisMessageStore {
  private readonly redis: RedisClient;
  /** null means no expiration/pruning (persistent retention). */
  private readonly ttlSeconds: number | null;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number }) {
    this.redis = redis;
    const ttl = options?.ttlSeconds;
    if (ttl === undefined) {
      this.ttlSeconds = DEFAULT_TTL_SECONDS;
    } else if (!Number.isFinite(ttl)) {
      this.ttlSeconds = DEFAULT_TTL_SECONDS;
    } else if (ttl <= 0) {
      this.ttlSeconds = null;
    } else {
      this.ttlSeconds = Math.floor(ttl);
    }
  }

  async append(msg: AppendMessageInput): Promise<StoredMessage> {
    const id = generateSortableId(msg.timestamp);
    const threadId = msg.threadId ?? DEFAULT_THREAD_ID;
    const stored: StoredMessage = { ...msg, id, threadId };
    const score = msg.timestamp;

    const hashKey = MessageKeys.detail(id);
    const pipeline = this.redis.multi();

    // Store message hash (including threadId, contentBlocks, metadata)
    pipeline.hset(hashKey, {
      id,
      threadId,
      userId: msg.userId,
      catId: msg.catId ?? '',
      content: msg.content,
      contentBlocks: msg.contentBlocks ? JSON.stringify(msg.contentBlocks) : '',
      metadata: msg.metadata ? JSON.stringify(msg.metadata) : '',
      mentions: JSON.stringify(msg.mentions),
      timestamp: String(msg.timestamp),
    });
    if (this.ttlSeconds !== null) {
      pipeline.expire(hashKey, this.ttlSeconds);
    }

    // Add to global timeline
    pipeline.zadd(MessageKeys.TIMELINE, String(score), id);

    // Add to user timeline
    pipeline.zadd(MessageKeys.user(msg.userId), String(score), id);

    // Add to thread timeline
    pipeline.zadd(MessageKeys.thread(threadId), String(score), id);

    // Add to per-cat mention sets
    for (const catId of msg.mentions) {
      pipeline.zadd(MessageKeys.mentions(catId), String(score), id);
    }

    if (this.ttlSeconds !== null) {
      // Prune expired entries from sorted sets (score < now - TTL).
      const cutoff = String(Date.now() - this.ttlSeconds * 1000);
      pipeline.zremrangebyscore(MessageKeys.TIMELINE, '-inf', cutoff);
      pipeline.zremrangebyscore(MessageKeys.user(msg.userId), '-inf', cutoff);
      pipeline.zremrangebyscore(MessageKeys.thread(threadId), '-inf', cutoff);
      for (const catId of msg.mentions) {
        pipeline.zremrangebyscore(MessageKeys.mentions(catId), '-inf', cutoff);
      }

      // Set EXPIRE on index zsets so "silent" keys eventually disappear
      pipeline.expire(MessageKeys.TIMELINE, this.ttlSeconds);
      pipeline.expire(MessageKeys.user(msg.userId), this.ttlSeconds);
      pipeline.expire(MessageKeys.thread(threadId), this.ttlSeconds);
      for (const catId of msg.mentions) {
        pipeline.expire(MessageKeys.mentions(catId), this.ttlSeconds);
      }
    }

    await pipeline.exec();
    return stored;
  }

  async getById(id: string): Promise<StoredMessage | null> {
    const data = await this.redis.hgetall(MessageKeys.detail(id));
    if (!data || !data['id']) return null;

    const contentBlocks = safeParseContentBlocks(data['contentBlocks']);
    const parsedMetadata = safeParseMetadata(data['metadata']);
    const deletedAt = data['deletedAt'] ? parseInt(data['deletedAt'], 10) : undefined;
    return {
      id: data['id'],
      threadId: data['threadId'] || DEFAULT_THREAD_ID,
      userId: data['userId'] ?? 'unknown',
      catId: (data['catId'] || null) as CatId | null,
      content: data['content'] ?? '',
      ...(contentBlocks ? { contentBlocks } : {}),
      ...(parsedMetadata ? { metadata: parsedMetadata } : {}),
      mentions: safeParseMentions(data['mentions']),
      timestamp: parseInt(data['timestamp'] ?? '0', 10),
      ...(deletedAt ? { deletedAt, deletedBy: data['deletedBy'] ?? '' } : {}),
    };
  }

  async getRecent(limit?: number, userId?: string): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const key = userId ? MessageKeys.user(userId) : MessageKeys.TIMELINE;

    const ids = await this.redis.zrevrange(key, 0, n - 1);
    if (ids.length === 0) return [];

    return this.hydrateMessages(ids.reverse());
  }

  async getMentionsFor(
    catId: CatId,
    limit?: number,
    userId?: string
  ): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const mentionKey = MessageKeys.mentions(catId);

    let ids: string[];
    if (userId) {
      const CHUNK = 50;
      ids = [];
      let offset = 0;
      while (ids.length < n) {
        const chunk = await this.redis.zrevrange(mentionKey, offset, offset + CHUNK - 1);
        if (chunk.length === 0) break;
        for (const id of chunk) {
          if (ids.length >= n) break;
          const score = await this.redis.zscore(MessageKeys.user(userId), id);
          if (score !== null) ids.push(id);
        }
        offset += CHUNK;
      }
    } else {
      ids = await this.redis.zrevrange(mentionKey, 0, n - 1);
    }

    if (ids.length === 0) return [];
    return this.hydrateMessages(ids.reverse());
  }

  async getBefore(
    timestamp: number,
    limit?: number,
    userId?: string,
    beforeId?: string
  ): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const key = userId ? MessageKeys.user(userId) : MessageKeys.TIMELINE;

    if (!beforeId) {
      const ids = await this.redis.zrevrangebyscore(
        key, `(${timestamp}`, '-inf', 'LIMIT', 0, n
      );
      if (ids.length === 0) return [];
      return this.hydrateMessages(ids.reverse());
    }

    const ids = await this.fetchBeforeWithCursor(key, timestamp, beforeId, n);
    if (ids.length === 0) return [];
    return this.hydrateMessages(ids.reverse());
  }

  async getByThread(threadId: string, limit?: number, userId?: string): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const key = MessageKeys.thread(threadId);

    // Over-fetch when userId filter is needed, then trim after hydration
    const fetchN = userId ? n * 2 : n;
    const ids = await this.redis.zrevrange(key, 0, fetchN - 1);
    if (ids.length === 0) return [];

    const messages = await this.hydrateMessages(ids.reverse());
    if (!userId) return messages.slice(-n);
    return messages.filter((m) => m.userId === userId).slice(-n);
  }

  /**
   * Get messages in a thread after a cursor ID (exclusive), oldest first.
   * If afterId is undefined, returns from thread start.
   * If limit is undefined, returns all matches.
   */
  async getByThreadAfter(
    threadId: string,
    afterId?: string,
    limit?: number,
    userId?: string
  ): Promise<StoredMessage[]> {
    const key = MessageKeys.thread(threadId);

    let ids: string[];
    if (!afterId) {
      if (limit && limit > 0) {
        ids = await this.redis.zrange(key, 0, limit - 1);
      } else {
        ids = await this.redis.zrange(key, 0, -1);
      }
    } else {
      const afterScore = await this.redis.zscore(key, afterId);
      if (afterScore === null) {
        // Cursor message may have expired; fall back to lexicographic ID filtering.
        ids = await this.redis.zrange(key, 0, -1);
        ids = ids.filter((id) => id > afterId);
      } else {
        // Fetch from cursor score onward, then trim strictly by ID.
        const allAfterScore = await this.redis.zrangebyscore(key, afterScore, '+inf');
        ids = allAfterScore.filter((id) => {
          if (id === afterId) return false;
          return id > afterId;
        });
      }
      if (limit && limit > 0 && ids.length > limit) {
        ids = ids.slice(0, limit);
      }
    }

    if (ids.length === 0) return [];

    // ADR-008 D3: cursor path must include deleted messages (tombstones)
    const messages = await this.hydrateMessages(ids, { includeDeleted: true });
    if (!userId) return messages;
    return messages.filter((m) => m.userId === userId);
  }

  async getByThreadBefore(
    threadId: string,
    timestamp: number,
    limit?: number,
    beforeId?: string,
    userId?: string
  ): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const key = MessageKeys.thread(threadId);
    const fetchN = userId ? n * 2 : n;

    if (!beforeId) {
      const ids = await this.redis.zrevrangebyscore(
        key, `(${timestamp}`, '-inf', 'LIMIT', 0, fetchN
      );
      if (ids.length === 0) return [];
      const messages = await this.hydrateMessages(ids.reverse());
      if (!userId) return messages;
      return messages.filter((m) => m.userId === userId).slice(-n);
    }

    const ids = await this.fetchBeforeWithCursor(key, timestamp, beforeId, fetchN);
    if (ids.length === 0) return [];
    const messages = await this.hydrateMessages(ids.reverse());
    if (!userId) return messages;
    return messages.filter((m) => m.userId === userId).slice(-n);
  }

  /**
   * Fetch IDs before a composite cursor (timestamp + beforeId) using chunked scanning.
   * Loops until we have `limit` results or exhaust the sorted set.
   */
  private async fetchBeforeWithCursor(
    key: string,
    timestamp: number,
    beforeId: string,
    limit: number
  ): Promise<string[]> {
    const CHUNK = 50;
    const filtered: string[] = [];
    let offset = 0;

    while (filtered.length < limit) {
      const chunk = await this.redis.zrevrangebyscore(
        key, String(timestamp), '-inf', 'LIMIT', offset, CHUNK
      );
      if (chunk.length === 0) break;

      for (const id of chunk) {
        if (filtered.length >= limit) break;
        const score = await this.redis.zscore(key, id);
        if (score !== null && parseInt(score, 10) === timestamp && id >= beforeId) {
          continue;
        }
        filtered.push(id);
      }

      offset += CHUNK;
    }

    return filtered;
  }

  /**
   * Delete all messages in a thread. Returns count of deleted messages.
   */
  async deleteByThread(threadId: string): Promise<number> {
    const key = MessageKeys.thread(threadId);

    // Get all message IDs in this thread
    const ids = await this.redis.zrange(key, 0, -1);
    if (ids.length === 0) return 0;

    const pipeline = this.redis.multi();

    // Delete each message hash
    for (const id of ids) {
      pipeline.del(MessageKeys.detail(id));
    }

    // Delete the thread sorted set
    pipeline.del(key);

    // Note: We don't clean up global timeline, user timeline, or mention sets
    // as those will auto-expire via TTL. Cleaning them would be O(n) expensive.

    await pipeline.exec();
    return ids.length;
  }

  /**
   * ADR-008 D3: Soft delete — set deletedAt/deletedBy on message hash.
   */
  async softDelete(id: string, deletedBy: string): Promise<StoredMessage | null> {
    const msg = await this.getById(id);
    if (!msg) return null;
    const now = Date.now();
    await this.redis.hset(MessageKeys.detail(id), {
      deletedAt: String(now),
      deletedBy,
    });
    msg.deletedAt = now;
    msg.deletedBy = deletedBy;
    return msg;
  }

  /**
   * ADR-008 D3: Restore a soft-deleted message — remove deletedAt/deletedBy.
   */
  async restore(id: string): Promise<StoredMessage | null> {
    const msg = await this.getById(id);
    if (!msg || !msg.deletedAt) return null;
    await this.redis.hdel(MessageKeys.detail(id), 'deletedAt', 'deletedBy');
    delete msg.deletedAt;
    delete msg.deletedBy;
    return msg;
  }

  /** Hydrate message IDs into full StoredMessage objects */
  private async hydrateMessages(ids: string[], options?: { includeDeleted?: boolean }): Promise<StoredMessage[]> {
    const pipeline = this.redis.multi();
    for (const id of ids) {
      pipeline.hgetall(MessageKeys.detail(id));
    }
    const results = await pipeline.exec();
    if (!results) return [];

    const messages: StoredMessage[] = [];
    for (const [err, data] of results) {
      if (err || !data || typeof data !== 'object') continue;
      const d = data as Record<string, string>;
      if (!d['id']) continue;

      const deletedAt = d['deletedAt'] ? parseInt(d['deletedAt'], 10) : undefined;

      // ADR-008 D3: skip soft-deleted messages unless includeDeleted
      if (deletedAt && !options?.includeDeleted) continue;

      const contentBlocks = safeParseContentBlocks(d['contentBlocks']);
      const parsedMetadata = safeParseMetadata(d['metadata']);
      messages.push({
        id: d['id'],
        threadId: d['threadId'] || DEFAULT_THREAD_ID,
        userId: d['userId'] ?? 'unknown',
        catId: (d['catId'] || null) as CatId | null,
        content: d['content'] ?? '',
        ...(contentBlocks ? { contentBlocks } : {}),
        ...(parsedMetadata ? { metadata: parsedMetadata } : {}),
        mentions: safeParseMentions(d['mentions']),
        timestamp: parseInt(d['timestamp'] ?? '0', 10),
        ...(deletedAt ? { deletedAt, deletedBy: d['deletedBy'] ?? '' } : {}),
      });
    }
    return messages;
  }
}

function safeParseMentions(raw: string | undefined): readonly CatId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseContentBlocks(raw: string | undefined): readonly MessageContent[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function safeParseMetadata(raw: string | undefined): MessageMetadata | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof parsed.provider === 'string' &&
      typeof parsed.model === 'string'
    ) {
      return parsed as MessageMetadata;
    }
    return undefined;
  } catch {
    return undefined;
  }
}
