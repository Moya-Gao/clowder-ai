/**
 * HookOverrideStore — F237 PR3
 *
 * Redis-backed per-workspace override layer for prompt hook management.
 * Provides enable/disable, content override, rollback, and change event tracking.
 * Enforces safetyTier/disableable gating by internally resolving the manifest
 * from a registry lookup — callers never pass manifests, preventing gate bypass
 * via mismatched hookId/manifest pairs (codex P1 finding, PR #22).
 *
 * Storage layout:
 *   HASH  hook-override:{workspaceId}        — { hookId → JSON(HookOverride) }
 *   ZSET  hook-override-events:{workspaceId} — { eventId → timestamp }
 *   KEY   hook-override-event:{ws}:{eventId} — JSON(OverrideChangeEvent), TTL 30d
 */

import type {
  HookManifest,
  HookOverride,
  HookOverrideSource,
  OverrideAction,
  OverrideChangeEvent,
} from '@cat-cafe/shared';
import type { RedisClient } from '@cat-cafe/shared/utils';

// ---------------------------------------------------------------------------
// Manifest lookup (injected at construction — decoupled from HookRegistry)
// ---------------------------------------------------------------------------

/** Resolves a HookManifest by hookId. Returns undefined for unknown hooks. */
export type ManifestLookup = (hookId: string) => HookManifest | undefined;

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

const OVERRIDE_HASH = (ws: string) => `hook-override:${ws}`;
const EVENT_ZSET = (ws: string) => `hook-override-events:${ws}`;
const EVENT_KEY = (ws: string, id: string) => `hook-override-event:${ws}:${id}`;

const EVENT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ---------------------------------------------------------------------------
// Gate error
// ---------------------------------------------------------------------------

/** Thrown when an override operation violates manifest safety constraints. */
export class OverrideGateError extends Error {
  constructor(
    public readonly hookId: string,
    public readonly action: string,
    public readonly gate: 'disableable' | 'safetyTier' | 'unknown-hook',
    public readonly manifestValue: string | boolean,
  ) {
    super(`Override rejected: hook '${hookId}' ${action} blocked by ${gate}=${String(manifestValue)}`);
    this.name = 'OverrideGateError';
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class HookOverrideStore {
  /** Monotonic counter for event ID uniqueness within a process. */
  private eventSeq = 0;

  constructor(
    private readonly redis: RedisClient,
    private readonly manifestLookup: ManifestLookup,
    private readonly defaultWorkspaceId = 'default',
  ) {}

  // -- Manifest resolution (fail-closed) ------------------------------------

  /**
   * Resolve the canonical manifest for a hookId from the registry.
   * Fail-closed: unknown hookId → OverrideGateError (cannot override unknown hooks).
   */
  private resolveManifest(hookId: string): HookManifest {
    const manifest = this.manifestLookup(hookId);
    if (!manifest) {
      throw new OverrideGateError(hookId, 'resolve', 'unknown-hook', 'not-found');
    }
    return manifest;
  }

  // -- Gate enforcement (uses internal lookup, never caller-provided) --------

  private assertDisableable(hookId: string): void {
    const manifest = this.resolveManifest(hookId);
    if (!manifest.disableable) {
      throw new OverrideGateError(hookId, 'disable', 'disableable', false);
    }
  }

  private assertContentEditable(hookId: string, source: HookOverrideSource): void {
    const manifest = this.resolveManifest(hookId);
    if (manifest.safetyTier === 'readonly') {
      throw new OverrideGateError(hookId, 'content-set', 'safetyTier', 'readonly');
    }
    if (manifest.safetyTier === 'limited-edit' && source !== 'operator') {
      throw new OverrideGateError(hookId, 'content-set', 'safetyTier', 'limited-edit');
    }
  }

  // -- Write operations -----------------------------------------------------

  async enable(
    hookId: string,
    actorId: string,
    opts?: { source?: HookOverrideSource; workspaceId?: string; reason?: string },
  ): Promise<void> {
    this.resolveManifest(hookId); // validate hookId is known (fail-closed)
    const ws = opts?.workspaceId ?? this.defaultWorkspaceId;
    const source = opts?.source ?? 'operator';
    const existing = await this.getOverride(hookId, ws);
    const override: HookOverride = {
      ...(existing ?? {}),
      hookId,
      enabled: true,
      source,
      updatedAt: Date.now(),
      updatedBy: actorId,
    };
    await this.redis.hset(OVERRIDE_HASH(ws), hookId, JSON.stringify(override));
    await this.recordEvent(ws, hookId, 'enable', source, actorId, opts?.reason);
  }

  async disable(
    hookId: string,
    actorId: string,
    opts?: { source?: HookOverrideSource; workspaceId?: string; reason?: string },
  ): Promise<void> {
    this.assertDisableable(hookId);
    const ws = opts?.workspaceId ?? this.defaultWorkspaceId;
    const source = opts?.source ?? 'operator';
    const existing = await this.getOverride(hookId, ws);
    const override: HookOverride = {
      ...(existing ?? {}),
      hookId,
      enabled: false,
      source,
      updatedAt: Date.now(),
      updatedBy: actorId,
    };
    await this.redis.hset(OVERRIDE_HASH(ws), hookId, JSON.stringify(override));
    await this.recordEvent(ws, hookId, 'disable', source, actorId, opts?.reason);
  }

  async setContentOverride(
    hookId: string,
    content: string,
    actorId: string,
    opts?: { source?: HookOverrideSource; workspaceId?: string; reason?: string },
  ): Promise<void> {
    const source = opts?.source ?? 'operator';
    this.assertContentEditable(hookId, source);
    const ws = opts?.workspaceId ?? this.defaultWorkspaceId;
    const existing = await this.getOverride(hookId, ws);
    const override: HookOverride = {
      ...(existing ?? {}),
      hookId,
      contentOverride: content,
      contentVersion: (existing?.contentVersion ?? 0) + 1,
      source,
      updatedAt: Date.now(),
      updatedBy: actorId,
    };
    await this.redis.hset(OVERRIDE_HASH(ws), hookId, JSON.stringify(override));
    await this.recordEvent(ws, hookId, 'content-set', source, actorId, opts?.reason);
  }

  async clearContentOverride(
    hookId: string,
    actorId: string,
    opts?: { source?: HookOverrideSource; workspaceId?: string; reason?: string },
  ): Promise<void> {
    const ws = opts?.workspaceId ?? this.defaultWorkspaceId;
    const source = opts?.source ?? 'operator';
    const existing = await this.getOverride(hookId, ws);
    if (!existing) return;
    const { contentOverride: _, contentVersion: __, ...rest } = existing;
    const override: HookOverride = {
      ...rest,
      source,
      updatedAt: Date.now(),
      updatedBy: actorId,
    };
    await this.redis.hset(OVERRIDE_HASH(ws), hookId, JSON.stringify(override));
    await this.recordEvent(ws, hookId, 'content-clear', source, actorId, opts?.reason);
  }

  async rollback(
    hookId: string,
    actorId: string,
    opts?: { source?: HookOverrideSource; workspaceId?: string; reason?: string },
  ): Promise<void> {
    const ws = opts?.workspaceId ?? this.defaultWorkspaceId;
    const source = opts?.source ?? 'operator';
    await this.redis.hdel(OVERRIDE_HASH(ws), hookId);
    await this.recordEvent(ws, hookId, 'rollback', source, actorId, opts?.reason);
  }

  // -- Read operations ------------------------------------------------------

  async getOverride(hookId: string, workspaceId?: string): Promise<HookOverride | null> {
    const raw = await this.redis.hget(OVERRIDE_HASH(workspaceId ?? this.defaultWorkspaceId), hookId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as HookOverride;
    } catch {
      return null;
    }
  }

  async listOverrides(workspaceId?: string): Promise<HookOverride[]> {
    const all = await this.redis.hgetall(OVERRIDE_HASH(workspaceId ?? this.defaultWorkspaceId));
    if (!all) return [];
    const results: HookOverride[] = [];
    for (const v of Object.values(all)) {
      try {
        results.push(JSON.parse(v) as HookOverride);
      } catch {
        /* skip corrupted */
      }
    }
    return results;
  }

  /** Load all overrides as a sync Map for pipeline hot-path resolution. */
  async loadSnapshot(workspaceId?: string): Promise<ReadonlyMap<string, HookOverride>> {
    const overrides = await this.listOverrides(workspaceId);
    return new Map(overrides.map((o) => [o.hookId, o]));
  }

  // -- Event stream (ZSET time-indexed) -------------------------------------

  async listEvents(opts?: {
    workspaceId?: string;
    limit?: number;
    since?: number;
    until?: number;
  }): Promise<OverrideChangeEvent[]> {
    const ws = opts?.workspaceId ?? this.defaultWorkspaceId;
    const since = opts?.since ?? 0;
    const until = opts?.until ?? '+inf';
    const limit = opts?.limit ?? 50;
    const eventIds = await this.redis.zrangebyscore(EVENT_ZSET(ws), since, until, 'LIMIT', 0, limit);
    const events: OverrideChangeEvent[] = [];
    for (const id of eventIds) {
      const raw = await this.redis.get(EVENT_KEY(ws, id));
      if (!raw) continue;
      try {
        events.push(JSON.parse(raw) as OverrideChangeEvent);
      } catch {
        /* skip */
      }
    }
    return events;
  }

  // -- Internal helpers -----------------------------------------------------

  private async recordEvent(
    workspaceId: string,
    hookId: string,
    action: OverrideAction,
    source: HookOverrideSource,
    actorId: string,
    reason?: string,
  ): Promise<void> {
    const timestamp = Date.now();
    // Monotonic seq suffix prevents collision on same-ms same-hook writes (P2 fix)
    const seq = this.eventSeq++;
    const eventId = `${timestamp}-${hookId}-${action}-${seq}`;
    const event: OverrideChangeEvent = {
      eventId,
      hookId,
      workspaceId,
      action,
      source,
      timestamp,
      actorId,
      ...(reason ? { reason } : {}),
    };
    await this.redis.set(EVENT_KEY(workspaceId, eventId), JSON.stringify(event), 'EX', EVENT_TTL_SECONDS);
    await this.redis.zadd(EVENT_ZSET(workspaceId), timestamp, eventId);
    // Prune ZSET entries older than TTL to prevent stale index accumulation (P2 fix)
    const pruneThreshold = timestamp - EVENT_TTL_SECONDS * 1000;
    await this.redis.zremrangebyscore(EVENT_ZSET(workspaceId), 0, pruneThreshold);
  }
}
