/**
 * Redis Message Store
 * Redis-backed message storage with same interface as in-memory MessageStore.
 *
 * Redis 数据结构:
 *   cat-cafe:msg:{id}                → Hash (消息详情)
 *   cat-cafe:msg:timeline            → Sorted Set (全局时间线, score=timestamp)
 *   cat-cafe:msg:user:{userId}       → Sorted Set (用户维度)
 *   cat-cafe:msg:mentions:{catId}    → Sorted Set (提及维度)
 *
 * 消息 TTL 可配置 (默认 7 天)。
 */

import type { CatId } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { generateSortableId } from './MessageStore.js';
import type { StoredMessage } from './MessageStore.js';
import { MessageKeys } from './message-keys.js';

const DEFAULT_LIMIT = 50;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class RedisMessageStore {
  private readonly redis: RedisClient;
  private readonly ttl: number;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number }) {
    this.redis = redis;
    this.ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  async append(msg: Omit<StoredMessage, 'id'>): Promise<StoredMessage> {
    const id = generateSortableId(msg.timestamp);
    const stored: StoredMessage = { ...msg, id };
    const score = msg.timestamp;

    const hashKey = MessageKeys.detail(id);
    const pipeline = this.redis.multi();

    // Store message hash
    pipeline.hset(hashKey, {
      id,
      userId: msg.userId,
      catId: msg.catId ?? '',
      content: msg.content,
      mentions: JSON.stringify(msg.mentions),
      timestamp: String(msg.timestamp),
    });
    pipeline.expire(hashKey, this.ttl);

    // Add to global timeline
    pipeline.zadd(MessageKeys.TIMELINE, String(score), id);

    // Add to user timeline
    pipeline.zadd(MessageKeys.user(msg.userId), String(score), id);

    // Add to per-cat mention sets
    for (const catId of msg.mentions) {
      pipeline.zadd(MessageKeys.mentions(catId), String(score), id);
    }

    // Prune expired entries from sorted sets (score < now - TTL).
    // Runs on every append to prevent unbounded zset growth.
    const cutoff = String(Date.now() - this.ttl * 1000);
    pipeline.zremrangebyscore(MessageKeys.TIMELINE, '-inf', cutoff);
    pipeline.zremrangebyscore(MessageKeys.user(msg.userId), '-inf', cutoff);
    for (const catId of msg.mentions) {
      pipeline.zremrangebyscore(MessageKeys.mentions(catId), '-inf', cutoff);
    }

    // Set EXPIRE on index zsets so "silent user" keys eventually disappear
    // even if no new appends trigger zremrangebyscore for that key.
    pipeline.expire(MessageKeys.TIMELINE, this.ttl);
    pipeline.expire(MessageKeys.user(msg.userId), this.ttl);
    for (const catId of msg.mentions) {
      pipeline.expire(MessageKeys.mentions(catId), this.ttl);
    }

    await pipeline.exec();
    return stored;
  }

  async getRecent(limit?: number, userId?: string): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const key = userId ? MessageKeys.user(userId) : MessageKeys.TIMELINE;

    // Get most recent N message IDs (highest score = newest)
    const ids = await this.redis.zrevrange(key, 0, n - 1);
    if (ids.length === 0) return [];

    return this.hydrateMessages(ids.reverse()); // reverse to chronological
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
      // Paginated scan: walk the mentions zset in chunks until we collect n
      // matching IDs or exhaust the set. Avoids the n*2 fixed-multiplier bug.
      const CHUNK = 50;
      ids = [];
      let offset = 0;
      while (ids.length < n) {
        const chunk = await this.redis.zrevrange(mentionKey, offset, offset + CHUNK - 1);
        if (chunk.length === 0) break; // exhausted
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
      // Simple: get IDs with score < timestamp
      const ids = await this.redis.zrevrangebyscore(
        key,
        `(${timestamp}`, // exclusive upper bound
        '-inf',
        'LIMIT',
        0,
        n
      );
      if (ids.length === 0) return [];
      return this.hydrateMessages(ids.reverse());
    }

    // Composite cursor: fetch score <= timestamp, then filter out id >= beforeId
    // at the boundary timestamp. Over-fetch to account for same-ts filtering.
    const OVERFETCH = n + 20;
    const ids = await this.redis.zrevrangebyscore(
      key,
      String(timestamp), // inclusive upper bound
      '-inf',
      'LIMIT',
      0,
      OVERFETCH
    );

    const filtered: string[] = [];
    for (const id of ids) {
      if (filtered.length >= n) break;
      // At exact cursor timestamp, skip ids >= beforeId
      const score = await this.redis.zscore(key, id);
      if (score !== null && parseInt(score, 10) === timestamp && id >= beforeId) {
        continue;
      }
      filtered.push(id);
    }

    if (filtered.length === 0) return [];
    return this.hydrateMessages(filtered.reverse());
  }

  /** Hydrate message IDs into full StoredMessage objects */
  private async hydrateMessages(ids: string[]): Promise<StoredMessage[]> {
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

      messages.push({
        id: d['id'],
        userId: d['userId'] ?? 'unknown',
        catId: (d['catId'] || null) as CatId | null,
        content: d['content'] ?? '',
        mentions: safeParseMentions(d['mentions']),
        timestamp: parseInt(d['timestamp'] ?? '0', 10),
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
