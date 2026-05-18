import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// -- Acceptance matrix from clowder-ai#705 --
const CASES = [
  // [description, env-line content, expected: 'regen' | 'keep']
  ['missing key', 'OTHER_KEY=value', 'regen'],
  ['double-quoted empty', 'TELEMETRY_HMAC_SALT=""', 'regen'],
  ['single-quoted empty', "TELEMETRY_HMAC_SALT=''", 'regen'],
  ['whitespace only', 'TELEMETRY_HMAC_SALT=   ', 'regen'],
  ['quoted whitespace (double)', 'TELEMETRY_HMAC_SALT="   "', 'regen'],
  ['quoted whitespace (single)', "TELEMETRY_HMAC_SALT='   '", 'regen'],
  ['commented out', '# TELEMETRY_HMAC_SALT=abc123', 'regen'],
  ['bare equals (no value)', 'TELEMETRY_HMAC_SALT=', 'regen'],
  ['bare hex value', 'TELEMETRY_HMAC_SALT=abc123def456', 'keep'],
  ['quoted hex (double)', 'TELEMETRY_HMAC_SALT="abc123def"', 'keep'],
  ['quoted hex (single)', "TELEMETRY_HMAC_SALT='abc123def'", 'keep'],
  ['64-char real salt', 'TELEMETRY_HMAC_SALT=a'.repeat(1) + 'bc'.repeat(32), 'keep'],
];

// Simulate install.sh detection: sed extract → tr strip quotes/whitespace → empty check
function bashDetect(envLine) {
  const match = envLine.match(/^TELEMETRY_HMAC_SALT=(.*)/);
  if (!match) return 'regen';
  const trimmed = match[1].replace(/["'\t\n\r ]/g, '');
  return trimmed.length === 0 ? 'regen' : 'keep';
}

// Simulate install.ps1 detection: -replace extract → .Trim().Trim('"',"'").Trim() → Length check
function ps1Detect(envLine) {
  const match = envLine.match(/^TELEMETRY_HMAC_SALT=(.*)/);
  if (!match) return 'regen';
  const val = match[1]
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  return val.length === 0 ? 'regen' : 'keep';
}

describe('#705 HMAC salt detection — bash logic', () => {
  for (const [desc, line, expected] of CASES) {
    it(`${desc} → ${expected}`, () => {
      assert.equal(bashDetect(line), expected);
    });
  }
});

describe('#705 HMAC salt detection — PowerShell logic', () => {
  for (const [desc, line, expected] of CASES) {
    it(`${desc} → ${expected}`, () => {
      assert.equal(ps1Detect(line), expected);
    });
  }
});

describe('#705 production script static guards', () => {
  const ps1 = readFileSync(join(ROOT, 'scripts', 'install.ps1'), 'utf8');
  const sh = readFileSync(join(ROOT, 'scripts', 'install.sh'), 'utf8');

  it('install.ps1 trims after unquoting (post-unquote .Trim())', () => {
    const saltBlock = ps1.split('\n').find((l) => l.includes('TELEMETRY_HMAC_SALT=') && l.includes('.Trim('));
    assert.ok(saltBlock, 'salt detection line not found in install.ps1');
    assert.match(
      saltBlock,
      /\.Trim\(['"][^)]*\)\.Trim\(\)/,
      'must have .Trim() after .Trim(quote chars) — missing post-unquote trim',
    );
  });

  it('install.sh strips quotes and whitespace from raw value', () => {
    assert.match(sh, /tr -d.*["'].*["']/, 'install.sh must use tr -d to strip quotes and whitespace from salt value');
  });
});

describe('#705 bash test script runs green', () => {
  it('scripts/test-hmac-salt-detection.sh exits 0', () => {
    const result = execFileSync('bash', [join(ROOT, 'scripts', 'test-hmac-salt-detection.sh')], {
      timeout: 10_000,
      encoding: 'utf8',
    });
    assert.match(result, /0 failed/);
  });
});
