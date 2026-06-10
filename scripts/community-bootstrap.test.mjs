#!/usr/bin/env node
/**
 * community-bootstrap CLI — argument parsing tests (F168 Phase A — Task 5)
 *
 * These tests cover the CLI's argument parsing logic without touching Redis.
 * The underlying communityBootstrap() module is covered separately in
 * packages/api/test/redis-community-bootstrap.test.js.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from './community-bootstrap.mjs';

describe('community-bootstrap CLI parseArgs', () => {
  it('defaults to dry-run when no flags given', () => {
    const { dryRun } = parseArgs([]);
    assert.strictEqual(dryRun, true, 'no flags → dryRun should be true');
  });

  it('--dry-run flag → dry-run mode', () => {
    const { dryRun } = parseArgs(['--dry-run']);
    assert.strictEqual(dryRun, true);
  });

  it('--execute flag → live run mode (dryRun=false)', () => {
    const { dryRun } = parseArgs(['--execute']);
    assert.strictEqual(dryRun, false, '--execute must set dryRun=false');
  });

  it('unknown flags are ignored; default dry-run preserved', () => {
    const { dryRun } = parseArgs(['--verbose', '--no-color']);
    assert.strictEqual(dryRun, true);
  });

  it('--execute combined with other flags → live run mode', () => {
    const { dryRun } = parseArgs(['--verbose', '--execute', '--no-color']);
    assert.strictEqual(dryRun, false);
  });
});
