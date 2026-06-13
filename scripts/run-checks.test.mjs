import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { parseConcurrency } from './run-checks.mjs';

const SCRIPT = path.resolve(process.cwd(), 'scripts/run-checks.mjs');

function run(env = {}) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 5000,
  });
}

describe('run-checks concurrency validation (gate bypass prevention)', () => {
  // Rejection tests: script exits before running any checks, safe to spawn.
  it('rejects CAT_CAFE_CHECK_CONCURRENCY=0 as gate bypass', () => {
    const result = run({ CAT_CAFE_CHECK_CONCURRENCY: '0' });
    assert.notEqual(result.status, 0, 'concurrency=0 must not exit 0 (would skip all checks)');
    assert.match(result.stderr, /gate bypass/i);
  });

  it('rejects non-numeric concurrency values', () => {
    const result = run({ CAT_CAFE_CHECK_CONCURRENCY: 'abc' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /positive integer/i);
  });

  it('rejects negative concurrency', () => {
    const result = run({ CAT_CAFE_CHECK_CONCURRENCY: '-3' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /positive integer/i);
  });

  // Happy-path tests: import parseConcurrency directly to avoid spawning
  // the full runner (which would recursively execute all checks).
  it('defaults to 4 for undefined concurrency', () => {
    assert.equal(parseConcurrency(undefined), 4);
  });

  it('defaults to 4 for empty string concurrency', () => {
    assert.equal(parseConcurrency(''), 4);
  });

  it('clamps concurrency to [1, check_count]', () => {
    assert.equal(parseConcurrency('1'), 1);
    assert.equal(parseConcurrency('100'), 21); // max = PARALLEL_CHECKS.length
  });

  it('rounds fractional concurrency', () => {
    assert.equal(parseConcurrency('2.7'), 3);
  });
});

describe('run-checks Biome scope policy', () => {
  it('excludes generated video production assets from the Biome fast-fail gate', () => {
    const biomeConfig = JSON.parse(readFileSync(path.resolve(process.cwd(), 'biome.json'), 'utf8'));
    assert.ok(
      biomeConfig.files?.includes?.includes('!docs/videos/**'),
      'docs/videos/** must stay excluded from Biome; video production assets are not product code',
    );
  });
});
