import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CI_GATE_COVERAGE,
  checkParity,
  loadCiJobNames,
  loadGateSources,
  parseCiJobNames,
} from './check-gate-ci-parity.mjs';

describe('parseCiJobNames', () => {
  it('extracts job display names, excluding the workflow-level name', () => {
    const yaml = [
      'name: CI',
      'on: push',
      'jobs:',
      '  lint:',
      '    name: Lint',
      '    runs-on: self-hosted',
      '  typecheck:',
      '    name: Typecheck',
      '    runs-on: self-hosted',
    ].join('\n');
    assert.deepEqual(parseCiJobNames(yaml), ['Lint', 'Typecheck']);
  });

  it('returns empty array when there are no job-level name fields', () => {
    assert.deepEqual(parseCiJobNames('name: CI\non: push\n'), []);
  });
});

describe('checkParity', () => {
  // A gate that satisfies every coverage contract.
  const fullGate = {
    preMergeText: 'pnpm check\npnpm -r --if-present run build\nenv -u REDIS_URL pnpm test\ntsc --noEmit',
    parallelChecks: ['check:dir-size', 'check:features'],
  };

  it('passes when every CI job has a satisfied gate-coverage contract', () => {
    const jobs = ['Lint', 'Build', 'Test (Public)', 'Directory Size Guard', 'Typecheck'];
    const { ok, violations } = checkParity(jobs, fullGate);
    assert.equal(ok, true, JSON.stringify(violations));
  });

  it('flags a CI job that has no gate-coverage declaration (the drift guard)', () => {
    const { ok, violations } = checkParity(['Lint', 'E2E Smoke'], fullGate);
    assert.equal(ok, false);
    assert.ok(
      violations.some((v) => v.type === 'undeclared' && v.job === 'E2E Smoke'),
      'expected an undeclared violation for "E2E Smoke"',
    );
  });

  it('flags when a declared gate coverage is no longer present in the gate', () => {
    const gateWithoutTsc = { preMergeText: 'pnpm check', parallelChecks: [] };
    const { ok, violations } = checkParity(['Typecheck'], gateWithoutTsc);
    assert.equal(ok, false);
    assert.ok(
      violations.some((v) => v.type === 'gate-missing' && v.job === 'Typecheck'),
      'expected a gate-missing violation for "Typecheck"',
    );
  });

  it('only verifies contracts for jobs the ci.yml actually declares', () => {
    // dir-size not in ci.yml here → its contract must not be force-verified.
    const gateNoDirSize = { preMergeText: 'pnpm check\ntsc --noEmit', parallelChecks: [] };
    const { ok } = checkParity(['Lint', 'Typecheck'], gateNoDirSize);
    assert.equal(ok, true);
  });
});

describe('loadGateSources (integration with real repo gate files)', () => {
  it('loads non-empty pre-merge text and the real PARALLEL_CHECKS', () => {
    const g = loadGateSources();
    assert.ok(g.preMergeText.length > 0, 'preMergeText should be non-empty');
    assert.ok(Array.isArray(g.parallelChecks) && g.parallelChecks.length > 0);
    assert.ok(
      g.parallelChecks.includes('check:dir-size'),
      'real run-checks PARALLEL_CHECKS should contain check:dir-size',
    );
    assert.ok(
      g.parallelChecks.includes('check:gate-ci-parity'),
      'this very check must be self-bootstrapped into PARALLEL_CHECKS',
    );
  });
});

describe('self-test: the real repo ci.yml is fully gate-covered', () => {
  it('every job in the real ci.yml satisfies its gate-coverage contract', () => {
    const jobs = loadCiJobNames();
    const gate = loadGateSources();
    const { ok, violations } = checkParity(jobs, gate);
    assert.equal(ok, true, `parity violations: ${JSON.stringify(violations, null, 2)}`);
  });

  it('CI_GATE_COVERAGE has no stale entries (every contract maps to a real ci.yml job)', () => {
    const realJobs = loadCiJobNames();
    for (const [job, entry] of Object.entries(CI_GATE_COVERAGE)) {
      // Stale guard (P2-3, antig-opus review): a declared contract must map to
      // a job the ci.yml still has. If CI drops a job but the contract lingers,
      // this fails -> remove the stale entry.
      assert.ok(realJobs.includes(job), `stale CI_GATE_COVERAGE entry "${job}" — not a real ci.yml job`);
      assert.equal(typeof entry.proof, 'string');
      assert.equal(typeof entry.verify, 'function');
    }
  });
});
