/**
 * Redis 连接和 Session 存储
 * 用于管理三只猫猫的 Session 状态
 */

import { Redis } from 'ioredis';

export type RedisClient = Redis;

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
}

export function getDefaultRedisConfig(): RedisConfig {
  return {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    keyPrefix: 'cat-cafe:',
  };
}

export function createRedisClient(config?: Partial<RedisConfig>): RedisClient {
  const finalConfig = { ...getDefaultRedisConfig(), ...config };
  const keyPrefix = finalConfig.keyPrefix ?? 'cat-cafe:';

  const client = new Redis(finalConfig.url, {
    keyPrefix,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('[Redis] Max retry attempts reached');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => console.log('[Redis] Connected'));
  client.on('error', (err: Error) => console.error('[Redis] Error:', err.message));
  client.on('close', () => console.log('[Redis] Connection closed'));

  return client;
}

export const SessionKeys = {
  session: (userId: string, catId: string) => `sessions:${userId}:${catId}`,
  catState: (catId: string) => `state:${catId}`,
  taskQueue: (catId: string) => `tasks:${catId}`,
  messageChannel: () => 'chat:messages',
} as const;

export class SessionStore {
  constructor(private redis: RedisClient) {}

  async getSessionId(userId: string, catId: string): Promise<string | null> {
    return this.redis.get(SessionKeys.session(userId, catId));
  }

  async setSessionId(
    userId: string,
    catId: string,
    sessionId: string,
    ttlSeconds = 86400
  ): Promise<void> {
    await this.redis.set(
      SessionKeys.session(userId, catId),
      sessionId,
      'EX',
      ttlSeconds
    );
  }

  async deleteSession(userId: string, catId: string): Promise<void> {
    await this.redis.del(SessionKeys.session(userId, catId));
  }

  async getCatState(catId: string): Promise<Record<string, unknown> | null> {
    const state = await this.redis.get(SessionKeys.catState(catId));
    return state ? JSON.parse(state) : null;
  }

  async setCatState(catId: string, state: Record<string, unknown>): Promise<void> {
    await this.redis.set(SessionKeys.catState(catId), JSON.stringify(state));
  }
}
