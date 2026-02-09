/**
 * Redis InvocationRecord Store
 * Redis-backed invocation record storage with Lua atomic create.
 *
 * ADR-008 D1+D2: Lua 脚本原子创建 — 幂等 key 占位 + Record 创建在同一 EVAL 中。
 *
 * IMPORTANT: ioredis keyPrefix auto-prefixes ALL commands including eval() KEYS[].
 * Do NOT manually prepend the prefix — pass bare keys and let ioredis handle it.
 */

import type { CatId } from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';
import { InvocationKeys } from './invocation-keys.js';
import type {
  InvocationRecord,
  InvocationStatus,
  CreateInvocationInput,
  CreateResult,
  UpdateInvocationInput,
  IInvocationRecordStore,
} from './InvocationRecordStore.js';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const IDEMPOTENCY_TTL_SECONDS = 300; // 5 minutes

/**
 * Lua script for atomic idempotency check + record creation.
 * KEYS[1] = idempotency key (ioredis auto-prefixes)
 * KEYS[2] = invocation record key (ioredis auto-prefixes)
 * ARGV[1..7] = id, threadId, userId, targetCats(JSON), intent, idempotencyKey, now
 */
const CREATE_ATOMIC_LUA = `
local existing = redis.call('GET', KEYS[1])
if existing then
  return {'duplicate', existing}
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ${IDEMPOTENCY_TTL_SECONDS})
redis.call('HSET', KEYS[2],
  'id', ARGV[1], 'threadId', ARGV[2], 'userId', ARGV[3],
  'targetCats', ARGV[4], 'intent', ARGV[5],
  'idempotencyKey', ARGV[6], 'status', 'queued',
  'userMessageId', '', 'error', '',
  'createdAt', ARGV[7], 'updatedAt', ARGV[7])
redis.call('EXPIRE', KEYS[2], ${DEFAULT_TTL_SECONDS})
return {'created', ARGV[1]}
`;

export class RedisInvocationRecordStore implements IInvocationRecordStore {
  private readonly redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  async create(input: CreateInvocationInput): Promise<CreateResult> {
    const { randomUUID } = await import('node:crypto');
    const id = randomUUID();
    const now = String(Date.now());

    // Bare keys — ioredis keyPrefix auto-applies to eval() KEYS[] too
    const idempKey = InvocationKeys.idempotency(input.threadId, input.userId, input.idempotencyKey);
    const recordKey = InvocationKeys.detail(id);

    const result = await this.redis.eval(
      CREATE_ATOMIC_LUA,
      2,
      idempKey,
      recordKey,
      id,
      input.threadId,
      input.userId,
      JSON.stringify(input.targetCats),
      input.intent,
      input.idempotencyKey,
      now,
    ) as [string, string];

    return {
      outcome: result[0] as 'created' | 'duplicate',
      invocationId: result[1],
    };
  }

  async get(id: string): Promise<InvocationRecord | null> {
    const key = InvocationKeys.detail(id);
    const data = await this.redis.hgetall(key);
    if (!data || !data['id']) return null;
    return this.hydrateRecord(data);
  }

  async update(id: string, input: UpdateInvocationInput): Promise<InvocationRecord | null> {
    const key = InvocationKeys.detail(id);
    const exists = await this.redis.exists(key);
    if (!exists) return null;

    const updates: Record<string, string> = {
      updatedAt: String(Date.now()),
    };
    if (input.status !== undefined) updates['status'] = input.status;
    if (input.userMessageId !== undefined) updates['userMessageId'] = input.userMessageId ?? '';
    if (input.error !== undefined) updates['error'] = input.error;

    await this.redis.hset(key, updates);
    return this.get(id);
  }

  async getByIdempotencyKey(
    threadId: string,
    userId: string,
    key: string,
  ): Promise<InvocationRecord | null> {
    const idempKey = InvocationKeys.idempotency(threadId, userId, key);
    const invocationId = await this.redis.get(idempKey);
    if (!invocationId) return null;
    return this.get(invocationId);
  }

  private hydrateRecord(data: Record<string, string>): InvocationRecord {
    const errorValue = data['error'];
    const hasError = errorValue !== undefined && errorValue !== '';
    return {
      id: data['id']!,
      threadId: data['threadId']!,
      userId: data['userId']!,
      userMessageId: data['userMessageId'] === '' ? null : data['userMessageId']!,
      targetCats: safeParseArray(data['targetCats']) as CatId[],
      intent: (data['intent'] as 'execute' | 'ideate') ?? 'execute',
      status: (data['status'] as InvocationStatus) ?? 'queued',
      idempotencyKey: data['idempotencyKey']!,
      ...(hasError ? { error: errorValue } : {}),
      createdAt: parseInt(data['createdAt']!, 10),
      updatedAt: parseInt(data['updatedAt']!, 10),
    };
  }
}

function safeParseArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
