// check-sync-public-delta-gate.mjs - F251 public target delta preservation gate.
//
// V1 starts with a pure classifier so the rsync safety contract is testable
// before wiring git worktrees and sync-to-opensource.sh.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PASS = 'pass';
const BLOCK = 'block';
const OVERRIDE = 'override';
const BLOB_KEYS = ['baseBlob', 'theirsBlob', 'oursBlob'];
const DELETE_CANDIDATE_MODES = new Set(['target-added-would-delete-block', 'delete-or-rename-block']);
const DELETE_OR_RENAME_CHANGE_KINDS = new Set(['delete', 'rename']);
const SYNC_TAG_PREFIX = 'sync/';
const LOCAL_TAG_REF_PREFIX = 'refs/tags/';
const REMOTE_SYNC_TAG_REF_PREFIX = 'refs/cat-cafe-sync-baselines';
const DEFAULT_REMOTE = 'origin';
const DEFAULT_BRANCH = 'main';
const DEFAULT_REPORT_OUTPUT_DIR = 'docs/ops';
const REPORT_VERSION = 1;
const REPORT_KIND = 'public-delta-gate';
const SOURCE_REPO = 'cat-cafe';
const TARGET_REPO = 'clowder-ai';

function defaultGit(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' }).trim();
}

function readStringOption(options, key, defaultValue) {
  if (typeof options[key] === 'string' && options[key].length > 0) {
    return options[key];
  }
  return defaultValue;
}

function gitOutput(repo, args, options = {}) {
  let git = defaultGit;
  if (typeof options.git === 'function') {
    git = options.git;
  }
  return git(repo, args).trim();
}

function tryGitOutput(repo, args, options = {}) {
  try {
    return gitOutput(repo, args, options);
  } catch {
    return undefined;
  }
}

function requireCommit(repo, ref, options = {}) {
  const commit = tryGitOutput(repo, ['rev-parse', '--verify', `${ref}^{commit}`], options);
  if (!commit) {
    throw new Error(`Could not resolve public delta baseline: ref '${ref}' is not a commit`);
  }
  return commit;
}

function isAncestor(repo, ancestor, descendant, options = {}) {
  return tryGitOutput(repo, ['merge-base', '--is-ancestor', ancestor, descendant], options) !== undefined;
}

function readRemoteSyncTagRefPrefix(options = {}) {
  const remote = readStringOption(options, 'remote', DEFAULT_REMOTE);
  return `${REMOTE_SYNC_TAG_REF_PREFIX}/${remote}/`;
}

function isShallowRepository(repo, options = {}) {
  return tryGitOutput(repo, ['rev-parse', '--is-shallow-repository'], options) === 'true';
}

function deepenTargetHistory(repo, options = {}) {
  if (!isShallowRepository(repo, options)) {
    return;
  }

  const remote = readStringOption(options, 'remote', DEFAULT_REMOTE);
  const branch = readStringOption(options, 'branch', DEFAULT_BRANCH);
  gitOutput(repo, ['fetch', '--no-tags', '--unshallow', remote, branch], options);
}

function fetchTargetRefs(repo, options = {}) {
  const remote = readStringOption(options, 'remote', DEFAULT_REMOTE);
  const branch = readStringOption(options, 'branch', DEFAULT_BRANCH);
  gitOutput(repo, ['fetch', '--no-tags', remote, branch], options);
  deepenTargetHistory(repo, options);
  gitOutput(
    repo,
    [
      'fetch',
      '--no-tags',
      '--prune',
      remote,
      `+refs/tags/${SYNC_TAG_PREFIX}*:refs/cat-cafe-sync-baselines/${remote}/${SYNC_TAG_PREFIX}*`,
    ],
    options,
  );
}

function resolveTargetHeadRef(repo, options = {}) {
  if (options.headRef) {
    requireCommit(repo, options.headRef, options);
    return options.headRef;
  }

  const remote = readStringOption(options, 'remote', DEFAULT_REMOTE);
  const branch = readStringOption(options, 'branch', DEFAULT_BRANCH);
  const remoteMainRef = `refs/remotes/${remote}/${branch}`;
  if (tryGitOutput(repo, ['show-ref', '--verify', '--quiet', remoteMainRef], options) !== undefined) {
    return remoteMainRef;
  }
  requireCommit(repo, 'HEAD', options);
  return 'HEAD';
}

function compareSyncTagCandidates(left, right) {
  if (!left) {
    return right;
  }
  if (right.epoch > left.epoch) {
    return right;
  }
  if (right.epoch === left.epoch && right.ref > left.ref) {
    return right;
  }
  return left;
}

function readReachableSyncTagCandidates(repo, headRef, options = {}) {
  const refPrefix = options.noFetch ? LOCAL_TAG_REF_PREFIX : readRemoteSyncTagRefPrefix(options);
  const tagList = tryGitOutput(
    repo,
    ['for-each-ref', '--format=%(refname)', `${refPrefix}${SYNC_TAG_PREFIX}`],
    options,
  );
  if (!tagList) {
    return [];
  }

  const candidates = [];
  for (const fullRef of tagList.split('\n')) {
    const tagRef = fullRef.startsWith(refPrefix) ? fullRef.slice(refPrefix.length) : fullRef;
    if (!tagRef.startsWith(SYNC_TAG_PREFIX)) {
      continue;
    }
    const commit = tryGitOutput(repo, ['rev-parse', '--verify', `${fullRef}^{commit}`], options);
    if (!commit) {
      continue;
    }
    if (!isAncestor(repo, commit, headRef, options)) {
      continue;
    }
    const epochText = tryGitOutput(repo, ['show', '-s', '--format=%ct', commit], options);
    if (!epochText) {
      continue;
    }
    const epoch = Number.parseInt(epochText, 10);
    if (!Number.isFinite(epoch)) {
      continue;
    }
    candidates.push({ ref: tagRef, commit, epoch });
  }
  return candidates;
}

function resolveLatestReachableSyncTag(repo, headRef, options = {}) {
  let bestCandidate;
  for (const candidate of readReachableSyncTagCandidates(repo, headRef, options)) {
    bestCandidate = compareSyncTagCandidates(bestCandidate, candidate);
  }
  if (!bestCandidate) {
    return undefined;
  }
  return {
    baselineSource: 'sync-tag',
    baselineRef: bestCandidate.ref,
    baselineCommit: bestCandidate.commit,
    targetHeadRef: headRef,
  };
}

function readJsonFromCommit(repo, commit, path, options = {}) {
  const raw = gitOutput(repo, ['show', `${commit}:${path}`], options);
  return JSON.parse(raw);
}

function resolveLatestLandedSyncProvenance(repo, headRef, options = {}) {
  const commits = tryGitOutput(
    repo,
    ['log', '--first-parent', '--format=%H', headRef, '--', '.sync-provenance.json'],
    options,
  );
  if (!commits) {
    return undefined;
  }

  const latestCommit = commits.split('\n')[0];
  const provenance = readJsonFromCommit(repo, latestCommit, '.sync-provenance.json', options);
  if (typeof provenance.source_commit_sha !== 'string') {
    throw new Error(
      `Could not resolve public delta baseline: latest sync provenance commit ${latestCommit} is missing source_commit_sha`,
    );
  }
  if (provenance.source_commit_sha.length === 0) {
    throw new Error(
      `Could not resolve public delta baseline: latest sync provenance commit ${latestCommit} is missing source_commit_sha`,
    );
  }

  return {
    baselineSource: 'landed-sync-commit',
    baselineCommit: latestCommit,
    sourceCommitSha: provenance.source_commit_sha,
    provenanceTargetHeadSha: provenance.target_head_sha,
    targetHeadRef: headRef,
  };
}

export function resolvePublicDeltaGateBaseline(options = {}) {
  if (!options.targetRepo) {
    throw new Error('resolvePublicDeltaGateBaseline requires targetRepo');
  }

  if (!options.noFetch) {
    fetchTargetRefs(options.targetRepo, options);
  }

  const targetHeadRef = resolveTargetHeadRef(options.targetRepo, options);
  if (options.baseline) {
    const baselineCommit = requireCommit(options.targetRepo, options.baseline, options);
    if (!isAncestor(options.targetRepo, baselineCommit, targetHeadRef, options)) {
      throw new Error(
        `Could not resolve public delta baseline: explicit baseline ${baselineCommit} is not reachable from ${targetHeadRef}`,
      );
    }
    return {
      baselineSource: 'explicit',
      baselineCommit,
      targetHeadRef,
    };
  }

  const syncTagBaseline = resolveLatestReachableSyncTag(options.targetRepo, targetHeadRef, options);
  if (syncTagBaseline) {
    return syncTagBaseline;
  }

  const provenanceBaseline = resolveLatestLandedSyncProvenance(options.targetRepo, targetHeadRef, options);
  if (provenanceBaseline) {
    return provenanceBaseline;
  }

  throw new Error('Could not resolve public delta baseline: no reachable sync/* tag or sync provenance commit found');
}

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

function isBlankReportCell(value) {
  if (value === undefined) {
    return true;
  }
  if (value === null) {
    return true;
  }
  if (value === '') {
    return true;
  }
  return false;
}

function codeCell(value) {
  if (isBlankReportCell(value)) {
    return '`-`';
  }
  return `\`${String(value).replaceAll('`', '\\`')}\``;
}

function tableCell(value) {
  if (isBlankReportCell(value)) {
    return '-';
  }
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function renderTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`;
  const separatorLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyLines = rows.map((row) => `| ${row.map(tableCell).join(' | ')} |`);
  return [headerLine, separatorLine, ...bodyLines].join('\n');
}

function sanitizeReportTimestamp(timestamp) {
  return String(timestamp)
    .replaceAll(':', '')
    .replaceAll('.', '')
    .replace(/[^0-9TZ-]/g, '');
}

function countBySuggestedAction(items) {
  const counts = new Map();
  for (const item of items) {
    const currentCount = counts.has(item.suggestedAction) ? counts.get(item.suggestedAction) : 0;
    counts.set(item.suggestedAction, currentCount + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function readReportGeneratedAt(input) {
  if (typeof input.generatedAt === 'string' && input.generatedAt.length > 0) {
    return input.generatedAt;
  }
  return new Date().toISOString();
}

function readRequiredReportString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`buildPublicDeltaGateReport requires ${fieldName}`);
  }
  if (value.length === 0) {
    throw new Error(`buildPublicDeltaGateReport requires ${fieldName}`);
  }
  return value;
}

function requireReportString(input, key) {
  return readRequiredReportString(input[key], key);
}

function requireBaselineReportString(baseline, key) {
  return readRequiredReportString(baseline[key], `baseline.${key}`);
}

function normalizeReportBaseline(baseline) {
  if (baseline === null) {
    throw new Error('buildPublicDeltaGateReport requires baseline');
  }
  if (typeof baseline !== 'object') {
    throw new Error('buildPublicDeltaGateReport requires baseline');
  }
  if (Array.isArray(baseline)) {
    throw new Error('buildPublicDeltaGateReport requires baseline');
  }
  return {
    ...baseline,
    baselineSource: requireBaselineReportString(baseline, 'baselineSource'),
    baselineCommit: requireBaselineReportString(baseline, 'baselineCommit'),
  };
}

function readReportOutputPath(options, key, defaultPath) {
  if (typeof options[key] === 'string' && options[key].length > 0) {
    return options[key];
  }
  return defaultPath;
}

function assertReportOutputPathAvailable(filePath) {
  if (existsSync(filePath)) {
    throw new Error(`writePublicDeltaGateReports refuses to overwrite existing report artifact: ${filePath}`);
  }
}

function writeNewReportArtifact(filePath, content) {
  writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'wx' });
}

export function buildPublicDeltaGateReport(input = {}) {
  if (!Array.isArray(input.items)) {
    throw new Error('buildPublicDeltaGateReport requires items');
  }
  const generatedAt = readReportGeneratedAt(input);
  const baseline = normalizeReportBaseline(input.baseline);
  return {
    version: REPORT_VERSION,
    reportKind: REPORT_KIND,
    generatedAt,
    sourceRepo: SOURCE_REPO,
    targetRepo: TARGET_REPO,
    syncModule: requireReportString(input, 'syncModule'),
    baseline,
    sourceHead: requireReportString(input, 'sourceHead'),
    targetHead: requireReportString(input, 'targetHead'),
    exportedHead: requireReportString(input, 'exportedHead'),
    summary: buildPublicDeltaGateSummary(input.items),
    items: input.items,
  };
}

export function renderPublicDeltaGateMarkdown(report) {
  const blockedItems = report.items.filter((item) => item.risk === BLOCK);
  const overrideItems = report.items.filter((item) => item.risk === OVERRIDE);
  const actionRows = countBySuggestedAction(report.items);

  const lines = [
    '# Public Delta Gate Report',
    '',
    '## Baseline / Source / Target',
    '',
    renderTable(
      ['Field', 'Value'],
      [
        ['Generated at', codeCell(report.generatedAt)],
        ['Source repo', codeCell(report.sourceRepo)],
        ['Target repo', codeCell(report.targetRepo)],
        ['Sync module', codeCell(report.syncModule)],
        ['Baseline source', codeCell(report.baseline.baselineSource)],
        ['Baseline ref', codeCell(report.baseline.baselineRef)],
        ['Baseline commit', codeCell(report.baseline.baselineCommit)],
        ['Target head ref', codeCell(report.baseline.targetHeadRef)],
        ['Source head', codeCell(report.sourceHead)],
        ['Target head', codeCell(report.targetHead)],
        ['Exported head', codeCell(report.exportedHead)],
      ],
    ),
    '',
    '## Summary',
    '',
    renderTable(
      ['Metric', 'Count'],
      [
        ['Pass', report.summary.passCount],
        ['Block', report.summary.blockCount],
        ['Override', report.summary.overrideCount],
        ['Revert candidates', report.summary.revertCandidateCount],
        ['Conflict candidates', report.summary.conflictCandidateCount],
        ['Delete candidates', report.summary.deleteCandidateCount],
        ['CVO approval required', report.summary.cvoApprovalRequired ? 'yes' : 'no'],
      ],
    ),
    '',
    '## Blocked Items',
    '',
    blockedItems.length > 0
      ? renderTable(
          ['Path', 'Mode', 'Suggested action', 'Reason'],
          blockedItems.map((item) => [item.path, item.mode, item.suggestedAction, item.reason]),
        )
      : 'No blocked items.',
    '',
    '## Overrides',
    '',
    overrideItems.length > 0
      ? renderTable(
          ['Path', 'Mode', 'Reason'],
          overrideItems.map((item) => [item.path, item.mode, item.overrideReason]),
        )
      : 'No overrides.',
    '',
    '## Suggested Actions',
    '',
    actionRows.length > 0
      ? renderTable(
          ['Suggested action', 'Count'],
          actionRows.map(([action, count]) => [action, count]),
        )
      : 'No suggested actions.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function writePublicDeltaGateReports(report, options = {}) {
  const outputDir = readStringOption(options, 'outputDir', DEFAULT_REPORT_OUTPUT_DIR);
  mkdirSync(outputDir, { recursive: true });
  const timestamp = sanitizeReportTimestamp(readStringOption(options, 'timestamp', readReportGeneratedAt(report)));
  const jsonPath = readReportOutputPath(
    options,
    'jsonPath',
    join(outputDir, `sync-public-delta-gate-${timestamp}.json`),
  );
  const markdownPath = readReportOutputPath(
    options,
    'markdownPath',
    join(outputDir, `sync-public-delta-gate-${timestamp}.md`),
  );

  assertReportOutputPathAvailable(jsonPath);
  assertReportOutputPathAvailable(markdownPath);
  writeNewReportArtifact(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeNewReportArtifact(markdownPath, renderPublicDeltaGateMarkdown(report));

  return { jsonPath, markdownPath };
}
