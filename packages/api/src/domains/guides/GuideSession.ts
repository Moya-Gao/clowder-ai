/**
 * B-4: GuideSession domain object.
 *
 * Independent entity replacing the thread-embedded `guideState`.
 * One active session per thread. The sessionId is unique per guide activation,
 * allowing history tracking if needed later.
 */

import type { GuideStatus } from '../cats/services/stores/ports/ThreadStore.js';

export interface GuideSession {
  sessionId: string;
  threadId: string;
  userId: string;
  guideId: string;
  clientId?: string;
  state: GuideStatus;
  currentStep?: number;
  offeredAt: number;
  startedAt?: number;
  completedAt?: number;
  completionAcked: boolean;
  offeredBy?: string;
}

let sessionCounter = 0;

export function generateSessionId(threadId: string): string {
  return `gs-${threadId.slice(-8)}-${Date.now()}-${++sessionCounter}`;
}

/**
 * Migrate legacy `GuideStateV1` (thread-embedded) to `GuideSession`.
 * Used by the session repository when reading from thread fallback.
 */
export function fromLegacyState(
  threadId: string,
  legacy: {
    guideId: string;
    status: GuideStatus;
    userId?: string;
    currentStep?: number;
    offeredAt: number;
    startedAt?: number;
    completedAt?: number;
    completionAcked?: boolean;
    offeredBy?: string;
  },
): GuideSession {
  return {
    sessionId: generateSessionId(threadId),
    threadId,
    userId: legacy.userId ?? '',
    guideId: legacy.guideId,
    state: legacy.status,
    currentStep: legacy.currentStep,
    offeredAt: legacy.offeredAt,
    startedAt: legacy.startedAt,
    completedAt: legacy.completedAt,
    completionAcked: legacy.completionAcked ?? false,
    offeredBy: legacy.offeredBy,
  };
}
