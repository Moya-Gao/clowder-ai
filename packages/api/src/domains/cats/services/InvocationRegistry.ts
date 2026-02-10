/**
 * Invocation Registry
 * 管理 MCP 回传工具的调用鉴权
 *
 * 每次 AgentRouter 调用一只猫时，生成 invocationId + callbackToken pair。
 * MCP 回传工具通过 env var 获取这对凭证，调用 API callback 端点时由此模块验证。
 *
 * 安全契约:
 * - invocationId → { userId, catId, callbackToken, expiresAt }
 * - verify() 同时检查 token 匹配 + TTL 过期
 * - LRU + TTL 双重清理
 */

import { randomUUID } from 'node:crypto';
import type { CatId } from '@cat-cafe/shared';

/**
 * A registered invocation record
 */
export interface InvocationRecord {
  invocationId: string;
  callbackToken: string;
  userId: string;
  catId: CatId;
  /** Thread this invocation belongs to (for WebSocket room scoping) */
  threadId: string;
  /** In-invocation idempotency keys for callback post-message de-duplication. */
  clientMessageIds: Set<string>;
  createdAt: number;
  expiresAt: number;
}

/** Default TTL: 10 minutes */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Max concurrent invocations before LRU eviction */
const MAX_INVOCATIONS = 500;
/** Max remembered callback idempotency keys per invocation */
const MAX_CLIENT_MESSAGE_IDS = 1000;

/**
 * Registry for managing invocation auth tokens.
 * In-memory implementation — Phase 3 will migrate to Redis.
 */
export class InvocationRegistry {
  private records = new Map<string, InvocationRecord>();
  private readonly ttlMs: number;
  private readonly maxRecords: number;

  constructor(options?: { ttlMs?: number; maxRecords?: number }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxRecords = options?.maxRecords ?? MAX_INVOCATIONS;
  }

  /**
   * Create a new invocation and return the auth credentials.
   * The caller should pass these as env vars to the CLI subprocess.
   */
  create(
    userId: string,
    catId: CatId,
    threadId: string = 'default'
  ): { invocationId: string; callbackToken: string } {
    this.cleanup();

    // Evict oldest if at capacity
    while (this.records.size >= this.maxRecords) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey !== undefined) {
        this.records.delete(oldestKey);
      }
    }

    const invocationId = randomUUID();
    const callbackToken = randomUUID();
    const now = Date.now();

    this.records.set(invocationId, {
      invocationId,
      callbackToken,
      userId,
      catId,
      threadId,
      clientMessageIds: new Set<string>(),
      createdAt: now,
      expiresAt: now + this.ttlMs,
    });

    return { invocationId, callbackToken };
  }

  /**
   * Verify invocationId + callbackToken binding.
   * Returns the record if valid, null if invalid or expired.
   */
  verify(
    invocationId: string,
    callbackToken: string
  ): InvocationRecord | null {
    const record = this.records.get(invocationId);
    if (!record) return null;

    // Check token match
    if (record.callbackToken !== callbackToken) return null;

    // Check TTL
    if (Date.now() > record.expiresAt) {
      this.records.delete(invocationId);
      return null;
    }

    // Refresh recency (LRU): delete + re-set moves to end of Map iteration order
    this.records.delete(invocationId);
    this.records.set(invocationId, record);

    return record;
  }

  /**
   * Claim a callback clientMessageId for an invocation.
   * Returns true if this ID is first-seen, false if duplicate or invocation missing.
   */
  claimClientMessageId(invocationId: string, clientMessageId: string): boolean {
    const record = this.records.get(invocationId);
    if (!record) return false;

    if (record.clientMessageIds.has(clientMessageId)) {
      return false;
    }

    while (record.clientMessageIds.size >= MAX_CLIENT_MESSAGE_IDS) {
      const oldest = record.clientMessageIds.values().next().value;
      if (oldest === undefined) break;
      record.clientMessageIds.delete(oldest);
    }

    record.clientMessageIds.add(clientMessageId);
    return true;
  }

  /**
   * Remove expired records
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records) {
      if (now > record.expiresAt) {
        this.records.delete(key);
      }
    }
  }
}
