/**
 * F253 Phase C — AC-C2: CI Error Classifier
 *
 * Tests that CI output gets classified into the right error class,
 * determinism flag, and auto-fix command. The classifier drives the
 * CI repair loop's decision to auto-fix or escalate to a cat.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('classifyCiError', () => {
  test('classifies biome format error as deterministic:format', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = 'packages/api/src/foo.ts format ━━━\n × Formatter would have printed';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'format');
    assert.equal(result.deterministic, true);
    assert.deepEqual(result.autoFixCommand, ['pnpm', 'exec', 'biome', 'check', '--write', '.']);
  });

  test('classifies TypeScript error as non-deterministic:typecheck', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = "error TS2307: Cannot find module './foo'";
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'typecheck');
    assert.equal(result.deterministic, false);
  });

  test('classifies test failure as non-deterministic', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = '1 failing\n  AssertionError: expected 3 to equal 4';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'test_failure');
    assert.equal(result.deterministic, false);
  });

  test('classifies lint error with suspicious rule as non-deterministic', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = 'packages/api/src/foo.ts lint ━━━\n × lint/suspicious/noDoubleEquals';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'lint');
    // suspicious/correctness lint needs human review
    assert.equal(result.deterministic, false);
  });

  test('classifies lint error with style rule as auto-fixable', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const output = 'packages/api/src/foo.ts lint ━━━\n × lint/style/useConst';
    const result = classifyCiError(output);
    assert.equal(result.errorClass, 'lint');
  });

  test('unknown error is non-deterministic', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    const result = classifyCiError('some random error output');
    assert.equal(result.errorClass, 'unknown');
    assert.equal(result.deterministic, false);
  });

  test('result always has summary string', async () => {
    const { classifyCiError } = await import('./classify-ci-error.mjs');
    for (const input of [
      'format ━━━\n × Formatter would have printed',
      "error TS2307: Cannot find module './foo'",
      '1 failing\n AssertionError: expected 3 to equal 4',
      'random output',
    ]) {
      const result = classifyCiError(input);
      assert.ok(
        typeof result.summary === 'string' && result.summary.length > 0,
        `summary for "${input.slice(0, 30)}..."`,
      );
    }
  });
});

describe('shouldAutoFix (CI repair loop protocol)', () => {
  test('deterministic error → auto-fix on first occurrence (round 0)', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'format', deterministic: true };
    assert.equal(shouldAutoFix(classification, 0), true);
  });

  test('same-class error on round 2 → still auto-fix (round 1)', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'format', deterministic: true };
    assert.equal(shouldAutoFix(classification, 1), true);
  });

  test('same-class error on round 3 → escalate (round 2, max exceeded)', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'format', deterministic: true };
    assert.equal(shouldAutoFix(classification, 2), false);
  });

  test('non-deterministic error → never auto-fix (even round 0)', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'test_failure', deterministic: false };
    assert.equal(shouldAutoFix(classification, 0), false);
  });

  test('unknown error → never auto-fix', async () => {
    const { shouldAutoFix } = await import('./classify-ci-error.mjs');
    const classification = { errorClass: 'unknown', deterministic: false };
    assert.equal(shouldAutoFix(classification, 0), false);
  });
});
