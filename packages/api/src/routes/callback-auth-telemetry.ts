/**
 * F174 Phase D1 — central recorder for callback auth failures.
 *
 * AC-D1: emit OTel counter `cat_cafe.callback_auth.failures{tool, cat, reason}`
 * AC-D2: cover all 5 reasons (expired/invalid_token/unknown_invocation/
 *        missing_creds/stale_invocation)
 * AC-D3: feed in-memory snapshot to `/api/debug/callback-auth`
 *
 * All 401 emission sites in routes/ funnel through `recordCallbackAuthFailure`
 * so observability is uniform regardless of which hook detected the failure.
 */

import type { CallbackAuthFailureReason } from '@cat-cafe/shared';
import { AGENT_ID, CALLBACK_REASON, CALLBACK_TOOL } from '../infrastructure/telemetry/genai-semconv.js';
import { callbackAuthFailures } from '../infrastructure/telemetry/instruments.js';

const RECENT_SAMPLES_CAP = 100;

interface FailureSample {
  at: number;
  reason: CallbackAuthFailureReason;
  tool: string;
  catId?: string;
}

const ZERO_REASON_COUNTS: Record<CallbackAuthFailureReason, number> = {
  expired: 0,
  invalid_token: 0,
  unknown_invocation: 0,
  missing_creds: 0,
  stale_invocation: 0,
};

let reasonCounts: Record<CallbackAuthFailureReason, number> = { ...ZERO_REASON_COUNTS };
let toolCounts: Record<string, number> = {};
let recentSamples: FailureSample[] = [];
let totalFailures = 0;
const startedAt = Date.now();

export interface CallbackAuthFailureRecord {
  reason: CallbackAuthFailureReason;
  tool: string;
  catId?: string;
}

export function recordCallbackAuthFailure(record: CallbackAuthFailureRecord): void {
  reasonCounts[record.reason] = (reasonCounts[record.reason] ?? 0) + 1;
  toolCounts[record.tool] = (toolCounts[record.tool] ?? 0) + 1;
  totalFailures += 1;

  recentSamples.push({
    at: Date.now(),
    reason: record.reason,
    tool: record.tool,
    catId: record.catId,
  });
  if (recentSamples.length > RECENT_SAMPLES_CAP) {
    recentSamples.splice(0, recentSamples.length - RECENT_SAMPLES_CAP);
  }

  // OTel counter export — allowlist-filtered attributes (cat may be undefined
  // for panel/anonymous requests; OTel SDK drops undefined values).
  const attributes: Record<string, string> = {
    [CALLBACK_REASON]: record.reason,
    [CALLBACK_TOOL]: record.tool,
  };
  if (record.catId) attributes[AGENT_ID] = record.catId;
  callbackAuthFailures.add(1, attributes);
}

export interface CallbackAuthFailureSnapshot {
  reasonCounts: Record<CallbackAuthFailureReason, number>;
  toolCounts: Record<string, number>;
  recentSamples: FailureSample[];
  totalFailures: number;
  startedAt: number;
  uptimeMs: number;
}

export function getCallbackAuthFailureSnapshot(): CallbackAuthFailureSnapshot {
  return {
    reasonCounts: { ...reasonCounts },
    toolCounts: { ...toolCounts },
    recentSamples: [...recentSamples],
    totalFailures,
    startedAt,
    uptimeMs: Date.now() - startedAt,
  };
}

/** Test-only — reset internal counters between cases. NEVER call from prod code. */
export function resetCallbackAuthFailureForTest(): void {
  reasonCounts = { ...ZERO_REASON_COUNTS };
  toolCounts = {};
  recentSamples = [];
  totalFailures = 0;
}
