import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '../../../..');

describe('F192 E-pilot evidence artifacts', () => {
  it('does not publish representative eval:a2a data as a live verdict', () => {
    const liveVerdictPath = resolve(repoRoot, 'docs/harness-feedback/verdicts/2026-05-21-eval-a2a-pilot-verdict.md');
    const fixturePath = resolve(
      repoRoot,
      'docs/harness-feedback/verdicts/fixtures/2026-05-21-eval-a2a-contract-demo.md',
    );

    assert.equal(
      existsSync(liveVerdictPath),
      false,
      'representative E-pilot data must not be stored as a live verdict',
    );
    assert.equal(existsSync(fixturePath), true, 'contract demo fixture should be explicit');

    const fixtureText = readFileSync(fixturePath, 'utf8');
    assert.match(fixtureText, /Contract Demo Fixture/);
    assert.match(fixtureText, /representative data/i);
    assert.doesNotMatch(fixtureText, /snapshot:eval-F167-2026-05-21/);
    assert.doesNotMatch(fixtureText, /attribution:AR-2026-05-21-001/);
  });
});
