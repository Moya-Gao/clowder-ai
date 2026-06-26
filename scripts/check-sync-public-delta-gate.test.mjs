import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  buildPublicDeltaGateSummary,
  classifyPublicDeltaGateItem,
  resolvePublicDeltaGateBaseline,
} from './check-sync-public-delta-gate.mjs';
import {
  commitFile,
  commitSyncProvenance,
  createFixtureTracker,
  git,
  makeFixture,
} from './publish-sync-tag-test-helpers.mjs';

const A = 'blob-a';
const B = 'blob-b';
const C = 'blob-c';

function classify(input) {
  return classifyPublicDeltaGateItem({
    path: 'packages/api/src/example.ts',
    baseBlob: A,
    theirsBlob: A,
    oursBlob: A,
    ...input,
  });
}

describe('public target delta classifier', () => {
  it('passes source-only changes', () => {
    const item = classify({ theirsBlob: A, oursBlob: B });

    assert.equal(item.mode, 'source-only-pass');
    assert.equal(item.risk, 'pass');
    assert.equal(item.suggestedAction, 'allow');
  });

  it('passes source-only file additions absent from the target', () => {
    const item = classify({ baseBlob: null, theirsBlob: null, oursBlob: B });

    assert.equal(item.mode, 'source-only-pass');
    assert.equal(item.risk, 'pass');
    assert.equal(item.suggestedAction, 'allow');
  });

  it('passes target deltas already preserved by the export', () => {
    const item = classify({ theirsBlob: B, oursBlob: B });

    assert.equal(item.mode, 'equivalent-preserved-pass');
    assert.equal(item.risk, 'pass');
    assert.equal(item.suggestedAction, 'allow');
  });

  it('blocks target-only deltas that full rsync would revert', () => {
    const item = classify({
      theirsBlob: B,
      oursBlob: A,
      publicBehaviorId: 'clowder-ai-723-f190-visual-parity',
    });

    assert.equal(item.mode, 'target-only-would-revert-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.suggestedAction, 'preserve-target');
    assert.equal(item.publicBehaviorId, 'clowder-ai-723-f190-visual-parity');
  });

  it('blocks both-changed conflicts', () => {
    const item = classify({ theirsBlob: B, oursBlob: C });

    assert.equal(item.mode, 'both-changed-conflict-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.suggestedAction, 'manual-review');
  });

  it('blocks target-added files that the export would delete', () => {
    const item = classify({ baseBlob: null, theirsBlob: B, oursBlob: null });

    assert.equal(item.mode, 'target-added-would-delete-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.suggestedAction, 'preserve-target');
  });

  it('blocks source-side file deletions even when target matches baseline', () => {
    const item = classify({ baseBlob: A, theirsBlob: A, oursBlob: null });

    assert.equal(item.mode, 'delete-or-rename-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.suggestedAction, 'manual-review');
  });

  it('blocks deletes and renames in V1', () => {
    const deleted = classify({ changeKind: 'delete', theirsBlob: null, oursBlob: B });
    const renamed = classify({ changeKind: 'rename', theirsBlob: B, oursBlob: C });

    assert.equal(deleted.mode, 'delete-or-rename-block');
    assert.equal(renamed.mode, 'delete-or-rename-block');
    assert.equal(deleted.risk, 'block');
    assert.equal(renamed.risk, 'block');
  });

  it('blocks impossible all-null triples fail-closed', () => {
    const item = classify({ baseBlob: null, theirsBlob: null, oursBlob: null });

    assert.equal(item.mode, 'delete-or-rename-block');
    assert.equal(item.risk, 'block');
  });

  it('blocks omitted blob fields fail-closed', () => {
    const item = classifyPublicDeltaGateItem({ path: 'packages/api/src/example.ts' });

    assert.equal(item.mode, 'delete-or-rename-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.baseBlob, null);
    assert.equal(item.theirsBlob, null);
    assert.equal(item.oursBlob, null);
  });

  it('blocks partial omitted blob metadata even when the export has a blob', () => {
    const item = classifyPublicDeltaGateItem({
      path: 'packages/api/src/example.ts',
      oursBlob: B,
    });

    assert.equal(item.mode, 'delete-or-rename-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.baseBlob, null);
    assert.equal(item.theirsBlob, null);
    assert.equal(item.oursBlob, B);
  });

  it('blocks partial undefined blob metadata even when the export has a blob', () => {
    const item = classify({
      baseBlob: undefined,
      theirsBlob: undefined,
      oursBlob: B,
    });

    assert.equal(item.mode, 'delete-or-rename-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.baseBlob, null);
    assert.equal(item.theirsBlob, null);
    assert.equal(item.oursBlob, B);
  });

  it('normalizes explicit undefined blob fields fail-closed', () => {
    const item = classify({
      baseBlob: undefined,
      theirsBlob: undefined,
      oursBlob: undefined,
    });

    assert.equal(item.mode, 'delete-or-rename-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.baseBlob, null);
    assert.equal(item.theirsBlob, null);
    assert.equal(item.oursBlob, null);
  });

  it('keeps null-combination boundaries explicit', () => {
    const cases = [
      {
        name: 'new source file absent from target',
        input: { baseBlob: null, theirsBlob: null, oursBlob: B },
        mode: 'source-only-pass',
        risk: 'pass',
      },
      {
        name: 'target-added file omitted from export',
        input: { baseBlob: null, theirsBlob: B, oursBlob: null },
        mode: 'target-added-would-delete-block',
        risk: 'block',
      },
      {
        name: 'source deletes existing sync-managed file',
        input: { baseBlob: A, theirsBlob: A, oursBlob: null },
        mode: 'delete-or-rename-block',
        risk: 'block',
      },
      {
        name: 'target deleted existing sync-managed file',
        input: { baseBlob: A, theirsBlob: null, oursBlob: A },
        mode: 'delete-or-rename-block',
        risk: 'block',
      },
      {
        name: 'all null is invalid and fail-closed',
        input: { baseBlob: null, theirsBlob: null, oursBlob: null },
        mode: 'delete-or-rename-block',
        risk: 'block',
      },
    ];

    for (const testCase of cases) {
      const item = classify(testCase.input);
      assert.equal(item.mode, testCase.mode, testCase.name);
      assert.equal(item.risk, testCase.risk, testCase.name);
    }
  });

  it('blocks binary deltas in V1', () => {
    const item = classify({ isBinary: true, theirsBlob: B, oursBlob: C });

    assert.equal(item.mode, 'binary-block');
    assert.equal(item.risk, 'block');
  });

  it('passes generated, provenance, and target-owned paths', () => {
    const provenance = classify({
      path: '.sync-provenance.json',
      theirsBlob: B,
      oursBlob: C,
      isGeneratedOrProvenance: true,
    });
    const targetOwned = classify({
      path: 'docs/public-only.md',
      theirsBlob: B,
      oursBlob: A,
      isTargetOwned: true,
    });

    assert.equal(provenance.mode, 'generated-or-provenance-pass');
    assert.equal(provenance.risk, 'pass');
    assert.equal(targetOwned.mode, 'target-owned-pass');
    assert.equal(targetOwned.risk, 'pass');
  });

  it('blocks generated, provenance, and target-owned paths when blob metadata is missing', () => {
    const provenance = classifyPublicDeltaGateItem({
      path: '.sync-provenance.json',
      isGeneratedOrProvenance: true,
    });
    const targetOwned = classifyPublicDeltaGateItem({
      path: 'docs/public-only.md',
      isTargetOwned: true,
    });

    assert.equal(provenance.mode, 'delete-or-rename-block');
    assert.equal(provenance.risk, 'block');
    assert.equal(targetOwned.mode, 'delete-or-rename-block');
    assert.equal(targetOwned.risk, 'block');
  });

  it('converts blocked items to override-pass only with an explicit reason', () => {
    const item = classify({
      theirsBlob: B,
      oursBlob: A,
      overrideReason: 'CVO accepted dropping public-only experiment',
    });

    assert.equal(item.mode, 'override-pass');
    assert.equal(item.risk, 'override');
    assert.equal(item.overrideReason, 'CVO accepted dropping public-only experiment');
  });

  it('rejects blank override reasons', () => {
    const item = classify({
      theirsBlob: B,
      oursBlob: A,
      overrideReason: '   ',
    });

    assert.equal(item.mode, 'target-only-would-revert-block');
    assert.equal(item.risk, 'block');
    assert.equal(item.overrideReason, undefined);
  });
});

describe('public target delta summary', () => {
  it('counts pass, block, override, revert, conflict, and delete candidates', () => {
    const items = [
      classify({ theirsBlob: A, oursBlob: B }),
      classify({ theirsBlob: B, oursBlob: A }),
      classify({ theirsBlob: B, oursBlob: C }),
      classify({ baseBlob: null, theirsBlob: B, oursBlob: null }),
      classify({ theirsBlob: B, oursBlob: A, overrideReason: 'accepted' }),
    ];

    assert.deepEqual(buildPublicDeltaGateSummary(items), {
      passCount: 1,
      blockCount: 3,
      revertCandidateCount: 1,
      conflictCandidateCount: 1,
      deleteCandidateCount: 1,
      overrideCount: 1,
      cvoApprovalRequired: false,
    });
  });

  it('requires CVO approval when one sync has more than 3 overrides', () => {
    const items = Array.from({ length: 4 }, (_, index) =>
      classify({ theirsBlob: B, oursBlob: A, overrideReason: `override ${index}` }),
    );

    assert.equal(buildPublicDeltaGateSummary(items).cvoApprovalRequired, true);
  });
});

describe('public target delta baseline resolver', () => {
  const fixtures = createFixtureTracker();

  it('resolves the latest landed sync tag instead of provenance target_head_sha', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const targetPreSyncBase = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const landedSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      extraFields: {
        target_head_sha: targetPreSyncBase,
      },
    });
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', landedSyncCommit);
    commitFile(fixture.targetRoot, 'docs/community-note.md', 'community follow-up\n', 'docs: community follow-up');

    const resolved = resolvePublicDeltaGateBaseline({
      targetRepo: fixture.targetRoot,
      headRef: 'HEAD',
      noFetch: true,
    });

    assert.equal(resolved.baselineSource, 'sync-tag');
    assert.equal(resolved.baselineRef, 'sync/2026-03-19-063437');
    assert.equal(resolved.baselineCommit, landedSyncCommit);
    assert.notEqual(resolved.baselineCommit, targetPreSyncBase);
  });

  it('lets an explicit baseline override discovered sync tags when it is reachable', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const targetPreSyncBase = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const landedSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', landedSyncCommit);

    const resolved = resolvePublicDeltaGateBaseline({
      targetRepo: fixture.targetRoot,
      headRef: 'HEAD',
      baseline: targetPreSyncBase,
      noFetch: true,
    });

    assert.equal(resolved.baselineSource, 'explicit');
    assert.equal(resolved.baselineCommit, targetPreSyncBase);
  });

  it('ignores newer sync tags that are not reachable from the target head', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const targetBase = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const firstSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: first landed upstream', {
      commitEnv: {
        GIT_AUTHOR_DATE: '2026-03-19T06:34:37Z',
        GIT_COMMITTER_DATE: '2026-03-19T06:34:37Z',
      },
    });
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', firstSyncCommit);
    const secondSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: second landed upstream', {
      syncedAt: '2026-03-20T06:34:37Z',
      commitEnv: {
        GIT_AUTHOR_DATE: '2026-03-20T06:34:37Z',
        GIT_COMMITTER_DATE: '2026-03-20T06:34:37Z',
      },
    });
    git(fixture.targetRoot, 'tag', 'sync/2026-03-20-063437', secondSyncCommit);

    git(fixture.targetRoot, 'checkout', '-b', 'unreachable-sync-tag', targetBase);
    const unreachableSyncCommit = commitSyncProvenance(
      fixture.targetRoot,
      sourceHead,
      'sync: unreachable landed upstream',
      {
        commitEnv: {
          GIT_AUTHOR_DATE: '2026-03-21T06:34:37Z',
          GIT_COMMITTER_DATE: '2026-03-21T06:34:37Z',
        },
      },
    );
    git(fixture.targetRoot, 'tag', 'sync/2026-03-21-063437', unreachableSyncCommit);
    git(fixture.targetRoot, 'checkout', 'main');

    const resolved = resolvePublicDeltaGateBaseline({
      targetRepo: fixture.targetRoot,
      headRef: 'HEAD',
      noFetch: true,
    });

    assert.equal(resolved.baselineSource, 'sync-tag');
    assert.equal(resolved.baselineRef, 'sync/2026-03-20-063437');
    assert.equal(resolved.baselineCommit, secondSyncCommit);
  });

  it('falls back to the latest first-parent sync provenance commit with source_commit_sha', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const targetPreSyncBase = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const landedSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      extraFields: {
        target_head_sha: targetPreSyncBase,
      },
    });
    commitFile(fixture.targetRoot, 'docs/community-note.md', 'community follow-up\n', 'docs: community follow-up');

    const resolved = resolvePublicDeltaGateBaseline({
      targetRepo: fixture.targetRoot,
      headRef: 'HEAD',
      noFetch: true,
    });

    assert.equal(resolved.baselineSource, 'landed-sync-commit');
    assert.equal(resolved.baselineCommit, landedSyncCommit);
    assert.equal(resolved.sourceCommitSha, sourceHead);
    assert.equal(resolved.provenanceTargetHeadSha, targetPreSyncBase);
    assert.notEqual(resolved.baselineCommit, targetPreSyncBase);
  });

  it('fails closed when the latest sync provenance commit lacks source_commit_sha', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    commitFile(
      fixture.targetRoot,
      '.sync-provenance.json',
      `${JSON.stringify({ target_head_sha: git(fixture.targetRoot, 'rev-parse', 'HEAD') }, null, 2)}\n`,
      'sync: invalid provenance',
    );

    assert.throws(
      () =>
        resolvePublicDeltaGateBaseline({
          targetRepo: fixture.targetRoot,
          headRef: 'HEAD',
          noFetch: true,
        }),
      /missing source_commit_sha/i,
    );
  });

  it('fetches origin main and remote sync tags by default before resolving the baseline', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const staleTargetRoot = join(fixture.sandboxRoot, 'clowder-ai-stale');
    git(fixture.sandboxRoot, 'clone', '--branch', 'main', fixture.targetOrigin, staleTargetRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const landedSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', landedSyncCommit);
    git(fixture.targetRoot, 'push', 'origin', 'main');
    git(fixture.targetRoot, 'push', 'origin', 'refs/tags/sync/2026-03-19-063437');

    const resolved = resolvePublicDeltaGateBaseline({ targetRepo: staleTargetRoot });

    assert.equal(resolved.targetHeadRef, 'refs/remotes/origin/main');
    assert.equal(resolved.baselineSource, 'sync-tag');
    assert.equal(resolved.baselineCommit, landedSyncCommit);
  });

  it('ignores local-only stale sync tags that are absent from origin', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const landedSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      commitEnv: {
        GIT_AUTHOR_DATE: '2026-03-19T06:34:37Z',
        GIT_COMMITTER_DATE: '2026-03-19T06:34:37Z',
      },
    });
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', landedSyncCommit);
    const targetHead = commitFile(
      fixture.targetRoot,
      'docs/community-note.md',
      'community follow-up\n',
      'docs: community',
    );
    git(fixture.targetRoot, 'push', 'origin', 'main');
    git(fixture.targetRoot, 'push', 'origin', 'refs/tags/sync/2026-03-19-063437');

    const staleTargetRoot = join(fixture.sandboxRoot, 'clowder-ai-stale-local-tag');
    git(fixture.sandboxRoot, 'clone', '--branch', 'main', fixture.targetOrigin, staleTargetRoot);
    git(staleTargetRoot, 'tag', 'sync/2026-03-20-063437', targetHead);

    const resolved = resolvePublicDeltaGateBaseline({ targetRepo: staleTargetRoot });

    assert.equal(resolved.targetHeadRef, 'refs/remotes/origin/main');
    assert.equal(resolved.baselineSource, 'sync-tag');
    assert.equal(resolved.baselineRef, 'sync/2026-03-19-063437');
    assert.equal(resolved.baselineCommit, landedSyncCommit);
    assert.notEqual(resolved.baselineCommit, targetHead);
  });

  it('deepens shallow target clones before resolving the sync tag baseline', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    const landedSyncCommit = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      commitEnv: {
        GIT_AUTHOR_DATE: '2026-03-19T06:34:37Z',
        GIT_COMMITTER_DATE: '2026-03-19T06:34:37Z',
      },
    });
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', landedSyncCommit);
    const targetHead = commitFile(
      fixture.targetRoot,
      'docs/community-note.md',
      'community follow-up\n',
      'docs: community',
    );
    git(fixture.targetRoot, 'push', 'origin', 'main');
    git(fixture.targetRoot, 'push', 'origin', 'refs/tags/sync/2026-03-19-063437');

    const shallowTargetRoot = join(fixture.sandboxRoot, 'clowder-ai-shallow');
    git(
      fixture.sandboxRoot,
      'clone',
      '--depth',
      '1',
      '--branch',
      'main',
      `file://${fixture.targetOrigin}`,
      shallowTargetRoot,
    );
    assert.equal(git(shallowTargetRoot, 'rev-parse', '--is-shallow-repository'), 'true');

    const resolved = resolvePublicDeltaGateBaseline({ targetRepo: shallowTargetRoot });

    assert.equal(git(shallowTargetRoot, 'rev-parse', '--is-shallow-repository'), 'false');
    assert.equal(resolved.targetHeadRef, 'refs/remotes/origin/main');
    assert.equal(resolved.baselineSource, 'sync-tag');
    assert.equal(resolved.baselineRef, 'sync/2026-03-19-063437');
    assert.equal(resolved.baselineCommit, landedSyncCommit);
    assert.notEqual(resolved.baselineCommit, targetHead);
  });

  it('fails closed when no sync tag or sync provenance baseline exists', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    assert.throws(
      () =>
        resolvePublicDeltaGateBaseline({
          targetRepo: fixture.targetRoot,
          headRef: 'HEAD',
          noFetch: true,
        }),
      /could not resolve public delta baseline/i,
    );
  });
});
