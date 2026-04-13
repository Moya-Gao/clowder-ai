/**
 * B-4: GuideSession Repository — independent guide state storage.
 *
 * Port interface + Redis implementation.
 */

import type { RedisClient } from '@cat-cafe/shared/utils';
import type { GuideStateV1, GuideStatus } from '../cats/services/stores/ports/ThreadStore.js';
import { createSessionFromState, type GuideSession, generateSessionId } from './GuideSession.js';

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

export interface IGuideSessionStore {
  getByThread(threadId: string): Promise<GuideSession | null>;
  save(session: GuideSession): Promise<void>;
  delete(threadId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'cat-cafe:guide-session:';
const DEFAULT_TTL = 30 * 24 * 3600; // 30 days

function sessionKey(threadId: string): string {
  return `${KEY_PREFIX}${threadId}`;
}

function parseSession(raw: string): GuideSession | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.sessionId) {
      return parsed as GuideSession;
    }
  } catch {
    /* ignore malformed */
  }
  return null;
}

// ---------------------------------------------------------------------------
// Redis Implementation
// ---------------------------------------------------------------------------

export class RedisGuideSessionStore implements IGuideSessionStore {
  private readonly redis: RedisClient;
  private readonly ttlSeconds: number;

  constructor(redis: RedisClient, options?: { ttlSeconds?: number }) {
    this.redis = redis;
    this.ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL;
  }

  async getByThread(threadId: string): Promise<GuideSession | null> {
    const key = sessionKey(threadId);
    const raw = await this.redis.get(key);
    if (raw) return parseSession(raw);
    return null;
  }

  async save(session: GuideSession): Promise<void> {
    const key = sessionKey(session.threadId);
    await this.redis.set(key, JSON.stringify(session), 'EX', this.ttlSeconds);
  }

  async delete(threadId: string): Promise<void> {
    await this.redis.del(sessionKey(threadId));
  }
}

// ---------------------------------------------------------------------------
// Conversion helpers (service layer uses these to update sessions)
// ---------------------------------------------------------------------------

export function createOfferedSession(params: {
  threadId: string;
  userId: string;
  guideId: string;
  offeredBy?: string;
}): GuideSession {
  return {
    sessionId: generateSessionId(params.threadId),
    threadId: params.threadId,
    userId: params.userId,
    guideId: params.guideId,
    state: 'offered',
    offeredAt: Date.now(),
    completionAcked: false,
    offeredBy: params.offeredBy,
  };
}

export function transitionSession(session: GuideSession, newState: GuideStatus, currentStep?: number): GuideSession {
  return {
    ...session,
    state: newState,
    ...(currentStep !== undefined ? { currentStep } : {}),
    ...(newState === 'active' && !session.startedAt ? { startedAt: Date.now() } : {}),
    ...(newState === 'completed' ? { completedAt: Date.now() } : {}),
  };
}

export function ackSessionCompletion(session: GuideSession): GuideSession {
  return { ...session, completionAcked: true };
}

// ---------------------------------------------------------------------------
// Legacy adapter (converts GuideSession ↔ GuideStateV1 for bridge callers)
// ---------------------------------------------------------------------------

export function sessionToLegacyState(session: GuideSession): GuideStateV1 {
  return {
    v: 1,
    guideId: session.guideId,
    status: session.state,
    userId: session.userId,
    currentStep: session.currentStep,
    offeredAt: session.offeredAt,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    completionAcked: session.completionAcked || undefined,
    offeredBy: session.offeredBy,
  };
}

function updateSessionFromState(existing: GuideSession, state: GuideStateV1): GuideSession {
  return {
    ...existing,
    guideId: state.guideId,
    state: state.status,
    userId: state.userId ?? existing.userId,
    currentStep: state.currentStep,
    offeredAt: state.offeredAt,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    completionAcked: state.completionAcked ?? false,
    offeredBy: state.offeredBy,
  };
}

// ---------------------------------------------------------------------------
// Bridge: lets services keep working with GuideStateV1 while storing GuideSession
// ---------------------------------------------------------------------------

/**
 * Adapter that speaks GuideStateV1 (for existing services) but persists
 * GuideSession through the independent session store.
 * Services call `bridge.get/set` instead of `threadStore.updateGuideState`.
 */
export class GuideStateBridge {
  constructor(private readonly store: IGuideSessionStore) {}

  async get(threadId: string): Promise<GuideStateV1 | undefined> {
    const session = await this.store.getByThread(threadId);
    return session ? sessionToLegacyState(session) : undefined;
  }

  async set(threadId: string, state: GuideStateV1): Promise<void> {
    const existing = await this.store.getByThread(threadId);
    const session = existing ? updateSessionFromState(existing, state) : createSessionFromState(threadId, state);
    await this.store.save(session);
  }

  async delete(threadId: string): Promise<void> {
    await this.store.delete(threadId);
  }
}

/**
 * Create a GuideStateBridge from an independent session store.
 * Services call bridge.get/set (GuideStateV1 interface) while the
 * store persists GuideSession entities independently from ThreadStore.
 */
export function createGuideStoreBridge(store: IGuideSessionStore): GuideStateBridge {
  return new GuideStateBridge(store);
}
