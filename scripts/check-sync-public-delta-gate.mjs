// check-sync-public-delta-gate.mjs - F251 public target delta preservation gate.
//
// V1 starts with a pure classifier so the rsync safety contract is testable
// before wiring git worktrees and sync-to-opensource.sh.

const PASS = 'pass';
const BLOCK = 'block';
const OVERRIDE = 'override';
const BLOB_KEYS = ['baseBlob', 'theirsBlob', 'oursBlob'];
const DELETE_CANDIDATE_MODES = new Set(['target-added-would-delete-block', 'delete-or-rename-block']);
const DELETE_OR_RENAME_CHANGE_KINDS = new Set(['delete', 'rename']);

function sameBlob(left, right) {
  return left === right;
}

function isMissingBlobMetadata(input, key) {
  if (!Object.hasOwn(input, key)) {
    return true;
  }
  return input[key] === undefined;
}

function readBlob(input, key) {
  if (isMissingBlobMetadata(input, key)) {
    return null;
  }
  return input[key];
}

function readMissingBlobKeys(input) {
  return BLOB_KEYS.filter((key) => isMissingBlobMetadata(input, key));
}

function readLinkedLedgerEntries(input) {
  if (Array.isArray(input.linkedLedgerEntries)) {
    return input.linkedLedgerEntries;
  }
  return [];
}

function readOverrideReason(input) {
  if (typeof input.overrideReason !== 'string') {
    return undefined;
  }
  const reason = input.overrideReason.trim();
  if (reason.length === 0) {
    return undefined;
  }
  return reason;
}

function normalizeInput(input) {
  return {
    ...input,
    baseBlob: readBlob(input, 'baseBlob'),
    theirsBlob: readBlob(input, 'theirsBlob'),
    oursBlob: readBlob(input, 'oursBlob'),
    missingBlobKeys: readMissingBlobKeys(input),
    linkedLedgerEntries: readLinkedLedgerEntries(input),
    overrideReason: readOverrideReason(input),
  };
}

function hasOverrideReason(input) {
  return typeof input.overrideReason === 'string' && input.overrideReason.length > 0;
}

function hasMissingBlobMetadata(input) {
  return input.missingBlobKeys.length > 0;
}

function baseItem(input, mode, risk, suggestedAction, reason) {
  return {
    path: input.path,
    publicBehaviorId: input.publicBehaviorId,
    mode,
    risk,
    reason,
    baseBlob: readBlob(input, 'baseBlob'),
    theirsBlob: readBlob(input, 'theirsBlob'),
    oursBlob: readBlob(input, 'oursBlob'),
    suggestedAction,
    linkedLedgerEntries: input.linkedLedgerEntries,
    ...(input.overrideReason ? { overrideReason: input.overrideReason } : {}),
  };
}

function maybeOverride(input, item) {
  if (item.risk !== BLOCK) {
    return item;
  }
  if (!hasOverrideReason(input)) {
    return item;
  }
  return {
    ...item,
    mode: 'override-pass',
    risk: OVERRIDE,
    reason: `${item.reason} Override reason: ${input.overrideReason}`,
    overrideReason: input.overrideReason,
  };
}

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

const BLOB_STATE_RULES = [
  {
    mode: 'target-added-would-delete-block',
    risk: BLOCK,
    suggestedAction: 'preserve-target',
    reason: 'Target added this path, but the export omits it; rsync --delete would remove it.',
    matches: (input) => input.baseBlob === null && input.theirsBlob !== null && input.oursBlob === null,
  },
  {
    mode: 'source-only-pass',
    risk: PASS,
    suggestedAction: 'allow',
    reason: 'Source added a new path missing from baseline and target.',
    matches: (input) => input.baseBlob === null && input.theirsBlob === null && input.oursBlob !== null,
  },
  {
    mode: 'delete-or-rename-block',
    risk: BLOCK,
    suggestedAction: 'manual-review',
    reason: 'Delete/rename cases are fail-closed in V1.',
    matches: (input) => [input.theirsBlob, input.oursBlob].includes(null),
  },
  {
    mode: 'equivalent-preserved-pass',
    risk: PASS,
    suggestedAction: 'allow',
    reason: 'Target delta is already preserved in the export.',
    matches: (input) => sameBlob(input.theirsBlob, input.oursBlob),
  },
  {
    mode: 'source-only-pass',
    risk: PASS,
    suggestedAction: 'allow',
    reason: 'Target did not change this path since the sync baseline.',
    matches: (input) => sameBlob(input.theirsBlob, input.baseBlob),
  },
  {
    mode: 'target-only-would-revert-block',
    risk: BLOCK,
    suggestedAction: 'preserve-target',
    reason: 'Target changed this path since baseline, but the export reverts it to baseline.',
    matches: (input) => sameBlob(input.oursBlob, input.baseBlob),
  },
];

const CONFLICT_RULE = {
  mode: 'both-changed-conflict-block',
  risk: BLOCK,
  suggestedAction: 'manual-review',
  reason: 'Target and export both changed this path differently from baseline.',
};

function classifyBlobState(input) {
  const matchingRule = BLOB_STATE_RULES.find((rule) => rule.matches(input));
  if (matchingRule) {
    return matchingRule;
  }
  return CONFLICT_RULE;
}

export function classifyPublicDeltaGateItem(input) {
  if (!input?.path) {
    throw new Error('classifyPublicDeltaGateItem requires path');
  }
  const normalized = normalizeInput(input);

  if (hasMissingBlobMetadata(normalized)) {
    return maybeOverride(
      normalized,
      baseItem(
        normalized,
        'delete-or-rename-block',
        BLOCK,
        'manual-review',
        'Missing blob metadata is fail-closed in V1.',
      ),
    );
  }

  if (normalized.isGeneratedOrProvenance) {
    return baseItem(
      normalized,
      'generated-or-provenance-pass',
      PASS,
      'allow',
      'Generated/provenance path is ignored by the public delta gate.',
    );
  }

  if (normalized.isTargetOwned) {
    return baseItem(
      normalized,
      'target-owned-pass',
      PASS,
      'allow',
      'Target-owned path is preserved outside sync-managed overwrite semantics.',
    );
  }

  if (DELETE_OR_RENAME_CHANGE_KINDS.has(normalized.changeKind)) {
    return maybeOverride(
      normalized,
      baseItem(
        normalized,
        'delete-or-rename-block',
        BLOCK,
        'manual-review',
        'Delete/rename cases are fail-closed in V1.',
      ),
    );
  }

  if (normalized.isBinary) {
    return maybeOverride(
      normalized,
      baseItem(normalized, 'binary-block', BLOCK, 'manual-review', 'Binary deltas are fail-closed in V1.'),
    );
  }

  const rule = classifyBlobState(normalized);
  return maybeOverride(normalized, baseItem(normalized, rule.mode, rule.risk, rule.suggestedAction, rule.reason));
}

export function buildPublicDeltaGateSummary(items) {
  const overrideCount = countWhere(items, (item) => item.risk === OVERRIDE);

  const summary = {
    passCount: countWhere(items, (item) => item.risk === PASS),
    blockCount: countWhere(items, (item) => item.risk === BLOCK),
    revertCandidateCount: countWhere(
      items,
      (item) => item.risk === BLOCK && item.mode === 'target-only-would-revert-block',
    ),
    conflictCandidateCount: countWhere(
      items,
      (item) => item.risk === BLOCK && item.mode === 'both-changed-conflict-block',
    ),
    deleteCandidateCount: countWhere(items, (item) => item.risk === BLOCK && DELETE_CANDIDATE_MODES.has(item.mode)),
    overrideCount,
    cvoApprovalRequired: overrideCount > 3,
  };
  return summary;
}
