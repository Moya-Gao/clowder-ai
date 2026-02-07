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
import { DEFAULT_THREAD_ID } from './ThreadStore.js';
import type { Thread, IThreadStore } from './ThreadStore.js';
import { ThreadKeys } from './thread-keys.js';

const DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days

export class RedisThreadStore implements IThreadStore {
  private readonly redis: RedisClient;
  private readonly ttl: number;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number }) {
    this.redis = redis;
    this.ttl = options?.ttlSeconds ?? DEFAULT_TTL;
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
    pipeline.expire(key, this.ttl);
    pipeline.zadd(ThreadKeys.userList(userId), String(now), thread.id);
    pipeline.expire(ThreadKeys.userList(userId), this.ttl);
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
    const key = ThreadKeys.participants(threadId);
    await this.redis.sadd(key, ...catIds);
    await this.redis.expire(key, this.ttl);
  }

  async getParticipants(threadId: string): Promise<CatId[]> {
    const members = await this.redis.smembers(ThreadKeys.participants(threadId));
    return members as CatId[];
  }

  async updateTitle(threadId: string, title: string): Promise<void> {
    await this.redis.hset(ThreadKeys.detail(threadId), 'title', title);
  }

  async updateLastActive(threadId: string): Promise<void> {
    const now = String(Date.now());
    const key = ThreadKeys.detail(threadId);
    await this.redis.hset(key, 'lastActiveAt', now);

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
    await this.redis.expire(key, this.ttl);
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
    };
  }

  private hydrateThread(data: Record<string, string>): Thread {
    return {
      id: data['id'] ?? '',
      projectPath: data['projectPath'] ?? 'default',
      title: data['title'] || null,
      createdBy: data['createdBy'] ?? 'unknown',
      participants: [],  // Loaded separately from Set
      lastActiveAt: parseInt(data['lastActiveAt'] ?? '0', 10),
      createdAt: parseInt(data['createdAt'] ?? '0', 10),
    };
  }
}
