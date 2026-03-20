import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  commitFile,
  commitSyncProvenance,
  createFixtureTracker,
  git,
  gitBare,
  makeFixture,
  run,
  runPublish,
} from './publish-sync-tag-test-helpers.mjs';

describe('publish-sync-tag.sh basic flows', () => {
  const fixtures = createFixtureTracker();

  it('publishes the same sync tag to cat-cafe and clowder-ai after merge', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    runPublish(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
      '--push',
    );

    assert.equal(git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
    assert.equal(gitBare(fixture.sourceOrigin, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(gitBare(fixture.targetOrigin, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
  });

  it('accepts git worktree checkouts for the target repo', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const targetWorktree = join(fixture.sandboxRoot, 'clowder-ai-worktree');
    git(fixture.targetRoot, 'worktree', 'add', '--detach', targetWorktree, targetHead);

    runPublish(
      fixture.sourceRoot,
      targetWorktree,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
  });

  it('resolves landed target SHAs after fetching origin main', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const staleTargetRoot = join(fixture.sandboxRoot, 'clowder-ai-stale');
    git(fixture.sandboxRoot, 'clone', '--branch', 'main', fixture.targetOrigin, staleTargetRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    runPublish(
      fixture.sourceRoot,
      staleTargetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.equal(git(staleTargetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
  });

  it('accepts landed sync merge commits on clowder-ai main', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');

    git(fixture.targetRoot, 'checkout', '-b', 'sync/pr-branch');
    commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: branch payload');
    git(fixture.targetRoot, 'checkout', 'main');
    git(fixture.targetRoot, 'merge', '--no-ff', 'sync/pr-branch', '-m', 'chore(sync): merge landed sync');
    const mergeTargetHead = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    runPublish(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${mergeTargetHead}`,
    );

    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), mergeTargetHead);
  });

  it('resolves source SHAs after fetching cat-cafe origin main', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const staleSourceRoot = join(fixture.sandboxRoot, 'cat-cafe-stale');
    git(fixture.sandboxRoot, 'clone', '--branch', 'main', fixture.sourceOrigin, staleSourceRoot);
    mkdirSync(join(staleSourceRoot, 'scripts'), { recursive: true });
    cpSync(
      join(fixture.sourceRoot, 'scripts/publish-sync-tag.sh'),
      join(staleSourceRoot, 'scripts/publish-sync-tag.sh'),
    );
    chmodSync(join(staleSourceRoot, 'scripts/publish-sync-tag.sh'), 0o755);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    runPublish(
      staleSourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.equal(git(staleSourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
  });

  it('derives the default sync tag from the landed target commit time in UTC', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream', {
      syncedAt: '2026-03-19T00:00:00Z',
      commitEnv: {
        GIT_AUTHOR_DATE: '2026-03-19T10:30:45+08:00',
        GIT_COMMITTER_DATE: '2026-03-19T10:30:45+08:00',
      },
    });
    git(fixture.targetRoot, 'push', 'origin', 'main');

    run(
      'bash',
      ['scripts/publish-sync-tag.sh', `--source-sha=${sourceHead}`, `--target-sha=${targetHead}`],
      fixture.sourceRoot,
      {
        CLOWDER_AI_DIR: fixture.targetRoot,
        TZ: 'America/Los_Angeles',
      },
    );

    assert.equal(git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-023045^{commit}'), sourceHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-023045^{commit}'), targetHead);
  });

  it('auto-detects the latest landed target sync commit when --target-sha is omitted', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const landedTargetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    commitFile(fixture.targetRoot, 'README.md', 'docs after sync\n', 'docs: follow-up');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    runPublish(fixture.sourceRoot, fixture.targetRoot, '--tag=sync/2026-03-19-063437', `--source-sha=${sourceHead}`);

    assert.equal(git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), landedTargetHead);
  });
});
