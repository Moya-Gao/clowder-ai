/**
 * Session Chain Types
 * F24: Thread → N Sessions per cat, with context health tracking.
 *
 * Session lifecycle: active → sealing → sealed
 * - active: currently in use (one per cat per thread)
 * - sealing: writing transcript + generating digest (Phase B)
 * - sealed: immutable snapshot, readable by sub-agents (Phase C+)
 */

import type { CatId } from './ids.js';

export type SessionStatus = 'active' | 'sealing' | 'sealed';

export interface SessionRecord {
  readonly id: string;
  /** CLI-reported session ID (from session_init event) */
  cliSessionId: string;
  readonly threadId: string;
  readonly catId: CatId;
  readonly userId: string;
  /** Chain sequence number (0-based) */
  readonly seq: number;
  status: SessionStatus;
  /** Latest context health snapshot after last invocation */
  contextHealth?: ContextHealth;
  messageCount: number;
  /** Seal reason (Phase B) */
  sealReason?: 'threshold' | 'manual' | 'error';
  readonly createdAt: number;
  updatedAt: number;
  sealedAt?: number;
}

export interface ContextHealth {
  /** Current used tokens (= inputTokens from last invocation) */
  usedTokens: number;
  /** Total context window capacity */
  windowTokens: number;
  /** usedTokens / windowTokens (0.0 ~ 1.0) */
  fillRatio: number;
  /** exact = CLI reported; approx = hardcoded fallback */
  source: 'exact' | 'approx';
  measuredAt: number;
}

export interface ContextHealthConfig {
  /** Warning threshold (default 0.70) — frontend shows yellow */
  warnThreshold: number;
  /** Seal threshold (default 0.85) — triggers auto-seal (Phase B) */
  sealThreshold: number;
}
