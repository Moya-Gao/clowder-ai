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

import { randomUUID } from 'node:crypto';
import type { CatId } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
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
    const id = randomUUID();
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
      // Intersect mentions set with user set
      const mentionIds = await this.redis.zrevrange(mentionKey, 0, n * 2);
      ids = [];
      for (const id of mentionIds) {
        if (ids.length >= n) break;
        const score = await this.redis.zscore(MessageKeys.user(userId), id);
        if (score !== null) ids.push(id);
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
    userId?: string
  ): Promise<StoredMessage[]> {
    const n = limit ?? DEFAULT_LIMIT;
    const key = userId ? MessageKeys.user(userId) : MessageKeys.TIMELINE;

    // Get IDs with score < timestamp, from highest to lowest
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
