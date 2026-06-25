import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPublicDeltaGateSummary, classifyPublicDeltaGateItem } from './check-sync-public-delta-gate.mjs';

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
