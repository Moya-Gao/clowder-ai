import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  capturePublishFailure,
  commitFile,
  commitSyncProvenance,
  createFixtureTracker,
  git,
  makeFixture,
  runPublish,
} from './publish-sync-tag-test-helpers.mjs';

describe('publish-sync-tag.sh validation gates', () => {
  const fixtures = createFixtureTracker();

  it('refuses to retarget an existing sync tag to a different source commit', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const initialTag = 'sync/2026-03-19-063437';
    runPublish(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--tag=${initialTag}`,
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    const newerSourceHead = commitFile(
      fixture.sourceRoot,
      'feature-2.txt',
      'later source payload\n',
      'feat: later source sync',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const newerTargetHead = commitSyncProvenance(fixture.targetRoot, newerSourceHead, 'sync: later landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--tag=${initialTag}`,
      `--source-sha=${newerSourceHead}`,
      `--target-sha=${newerTargetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /already points to/i);
    assert.equal(git(fixture.sourceRoot, 'rev-parse', `refs/tags/${initialTag}^{commit}`), sourceHead);
  });

  it('rejects target SHAs that are not already on clowder-ai main', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');

    git(fixture.targetRoot, 'checkout', '-b', 'sync/pr-branch');
    const unmergedTargetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: pending upstream');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${unmergedTargetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /not reachable from .*main/i);
  });

  it('rejects source SHAs that do not match target sync provenance', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const syncedSourceHead = commitFile(
      fixture.sourceRoot,
      'feature.txt',
      'source sync payload\n',
      'feat: source sync',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, syncedSourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const newerSourceHead = commitFile(
      fixture.sourceRoot,
      'feature-2.txt',
      'later source payload\n',
      'feat: later source sync',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${newerSourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /sync provenance/i);
  });

  it('rejects malformed custom sync tag names', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/z',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /sync tag must match sync\/YYYY-MM-DD-HHMMSS/i);
  });

  it('rejects target SHAs that are descendants of the landed sync commit', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const landedSyncHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    const descendantHead = commitFile(fixture.targetRoot, 'README.md', 'docs follow-up\n', 'docs: follow-up');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--source-sha=${sourceHead}`,
      `--target-sha=${descendantHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /provenance-bearing landed sync commit/i);
    assert.equal(git(fixture.targetRoot, 'rev-parse', landedSyncHead), landedSyncHead);
  });

  it('rejects descendant sync commits that do not update provenance', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const landedSyncHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    const descendantSyncHead = commitFile(fixture.targetRoot, 'README.md', 'sync docs cleanup\n', 'sync: docs cleanup');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--source-sha=${sourceHead}`,
      `--target-sha=${descendantSyncHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /latest provenance-bearing landed sync commit/i);
    assert.equal(git(fixture.targetRoot, 'rev-parse', landedSyncHead), landedSyncHead);
  });

  it('rejects older landed sync commits after a newer sync has already landed', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead1 = commitFile(
      fixture.sourceRoot,
      'feature-1.txt',
      'source sync payload 1\n',
      'feat: source sync 1',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead1 = commitSyncProvenance(fixture.targetRoot, sourceHead1, 'sync: landed upstream 1');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const sourceHead2 = commitFile(
      fixture.sourceRoot,
      'feature-2.txt',
      'source sync payload 2\n',
      'feat: source sync 2',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    commitSyncProvenance(fixture.targetRoot, sourceHead2, 'sync: landed upstream 2');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead1}`,
      `--target-sha=${targetHead1}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /latest provenance-bearing landed sync commit/i);
  });

  it('rejects source SHAs that are not reachable from cat-cafe main', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    git(fixture.sourceRoot, 'checkout', '-b', 'feature/sync-preview');
    const sourceHead = commitFile(
      fixture.sourceRoot,
      'feature.txt',
      'preview source payload\n',
      'feat: preview source sync',
    );
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'chore(sync): landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /cat-cafe commit .* not reachable from .*main/i);
  });

  it('rejects target SHAs when origin/main is unavailable and only local main has the commit', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const localOnlyTargetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: local-only target');

    git(fixture.targetRoot, 'update-ref', '-d', 'refs/remotes/origin/main');
    git(fixture.targetRoot, 'remote', 'set-url', 'origin', join(fixture.sandboxRoot, 'missing-target-origin.git'));

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      `--source-sha=${sourceHead}`,
      `--target-sha=${localOnlyTargetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /failed to refresh clowder-ai origin\/main/i);
  });

  it('rejects stale local tracking refs when origin main cannot be refreshed', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const staleSourceRoot = join(fixture.sandboxRoot, 'cat-cafe-stale-blocked');
    const staleTargetRoot = join(fixture.sandboxRoot, 'clowder-ai-stale-blocked');

    const sourceHead1 = commitFile(
      fixture.sourceRoot,
      'feature-1.txt',
      'source sync payload 1\n',
      'feat: source sync 1',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead1 = commitSyncProvenance(fixture.targetRoot, sourceHead1, 'sync: landed upstream 1');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    git(fixture.sandboxRoot, 'clone', '--branch', 'main', fixture.sourceOrigin, staleSourceRoot);
    git(fixture.sandboxRoot, 'clone', '--branch', 'main', fixture.targetOrigin, staleTargetRoot);
    mkdirSync(join(staleSourceRoot, 'scripts'), { recursive: true });
    cpSync(
      join(fixture.sourceRoot, 'scripts/publish-sync-tag.sh'),
      join(staleSourceRoot, 'scripts/publish-sync-tag.sh'),
    );
    chmodSync(join(staleSourceRoot, 'scripts/publish-sync-tag.sh'), 0o755);

    const sourceHead2 = commitFile(
      fixture.sourceRoot,
      'feature-2.txt',
      'source sync payload 2\n',
      'feat: source sync 2',
    );
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    commitSyncProvenance(fixture.targetRoot, sourceHead2, 'sync: landed upstream 2');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    git(staleSourceRoot, 'remote', 'set-url', 'origin', join(fixture.sandboxRoot, 'missing-source-origin.git'));
    git(staleTargetRoot, 'remote', 'set-url', 'origin', join(fixture.sandboxRoot, 'missing-target-origin.git'));

    const error = capturePublishFailure(
      staleSourceRoot,
      staleTargetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead1}`,
      `--target-sha=${targetHead1}`,
    );

    assert.match(
      `${String(error.stdout)}${String(error.stderr)}`,
      /failed to refresh (cat-cafe|clowder-ai) origin\/main/i,
    );
  });
});
