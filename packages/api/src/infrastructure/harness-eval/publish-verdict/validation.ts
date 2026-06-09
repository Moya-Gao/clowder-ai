import { basename, resolve } from 'node:path';
import { resolveSafeRawPath } from '../safe-path.js';
import type { VerdictHandoffPacket } from '../verdict-handoff.js';
import type {
  A2aSnapshotAttributionRefs,
  HandlerError,
  ResolvedSourceRefs,
  TaskOutcomeSnapshotSourceRefs,
  VerdictSourceRefs,
} from './types.js';

/**
 * F192 Phase H 收尾 PR-2: discriminator helper for the VerdictSourceRefs union.
 * Returns true when sourceRefs is the a2a variant (or unspecified, default a2a for backward compat).
 */
export function isA2aSourceRefs(refs: VerdictSourceRefs | undefined): refs is A2aSnapshotAttributionRefs {
  if (!refs) return true; // empty/undefined defaults to a2a interpretation
  if (!('kind' in refs) || refs.kind === undefined) return true;
  return refs.kind === 'a2a-snapshot-attribution';
}

export function isTaskOutcomeSourceRefs(refs: VerdictSourceRefs | undefined): refs is TaskOutcomeSnapshotSourceRefs {
  return Boolean(refs && 'kind' in refs && refs.kind === 'task-outcome-snapshot');
}

/**
 * F192 Phase H publish-verdict validation helpers.
 * Extracted from publish-verdict.ts per AGENTS.md 350-line hard limit.
 */

/**
 * Validate sourceRefs format (presence + type + basename — no path resolution).
 * Path resolution happens inside stage callback against LIVE harnessFeedbackRoot
 * (砚砚 R17 P1 cloud: snapshots/attributions are gitignored, only in live).
 */
export function validateSourceRefsFormat(
  sourceRefs: VerdictSourceRefs | undefined,
): { ok: true } | { ok: false; error: HandlerError } {
  if (!isA2aSourceRefs(sourceRefs)) {
    return {
      ok: false,
      error: {
        status: 400,
        error: 'invalid_source_ref',
        detail: `validateSourceRefsFormat called with non-a2a sourceRefs (kind=${(sourceRefs as { kind?: string }).kind ?? 'unknown'}); use isA2aSourceRefs guard before calling.`,
      },
    };
  }
  const snap = sourceRefs?.snapshotName;
  const attr = sourceRefs?.attributionName;
  if (!snap || !attr) {
    return {
      ok: false,
      error: {
        status: 400,
        error: 'missing_evidence_refs',
        detail:
          'eval:a2a requires sourceRefs.snapshotName + .attributionName (basenames). Tool will not fabricate evidence.',
      },
    };
  }
  if (typeof snap !== 'string' || typeof attr !== 'string') {
    return {
      ok: false,
      error: {
        status: 400,
        error: 'invalid_source_ref',
        detail: `sourceRefs.snapshotName + .attributionName must be strings (got ${typeof snap}, ${typeof attr})`,
      },
    };
  }
  for (const [field, value] of [
    ['snapshotName', snap],
    ['attributionName', attr],
  ] as const) {
    if (value === '.' || value === '..' || basename(value) !== value) {
      return {
        ok: false,
        error: {
          status: 400,
          error: 'invalid_source_ref',
          detail: `${field} invalid: must be simple basename (no path separators, no '.' / '..')`,
        },
      };
    }
  }
  return { ok: true };
}

export function resolveSourceRefsInRoot(
  harnessFeedbackRoot: string,
  snap: string,
  attr: string,
): { ok: true; refs: ResolvedSourceRefs } | { ok: false; reason: string } {
  const snapResult = resolveSafeRawPath(resolve(harnessFeedbackRoot, 'snapshots'), snap);
  if (!snapResult.ok) return { ok: false, reason: `snapshotName invalid: ${snapResult.reason}` };
  const attrResult = resolveSafeRawPath(resolve(harnessFeedbackRoot, 'attributions'), attr);
  if (!attrResult.ok) return { ok: false, reason: `attributionName invalid: ${attrResult.reason}` };
  return { ok: true, refs: { snapshotPath: snapResult.path, attributionPath: attrResult.path } };
}

export function validateTaskOutcomeSourceRefs(
  sourceRefs: VerdictSourceRefs | undefined,
): { ok: true } | { ok: false; error: HandlerError } {
  if (!isTaskOutcomeSourceRefs(sourceRefs)) {
    return {
      ok: false,
      error: {
        status: 400,
        error: 'invalid_source_ref',
        detail: `validateTaskOutcomeSourceRefs called with non-task-outcome sourceRefs (kind=${(sourceRefs as { kind?: string } | undefined)?.kind ?? 'unknown'}); use isTaskOutcomeSourceRefs guard before calling.`,
      },
    };
  }
  if (
    typeof sourceRefs.windowStartMs !== 'number' ||
    !Number.isFinite(sourceRefs.windowStartMs) ||
    typeof sourceRefs.windowEndMs !== 'number' ||
    !Number.isFinite(sourceRefs.windowEndMs)
  ) {
    return {
      ok: false,
      error: {
        status: 400,
        error: 'invalid_source_ref',
        detail: 'task-outcome-snapshot requires finite numeric windowStartMs and windowEndMs',
      },
    };
  }
  if (sourceRefs.windowEndMs <= sourceRefs.windowStartMs) {
    return {
      ok: false,
      error: {
        status: 400,
        error: 'invalid_source_ref',
        detail: 'task-outcome-snapshot requires windowEndMs > windowStartMs',
      },
    };
  }
  for (const [field, value] of [
    ['databasePath', sourceRefs.databasePath],
    ['evidenceCatId', sourceRefs.evidenceCatId],
  ] as const) {
    if (value !== undefined && typeof value !== 'string') {
      return {
        ok: false,
        error: {
          status: 400,
          error: 'invalid_source_ref',
          detail: `${field} must be a string when provided`,
        },
      };
    }
    if (typeof value === 'string' && /[\r\n]/.test(value)) {
      return {
        ok: false,
        error: {
          status: 400,
          error: 'invalid_source_ref',
          detail: `${field} must not contain newlines`,
        },
      };
    }
  }
  return { ok: true };
}

/**
 * 砚砚 R18/R19 P2 + cloud R18 P2: reject newline in EVERY packet string field that
 * renderer (eval-a2a-verdict-renderer.ts) interpolates into single-line markdown bullets.
 * Read-model regex parses first line → newline truncates AND enables bullet-injection
 * (e.g. phenomenon='x\n- Owner ask: pwned' rewrites Hub's owner ask). 砚砚 R19 found
 * componentId/featureId/metricRefs/sampleTraceRefs were missed; this lists is now
 * exhaustive against the renderer source.
 */
export function assertNoNewlineInBulletFields(packet: VerdictHandoffPacket): HandlerError | null {
  const fields: Array<[string, string]> = [
    ['phenomenon', packet.phenomenon],
    ['harnessUnderEval.featureId', packet.harnessUnderEval.featureId],
    ['harnessUnderEval.componentId', packet.harnessUnderEval.componentId],
    ['harnessUnderEval.name', packet.harnessUnderEval.name],
    ['ownerAsk.requestedAction', packet.ownerAsk.requestedAction],
    ['acceptanceReevalPlan.closureCondition', packet.acceptanceReevalPlan.closureCondition],
    ['acceptanceReevalPlan.nextEvalAt', packet.acceptanceReevalPlan.nextEvalAt],
    ...packet.evidencePacket.metricRefs.map((r, i): [string, string] => [`evidencePacket.metricRefs[${i}]`, r]),
    ...packet.evidencePacket.sampleTraceRefs.map((r, i): [string, string] => [
      `evidencePacket.sampleTraceRefs[${i}]`,
      r,
    ]),
    ...packet.counterarguments.map((c, i): [string, string] => [`counterarguments[${i}]`, c]),
  ];
  for (const [name, value] of fields) {
    if (/[\r\n]/.test(value)) {
      return {
        status: 400,
        error: 'invalid_packet_field',
        detail: `${name} must not contain newline characters (renderer writes single-line bullets; newlines truncate/inject)`,
      };
    }
  }
  return null;
}
