import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import {
  captureReleasePublishFailure,
  commitFile,
  commitSyncProvenance,
  createFixtureTracker,
  git,
  gitBare,
  makeFixture,
  runReleasePublish,
} from './publish-sync-tag-test-helpers.mjs';

function writeReconciliationReport(sourceRoot, releaseTag, issueRows = []) {
  const relativePath = `docs/ops/reconciliation-${releaseTag}.md`;
  const reportPath = join(sourceRoot, relativePath);
  const issueSection =
    issueRows.length === 0
      ? 'No issue closures in this release.\n'
      : ['| Issue | Title | Verdict | Reason |', '|-------|-------|---------|--------|', ...issueRows].join('\n');

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(
    reportPath,
    `# Community Reconciliation: ${releaseTag}

## Community Issue Review

${issueSection}

## Actions Taken

- Reconciliation completed for ${releaseTag}
`,
    'utf-8',
  );

  return relativePath;
}

describe('publish-release-tag.sh guards release provenance', () => {
  const fixtures = createFixtureTracker();

  it('publishes the target release tag only when provenance and source snapshot align', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const releaseTag = 'v0.3.0';
    const sourceSnapshotTag = 'clowder-v0.3.0-source';
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    git(
      fixture.sourceRoot,
      'tag',
      '-a',
      sourceSnapshotTag,
      sourceHead,
      '-m',
      `source snapshot for clowder-ai ${releaseTag}`,
    );
    git(fixture.sourceRoot, 'push', 'origin', sourceSnapshotTag);

    const landedSyncHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      extraFields: {
        release_tag: releaseTag,
        source_snapshot_tag: sourceSnapshotTag,
      },
    });
    const releaseHead = commitFile(fixture.targetRoot, 'README.md', 'release follow-up\n', 'docs: release note prep');
    git(fixture.targetRoot, 'push', 'origin', 'main');
    const reconciliationReport = writeReconciliationReport(fixture.sourceRoot, releaseTag, [
      '| **#438** | **Seed cat drift** | **closed** | Fixed by sync payload |',
    ]);
    const previousIssueStates = process.env.RECONCILIATION_ISSUE_STATES_JSON;
    process.env.RECONCILIATION_ISSUE_STATES_JSON = JSON.stringify({ 438: 'CLOSED' });

    try {
      runReleasePublish(
        fixture.sourceRoot,
        fixture.targetRoot,
        `--release-tag=${releaseTag}`,
        `--target-sha=${releaseHead}`,
        `--reconciliation-report=${reconciliationReport}`,
        '--push',
      );
    } finally {
      if (previousIssueStates === undefined) {
        delete process.env.RECONCILIATION_ISSUE_STATES_JSON;
      } else {
        process.env.RECONCILIATION_ISSUE_STATES_JSON = previousIssueStates;
      }
    }

    assert.equal(git(fixture.targetRoot, 'rev-parse', `refs/tags/${releaseTag}^{commit}`), releaseHead);
    assert.equal(gitBare(fixture.targetOrigin, 'rev-parse', `refs/tags/${releaseTag}^{commit}`), releaseHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', landedSyncHead), landedSyncHead);
  });

  it('rejects release publication when the source snapshot tag is missing from cat-cafe', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const releaseTag = 'v0.3.0';
    const sourceSnapshotTag = 'clowder-v0.3.0-source';
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');

    const releaseHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      extraFields: {
        release_tag: releaseTag,
        source_snapshot_tag: sourceSnapshotTag,
      },
    });
    git(fixture.targetRoot, 'push', 'origin', 'main');
    const reconciliationReport = writeReconciliationReport(fixture.sourceRoot, releaseTag);

    const error = captureReleasePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--release-tag=${releaseTag}`,
      `--target-sha=${releaseHead}`,
      `--reconciliation-report=${reconciliationReport}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /source snapshot tag .* not found/i);
  });

  it('rejects release publication when provenance release_tag does not match the requested tag', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    git(
      fixture.sourceRoot,
      'tag',
      '-a',
      'clowder-v0.3.0-source',
      sourceHead,
      '-m',
      'source snapshot for clowder-ai v0.3.0',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'clowder-v0.3.0-source');

    const releaseHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      extraFields: {
        release_tag: 'v0.3.1',
        source_snapshot_tag: 'clowder-v0.3.1-source',
      },
    });
    git(fixture.targetRoot, 'push', 'origin', 'main');
    const reconciliationReport = writeReconciliationReport(fixture.sourceRoot, 'v0.3.0');

    const error = captureReleasePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--release-tag=v0.3.0',
      `--target-sha=${releaseHead}`,
      `--reconciliation-report=${reconciliationReport}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /records release_tag v0\.3\.1, not v0\.3\.0/i);
  });

  it('rejects release publication when reconciliation report marks an issue closed but GitHub still shows it open', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const releaseTag = 'v0.3.0';
    const sourceSnapshotTag = 'clowder-v0.3.0-source';
    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    git(
      fixture.sourceRoot,
      'tag',
      '-a',
      sourceSnapshotTag,
      sourceHead,
      '-m',
      `source snapshot for clowder-ai ${releaseTag}`,
    );
    git(fixture.sourceRoot, 'push', 'origin', sourceSnapshotTag);

    const releaseHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      extraFields: {
        release_tag: releaseTag,
        source_snapshot_tag: sourceSnapshotTag,
      },
    });
    git(fixture.targetRoot, 'push', 'origin', 'main');
    const reconciliationReport = writeReconciliationReport(fixture.sourceRoot, releaseTag, [
      '| **#438** | **Seed cat drift** | **closed** | Fixed by sync payload |',
    ]);
    const previousIssueStates = process.env.RECONCILIATION_ISSUE_STATES_JSON;
    process.env.RECONCILIATION_ISSUE_STATES_JSON = JSON.stringify({ 438: 'OPEN' });

    try {
      const error = captureReleasePublishFailure(
        fixture.sourceRoot,
        fixture.targetRoot,
        `--release-tag=${releaseTag}`,
        `--target-sha=${releaseHead}`,
        `--reconciliation-report=${reconciliationReport}`,
      );

      assert.match(
        `${String(error.stdout)}${String(error.stderr)}`,
        /marks issue\(s\) closed but GitHub still shows them open/i,
      );
    } finally {
      if (previousIssueStates === undefined) {
        delete process.env.RECONCILIATION_ISSUE_STATES_JSON;
      } else {
        process.env.RECONCILIATION_ISSUE_STATES_JSON = previousIssueStates;
      }
    }
  });
});
