import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  capturePublishFailure,
  commitFile,
  commitSyncProvenance,
  createFixtureTracker,
  git,
  gitBare,
  makeFixture,
  runPublish,
} from './publish-sync-tag-test-helpers.mjs';

describe('publish-sync-tag.sh rollback and remote tag handling', () => {
  const fixtures = createFixtureTracker();

  it('does not leave cat-cafe origin ahead when clowder-ai origin already has a conflicting tag', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');

    const targetBaseHead = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');
    gitBare(fixture.targetOrigin, 'tag', 'sync/2026-03-19-063437', targetBaseHead);

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
      '--push',
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /origin clowder-ai tag .* already points/i);
    assert.throws(
      () => git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
    assert.throws(
      () => git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
    assert.throws(
      () => gitBare(fixture.sourceOrigin, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
  });

  it('rolls back local tags when the source push fails first', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    writeFileSync(
      join(fixture.sourceOrigin, 'hooks/pre-receive'),
      '#!/usr/bin/env bash\nwhile read -r _old _new ref; do\n  case "$ref" in\n    refs/tags/sync/*) echo "reject sync tag" >&2; exit 1 ;;\n  esac\ndone\nexit 0\n',
      { mode: 0o755 },
    );

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
      '--push',
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /reject sync tag/i);
    assert.throws(
      () => git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
    assert.throws(
      () => git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
  });

  it('rolls back the source tag when target tag creation fails locally', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetBaseHead = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', targetBaseHead);

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
      '--push',
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /clowder-ai tag .* already points to/i);
    assert.throws(
      () => git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetBaseHead);
  });

  it('rolls back the source tag on local-only target conflicts', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetBaseHead = git(fixture.targetRoot, 'rev-parse', 'HEAD');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');
    git(fixture.targetRoot, 'tag', 'sync/2026-03-19-063437', targetBaseHead);

    const error = capturePublishFailure(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
    );

    assert.match(`${String(error.stdout)}${String(error.stderr)}`, /clowder-ai tag .* already points to/i);
    assert.throws(
      () => git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'),
      /unknown revision|Needed a single revision/,
    );
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetBaseHead);
  });

  it('accepts matching annotated remote tags', () => {
    const fixture = makeFixture();
    fixtures.push(fixture.sandboxRoot);

    const sourceHead = commitFile(fixture.sourceRoot, 'feature.txt', 'source sync payload\n', 'feat: source sync');
    git(fixture.sourceRoot, 'push', 'origin', 'main');
    const targetHead = commitSyncProvenance(fixture.targetRoot, sourceHead, 'sync: landed upstream');
    git(fixture.targetRoot, 'push', 'origin', 'main');

    git(fixture.sourceRoot, 'tag', '-a', 'sync/2026-03-19-063437', '-m', 'existing sync tag', sourceHead);
    git(fixture.targetRoot, 'tag', '-a', 'sync/2026-03-19-063437', '-m', 'existing sync tag', targetHead);
    git(fixture.sourceRoot, 'push', 'origin', 'refs/tags/sync/2026-03-19-063437');
    git(fixture.targetRoot, 'push', 'origin', 'refs/tags/sync/2026-03-19-063437');
    git(fixture.sourceRoot, 'tag', '-d', 'sync/2026-03-19-063437');
    git(fixture.targetRoot, 'tag', '-d', 'sync/2026-03-19-063437');

    runPublish(
      fixture.sourceRoot,
      fixture.targetRoot,
      '--tag=sync/2026-03-19-063437',
      `--source-sha=${sourceHead}`,
      `--target-sha=${targetHead}`,
      '--push',
    );

    assert.equal(gitBare(fixture.sourceOrigin, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(gitBare(fixture.targetOrigin, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
    assert.equal(git(fixture.sourceRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), sourceHead);
    assert.equal(git(fixture.targetRoot, 'rev-parse', 'refs/tags/sync/2026-03-19-063437^{commit}'), targetHead);
  });
});
