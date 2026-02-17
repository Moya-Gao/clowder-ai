/**
 * Redis Thread Store
 * Redis-backed thread storage with same interface as in-memory ThreadStore.
 *
 * Redis 数据结构:
 *   cat-cafe:thread:{threadId}              → Hash (对话详情)
 *   cat-cafe:thread:{threadId}:participants  → Set (参与猫)
 *   cat-cafe:threads:user:{userId}          → Sorted Set (用户对话列表, score=lastActiveAt)
 *
 * TTL 默认 30 天。
 */

import { generateThreadId } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID } from '../ports/ThreadStore.js';
import type { Thread, IThreadStore } from '../ports/ThreadStore.js';
import { ThreadKeys } from '../redis-keys/thread-keys.js';

const DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days

/**
 * Atomic hash update guard:
 * only applies HSET when the thread hash has a canonical `id` field.
 * Prevents late updates from recreating orphan hashes after delete races.
 */
const HSET_IF_HAS_ID_LUA = `
if redis.call('HEXISTS', KEYS[1], 'id') == 0 then
  return 0
end
redis.call('HSET', KEYS[1], unpack(ARGV))
return 1
`;

/**
 * Atomic participants guard:
 * only applies SADD when the thread detail hash has canonical `id`.
 * Prevents delete/addParticipants race from recreating orphan participant sets.
 */
const SADD_IF_DETAIL_HAS_ID_LUA = `
if redis.call('HEXISTS', KEYS[1], 'id') == 0 then
  return 0
end
redis.call('SADD', KEYS[2], unpack(ARGV))
return 1
`;

export class RedisThreadStore implements IThreadStore {
  private readonly redis: RedisClient;
  /** null means no expiration. */
  private readonly ttlSeconds: number | null;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number }) {
    this.redis = redis;
    const ttl = options?.ttlSeconds;
    if (ttl === undefined) {
      this.ttlSeconds = DEFAULT_TTL;
    } else if (!Number.isFinite(ttl)) {
      this.ttlSeconds = DEFAULT_TTL;
    } else if (ttl <= 0) {
      this.ttlSeconds = null;
    } else {
      this.ttlSeconds = Math.floor(ttl);
    }
  }

  async create(userId: string, title?: string, projectPath?: string): Promise<Thread> {
    const now = Date.now();
    const thread: Thread = {
      id: generateThreadId(),
      projectPath: projectPath ?? 'default',
      title: title ?? null,
      createdBy: userId,
      participants: [],
      lastActiveAt: now,
      createdAt: now,
    };

    const key = ThreadKeys.detail(thread.id);
    const pipeline = this.redis.multi();
    pipeline.hset(key, this.serializeThread(thread));
    if (this.ttlSeconds !== null) {
      pipeline.expire(key, this.ttlSeconds);
    }
    pipeline.zadd(ThreadKeys.userList(userId), String(now), thread.id);
    if (this.ttlSeconds !== null) {
      pipeline.expire(ThreadKeys.userList(userId), this.ttlSeconds);
    }
    await pipeline.exec();

    return thread;
  }

  async get(threadId: string): Promise<Thread | null> {
    const data = await this.redis.hgetall(ThreadKeys.detail(threadId));
    if (!data || !data['id']) {
      if (threadId === DEFAULT_THREAD_ID) {
        return this.createDefaultThread();
      }
      return null;
    }

    const thread = this.hydrateThread(data);
    // Load participants from Set
    const members = await this.redis.smembers(ThreadKeys.participants(threadId));
    thread.participants = members as CatId[];
    return thread;
  }

  async list(userId: string): Promise<Thread[]> {
    const ids = await this.redis.zrevrange(ThreadKeys.userList(userId), 0, -1);

    // Ensure default thread is included
    const hasDefault = ids.includes(DEFAULT_THREAD_ID);
    if (!hasDefault) ids.push(DEFAULT_THREAD_ID);

    const threads: Thread[] = [];
    for (const id of ids) {
      const thread = await this.get(id);
      if (thread) threads.push(thread);
    }

    // Sort by lastActiveAt descending
    threads.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    return threads;
  }

  async listByProject(userId: string, projectPath: string): Promise<Thread[]> {
    const all = await this.list(userId);
    return all.filter((t) => t.projectPath === projectPath);
  }

  async addParticipants(threadId: string, catIds: CatId[]): Promise<void> {
    if (catIds.length === 0) return;
    const detailKey = ThreadKeys.detail(threadId);
    const participantsKey = ThreadKeys.participants(threadId);
    const updated = await this.redis.eval(
      SADD_IF_DETAIL_HAS_ID_LUA,
      2,
      detailKey,
      participantsKey,
      ...catIds,
    ) as number;
    if (updated === 0) return;
    if (this.ttlSeconds !== null) {
      await this.redis.expire(participantsKey, this.ttlSeconds);
    }
  }

  async getParticipants(threadId: string): Promise<CatId[]> {
    const members = await this.redis.smembers(ThreadKeys.participants(threadId));
    return members as CatId[];
  }

  async updateTitle(threadId: string, title: string): Promise<void> {
    const key = ThreadKeys.detail(threadId);
    await this.redis.eval(HSET_IF_HAS_ID_LUA, 1, key, 'title', title);
  }

  async updatePin(threadId: string, pinned: boolean): Promise<void> {
    const key = ThreadKeys.detail(threadId);
    await this.redis.eval(
      HSET_IF_HAS_ID_LUA,
      1,
      key,
      'pinned',
      String(pinned),
      'pinnedAt',
      pinned ? String(Date.now()) : '0',
    );
  }

  async updateFavorite(threadId: string, favorited: boolean): Promise<void> {
    const key = ThreadKeys.detail(threadId);
    await this.redis.eval(
      HSET_IF_HAS_ID_LUA,
      1,
      key,
      'favorited',
      String(favorited),
      'favoritedAt',
      favorited ? String(Date.now()) : '0',
    );
  }

  async updateLastActive(threadId: string): Promise<void> {
    const now = String(Date.now());
    const key = ThreadKeys.detail(threadId);
    const updated = await this.redis.eval(
      HSET_IF_HAS_ID_LUA,
      1,
      key,
      'lastActiveAt',
      now,
    ) as number;
    if (updated === 0) return;

    // Update score in all user lists that contain this thread
    const createdBy = await this.redis.hget(key, 'createdBy');
    if (createdBy) {
      await this.redis.zadd(ThreadKeys.userList(createdBy), now, threadId);
    }
  }

  async delete(threadId: string): Promise<boolean> {
    if (threadId === DEFAULT_THREAD_ID) return false;

    const key = ThreadKeys.detail(threadId);
    const createdBy = await this.redis.hget(key, 'createdBy');

    const pipeline = this.redis.multi();
    pipeline.del(key);
    pipeline.del(ThreadKeys.participants(threadId));
    if (createdBy) {
      pipeline.zrem(ThreadKeys.userList(createdBy), threadId);
    }
    const results = await pipeline.exec();

    // First del result: [err, count]
    const delResult = results?.[0];
    return delResult ? (delResult[1] as number) > 0 : false;
  }

  private async createDefaultThread(): Promise<Thread> {
    const now = Date.now();
    const thread: Thread = {
      id: DEFAULT_THREAD_ID,
      projectPath: 'default',
      title: null,
      createdBy: 'system',
      participants: [],
      lastActiveAt: now,
      createdAt: now,
    };

    const key = ThreadKeys.detail(DEFAULT_THREAD_ID);
    await this.redis.hset(key, this.serializeThread(thread));
    if (this.ttlSeconds !== null) {
      await this.redis.expire(key, this.ttlSeconds);
    }
    return thread;
  }

  private serializeThread(thread: Thread): Record<string, string> {
    return {
      id: thread.id,
      projectPath: thread.projectPath,
      title: thread.title ?? '',
      createdBy: thread.createdBy,
      lastActiveAt: String(thread.lastActiveAt),
      createdAt: String(thread.createdAt),
      pinned: String(thread.pinned ?? false),
      pinnedAt: String(thread.pinnedAt ?? 0),
      favorited: String(thread.favorited ?? false),
      favoritedAt: String(thread.favoritedAt ?? 0),
    };
  }

  private hydrateThread(data: Record<string, string>): Thread {
    const pinnedAt = parseInt(data['pinnedAt'] ?? '0', 10);
    const favoritedAt = parseInt(data['favoritedAt'] ?? '0', 10);
    return {
      id: data['id'] ?? '',
      projectPath: data['projectPath'] ?? 'default',
      title: data['title'] || null,
      createdBy: data['createdBy'] ?? 'unknown',
      participants: [],  // Loaded separately from Set
      lastActiveAt: parseInt(data['lastActiveAt'] ?? '0', 10),
      createdAt: parseInt(data['createdAt'] ?? '0', 10),
      pinned: data['pinned'] === 'true',
      pinnedAt: pinnedAt || null,
      favorited: data['favorited'] === 'true',
      favoritedAt: favoritedAt || null,
    };
  }
}
