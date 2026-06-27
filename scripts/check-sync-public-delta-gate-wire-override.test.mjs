// F251 Task 4c sync-to-opensource.sh override wire test.
//
// Asserts that the bash wrapper around the delta gate CLI correctly:
//   1. Initialises DELTA_GATE_OVERRIDES / DELTA_GATE_CVO_APPROVED / PENDING_OVERRIDE_VALUE
//   2. Accepts both `--override=path:reason` (= form) and `--override path:reason` (split form)
//      — R1 cloud P2 #3485215234: split form is what the Node CLI USAGE documents
//   3. Refuses bare trailing `--override` with no value (UX safeguard)
//   4. Builds DELTA_GATE_OVERRIDE_ARGS for every gate site (validate / dry-run / production)
//   5. Forwards the array via bash expansion at every gate call

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(HERE, 'sync-to-opensource.sh');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf-8');
const LINES = SCRIPT.split('\n');

function findLineIndices(matcher) {
  const result = [];
  for (let i = 0; i < LINES.length; i += 1) {
    if (matcher(LINES[i], i)) {
      result.push(i);
    }
  }
  return result;
}

test('Task 4c: --override + --cvo-approved-public-delta-overwrite parsed and forwarded to ALL 3 gate sites', () => {
  const parseSection = SCRIPT.slice(0, SCRIPT.indexOf('# 0a: Source repo dirty check'));
  for (const re of [
    /DELTA_GATE_OVERRIDES=\(\)/,
    /DELTA_GATE_CVO_APPROVED=false/,
    /PENDING_OVERRIDE_VALUE=false/,
    /--override=\*\)[\s\S]*?DELTA_GATE_OVERRIDES\+=/,
    /--override\)\s*PENDING_OVERRIDE_VALUE=true/,
    /--cvo-approved-public-delta-overwrite\)\s*DELTA_GATE_CVO_APPROVED=true/,
  ]) {
    assert.match(parseSection, re);
  }
  assert.match(SCRIPT, /--override requires a <path>:<reason> value/);

  for (const callIdx of findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line))) {
    const before = LINES.slice(Math.max(0, callIdx - 30), callIdx).join('\n');
    const after = LINES.slice(callIdx, Math.min(callIdx + 30, LINES.length)).join('\n');
    assert.match(before, /DELTA_GATE_OVERRIDE_ARGS\+=\(--override/, `gate ${callIdx + 1}: build OVERRIDE_ARGS`);
    assert.match(after, /"\$\{DELTA_GATE_OVERRIDE_ARGS\[@\]\}"/, `gate ${callIdx + 1}: forward array`);
  }
});

test('R2 cloud P2 #3485236801 §16e audit: option-looking override values rejected at every entry point', () => {
  // R1 cloud P1 fixed the split-form (--override --dry-run). R2 cloud P2 caught the EQUALS
  // form (--override=--dry-run), which §16e flagged as the same-class vulnerability via a
  // different entry point. Both forms now route through a single helper so the next added
  // form (e.g. a --override-file YAML) inherits the guard automatically.
  const parseSection = SCRIPT.slice(0, SCRIPT.indexOf('# 0a: Source repo dirty check'));

  // Helper defined before the parse loop, with the exit-1 fail-closed branch.
  assert.match(
    parseSection,
    /reject_option_looking_override_value\(\)\s*\{[\s\S]*?case "\$1" in[\s\S]*?--\*\)[\s\S]*?exit 1/,
    'reject_option_looking_override_value helper must define `case "$1" in --*)` + exit 1',
  );

  // Both entry points invoke the helper.
  const pendingHandler = parseSection.match(/PENDING_OVERRIDE_VALUE.*=.*true\s*\]\s*;\s*then[\s\S]*?continue/);
  assert.ok(pendingHandler, 'PENDING_OVERRIDE_VALUE handler block must exist');
  assert.match(pendingHandler[0], /reject_option_looking_override_value/, 'split-form must call the helper');

  const equalsCase = parseSection.match(/--override=\*\)[\s\S]*?;;/);
  assert.ok(equalsCase, '--override=*) case body must exist');
  assert.match(equalsCase[0], /reject_option_looking_override_value/, 'equals-form must call the helper');
});
