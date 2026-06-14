import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { getLockedBiomeVersion, verifyBiomeVersion } from './check-biome-version.mjs';

const tempDirs = [];

function makeFixture({ lockfileVersion = '2.4.1', installedVersion } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-biome-version-'));
  tempDirs.push(dir);

  writeFileSync(
    path.join(dir, 'pnpm-lock.yaml'),
    `lockfileVersion: '9.0'\npackages:\n\n  '@biomejs/biome@${lockfileVersion}':\n    resolution: {integrity: sha512-test}\n`,
    'utf8',
  );

  const installedPackagePath = path.join(dir, 'node_modules', '@biomejs', 'biome');
  mkdirSync(installedPackagePath, { recursive: true });
  if (installedVersion !== null) {
    writeFileSync(
      path.join(installedPackagePath, 'package.json'),
      JSON.stringify({ version: installedVersion }),
      'utf8',
    );
  }

  return {
    dir,
    lockfilePath: path.join(dir, 'pnpm-lock.yaml'),
    installedPackagePath: path.join(installedPackagePath, 'package.json'),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('check-biome-version lockfile parsing', () => {
  it('extracts the exact locked Biome version from pnpm-lock.yaml', () => {
    const fixture = makeFixture({ lockfileVersion: '2.4.1', installedVersion: '2.4.1' });
    assert.equal(getLockedBiomeVersion(fixture.lockfilePath), '2.4.1');
  });
});

describe('check-biome-version verification', () => {
  it('passes when installed Biome matches the lockfile version', () => {
    const fixture = makeFixture({ lockfileVersion: '2.4.1', installedVersion: '2.4.1' });
    const result = verifyBiomeVersion({
      lockfilePath: fixture.lockfilePath,
      installedPackagePath: fixture.installedPackagePath,
    });

    assert.equal(result.ok, true);
    assert.equal(result.lockedVersion, '2.4.1');
    assert.equal(result.installedVersion, '2.4.1');
  });

  it('fails closed when installed Biome differs from the lockfile version', () => {
    const fixture = makeFixture({ lockfileVersion: '2.4.1', installedVersion: '2.1.0' });
    const result = verifyBiomeVersion({
      lockfilePath: fixture.lockfilePath,
      installedPackagePath: fixture.installedPackagePath,
    });

    assert.equal(result.ok, false);
    assert.match(result.message, /expected 2\.4\.1/i);
    assert.match(result.message, /found 2\.1\.0/i);
  });

  it('fails closed when the local Biome package is missing', () => {
    const fixture = makeFixture({ lockfileVersion: '2.4.1', installedVersion: null });
    const result = verifyBiomeVersion({
      lockfilePath: fixture.lockfilePath,
      installedPackagePath: fixture.installedPackagePath,
    });

    assert.equal(result.ok, false);
    assert.match(result.message, /not installed/i);
  });
});
