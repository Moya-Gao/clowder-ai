import assert from 'node:assert/strict';
import { chmodSync, cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  commitFile,
  commitSyncProvenance,
  createFixtureTracker,
  git,
  makeFixture,
  runPublish,
} from './publish-sync-tag-test-helpers.mjs';

describe('publish-sync-tag.sh shallow clone handling', () => {
  const fixtures = createFixtureTracker();

  it('deepens shallow clones before resolving sync SHAs', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    commitFile(fixture.sourceRoot, 'later.txt', 'later source change\n', 'chore: source main moved on');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    commitFile(fixture.targetRoot, 'README.md', 'target base\nlater docs update\n', 'docs: target main moved on');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    const shallowSourceRoot = join(fixture.sandboxRoot, 'cat-cafe-shallow');
    const shallowTargetRoot = join(fixture.sandboxRoot, 'clowder-ai-shallow');
    git(
      fixture.sandboxRoot,
      'clone',
      '--depth',
      '1',
      '--branch',
      'main',
      `file://${fixture.sourceOrigin}`,
      shallowSourceRoot,
    );
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
    mkdirSync(join(shallowSourceRoot, 'scripts'), { recursive: true });
    cpSync(
      join(fixture.sourceRoot, 'scripts/publish-sync-tag.sh'),
      join(shallowSourceRoot, 'scripts/publish-sync-tag.sh'),
    );
    chmodSync(join(shallowSourceRoot, 'scripts/publish-sync-tag.sh'), 0o755);

    assert.equal(git(shallowSourceRoot, 'rev-parse', '--is-shallow-repository'), 'true');
    assert.equal(git(shallowTargetRoot, 'rev-parse', '--is-shallow-repository'), 'true');

    runPublish(
      shallowSourceRoot,
      shallowTargetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.equal(git(shallowSourceRoot, 'rev-parse', '--is-shallow-repository'), 'false');
    assert.equal(git(shallowTargetRoot, 'rev-parse', '--is-shallow-repository'), 'false');
    assert.equal(git(shallowSourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(git(shallowTargetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
  });
});
