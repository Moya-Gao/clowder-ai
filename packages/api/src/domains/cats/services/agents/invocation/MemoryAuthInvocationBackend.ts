/**
 * F174 Phase B — In-memory IAuthInvocationBackend implementation.
 *
 * Default backend for unit tests (no Redis dep) and for `CAT_CAFE_INVOCATION_REGISTRY=memory`
 * fallback. Same in-memory Map + LRU + sliding TTL semantics that lived inside
 * InvocationRegistry pre-Phase-B.
 *
 * Behavior contract (mirrored by RedisAuthInvocationBackend):
 * - create() evicts oldest record if at maxRecords capacity (LRU)
 * - verify() emits typed reason {expired, invalid_token, unknown_invocation}
 *   and slides TTL on success
 * - latestByThreadCat tracks the most recent invocationId per (threadId, catId)
 * - claimClientMessageId enforces MAX_CLIENT_MESSAGE_IDS bound per record
 */

import type { AuthInvocationInput, IAuthInvocationBackend } from './IAuthInvocationBackend.js';
import type { InvocationRecord, VerifyResult } from './InvocationRegistry.js';

const DEFAULT_MAX_RECORDS = 500;
const MAX_CLIENT_MESSAGE_IDS = 1000;

export class MemoryAuthInvocationBackend implements IAuthInvocationBackend {
  private records = new Map<string, InvocationRecord>();
  private latestByThreadCat = new Map<string, string>();
  private readonly maxRecords: number;

  constructor(options?: { maxRecords?: number }) {
    this.maxRecords = options?.maxRecords ?? DEFAULT_MAX_RECORDS;
  }

  async create(input: AuthInvocationInput, ttlMs: number): Promise<void> {
    this.cleanupExpired();

    while (this.records.size >= this.maxRecords) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey === undefined) break;
      this.cleanupLatestPointer(oldestKey);
      this.records.delete(oldestKey);
    }

    const expiresAt = Date.now() + ttlMs;
    const record: InvocationRecord = { ...input, expiresAt };
    this.records.set(input.invocationId, record);
    this.latestByThreadCat.set(`${input.threadId}:${input.catId as string}`, input.invocationId);
  }

  async verify(invocationId: string, callbackToken: string, ttlMs: number): Promise<VerifyResult> {
    const record = this.records.get(invocationId);
    if (!record) return { ok: false, reason: 'unknown_invocation' };

    if (record.callbackToken !== callbackToken) {
      return { ok: false, reason: 'invalid_token' };
    }

    if (Date.now() > record.expiresAt) {
      this.cleanupLatestPointer(invocationId);
      this.records.delete(invocationId);
      return { ok: false, reason: 'expired' };
    }

    record.expiresAt = Date.now() + ttlMs;
    this.records.delete(invocationId);
    this.records.set(invocationId, record);

    return { ok: true, record };
  }

  async getRecord(invocationId: string): Promise<InvocationRecord | null> {
    const record = this.records.get(invocationId);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.cleanupLatestPointer(invocationId);
      this.records.delete(invocationId);
      return null;
    }
    return record;
  }

  async isLatest(invocationId: string): Promise<boolean> {
    const record = this.records.get(invocationId);
    if (!record) return false;
    const key = `${record.threadId}:${record.catId as string}`;
    return this.latestByThreadCat.get(key) === invocationId;
  }

  async getLatestId(threadId: string, catId: string): Promise<string | undefined> {
    return this.latestByThreadCat.get(`${threadId}:${catId}`);
  }

  async claimClientMessageId(invocationId: string, clientMessageId: string): Promise<boolean> {
    const record = this.records.get(invocationId);
    if (!record) return false;

    if (record.clientMessageIds.has(clientMessageId)) return false;

    while (record.clientMessageIds.size >= MAX_CLIENT_MESSAGE_IDS) {
      const oldest = record.clientMessageIds.values().next().value;
      if (oldest === undefined) break;
      record.clientMessageIds.delete(oldest);
    }
    record.clientMessageIds.add(clientMessageId);
    return true;
  }

  private cleanupLatestPointer(invocationId: string): void {
    const record = this.records.get(invocationId);
    if (!record) return;
    const key = `${record.threadId}:${record.catId as string}`;
    if (this.latestByThreadCat.get(key) === invocationId) {
      this.latestByThreadCat.delete(key);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records) {
      if (now > record.expiresAt) {
        this.cleanupLatestPointer(key);
        this.records.delete(key);
      }
    }
  }
}
