import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

type PptForgePackageJson = {
  bin?: Record<string, string>;
};

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as PptForgePackageJson;

describe('package bin contract', () => {
  it('exposes a source-tree CLI entry so fresh installs do not warn', () => {
    const binTarget = pkg.bin?.['ppt-forge'];

    assert.ok(binTarget, 'package.json must define bin.ppt-forge');

    const repoRelativePath = join('packages', 'ppt-forge', binTarget);
    const onDiskPath = join(repoRoot, repoRelativePath);

    assert.ok(
      existsSync(onDiskPath),
      `ppt-forge bin target must exist in the source tree before prepare runs: ${repoRelativePath}`,
    );

    const ignored = spawnSync('git', ['check-ignore', repoRelativePath], { cwd: repoRoot, stdio: 'pipe' });
    assert.notEqual(
      ignored.status,
      0,
      `ppt-forge bin target must not rely on ignored build output: ${repoRelativePath}`,
    );
  });
});
