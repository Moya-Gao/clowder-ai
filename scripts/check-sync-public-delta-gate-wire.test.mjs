// F251 Task 4 source-order regression test for sync-to-opensource.sh wire.
//
// Locks the following invariants:
//   1. The delta gate is invoked from the production sync path (--mode=all),
//      BEFORE `sync_filtered_into_target "$TARGET_DIR"` (the real rsync).
//   2. The delta gate is invoked from the --dry-run path so AC-A5 historical
//      replay can use this exact code path.
//   3. The delta gate is invoked from the --validate path for the same reason.
//   4. The --skip-delta-gate flag exists and short-circuits all three callers.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(HERE, 'sync-to-opensource.sh');
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf-8');
const LINES = SCRIPT.split('\n');

function findLineIndex(matcher) {
  return LINES.findIndex(matcher);
}

function findLineIndices(matcher) {
  const result = [];
  for (let i = 0; i < LINES.length; i += 1) {
    if (matcher(LINES[i], i)) {
      result.push(i);
    }
  }
  return result;
}

test('production wire: delta gate is invoked before real target sync', () => {
  // The real target rsync uses `sync_filtered_into_target "$TARGET_DIR"`
  // (not VALIDATION_TARGET_DIR).
  const realSyncIndex = findLineIndex((line) => /sync_filtered_into_target\s+"\$TARGET_DIR"/.test(line));
  assert.ok(realSyncIndex > 0, 'expected real target sync call site');

  // The delta gate CLI call sites.
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  assert.ok(gateCalls.length >= 1, 'expected at least one delta gate CLI invocation');

  // At least one production gate call must precede the real target rsync,
  // AND it must be the non-dry-run gate call (so it actually fail-closes).
  const productionGate = gateCalls.find((idx) => {
    if (idx >= realSyncIndex) return false;
    // Scan forward up to 30 lines from the gate call for a --dry-run flag.
    const slice = LINES.slice(idx, Math.min(idx + 30, LINES.length)).join('\n');
    return !slice.includes('--dry-run');
  });
  assert.ok(productionGate !== undefined, 'expected a non-dry-run delta gate call before real target rsync');
});

test('dry-run path: delta gate is invoked before exit', () => {
  // Find the multi-line DRY_RUN branch (ends with `then` and no `fi` on same line).
  // Skip the one-liner echo guards earlier in the script.
  const dryRunStart = findLineIndex((line) => /if\s*\[\s*"\$DRY_RUN"\s*=\s*true\s*\]\s*;\s*then\s*$/.test(line));
  assert.ok(dryRunStart > 0, 'expected dry-run branch');

  // Find the matching `exit 0` after dryRunStart but before the next top-level fi
  let fiDepth = 1;
  let exitIndex = -1;
  for (let i = dryRunStart + 1; i < LINES.length; i += 1) {
    const line = LINES[i].trim();
    if (line.startsWith('if ')) fiDepth += 1;
    if (line === 'fi') {
      fiDepth -= 1;
      if (fiDepth === 0) break;
    }
    if (fiDepth === 1 && /^\s*exit\s+0\s*$/.test(LINES[i])) {
      exitIndex = i;
      break;
    }
  }
  assert.ok(exitIndex > dryRunStart, 'expected exit 0 inside dry-run branch');

  // Gate call must be between dryRunStart and exitIndex.
  const gateInDryRun = findLineIndex(
    (line, idx) =>
      idx > dryRunStart && idx < exitIndex && /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line),
  );
  assert.ok(
    gateInDryRun > dryRunStart && gateInDryRun < exitIndex,
    `dry-run branch must invoke the delta gate before exit (gate=${gateInDryRun}, dryRunStart=${dryRunStart}, exit=${exitIndex})`,
  );
});

test('validate path: delta gate is invoked before exit', () => {
  // Find the multi-line VALIDATE branch (NOT the one-liner echo on line 799).
  // Multi-line form ends with `then` (no `fi` on same line).
  const validateStart = findLineIndex((line) => /if\s*\[\s*"\$VALIDATE"\s*=\s*true\s*\]\s*;\s*then\s*$/.test(line));
  assert.ok(validateStart > 0, 'expected multi-line validate branch');

  // Find the next exit 0 after validateStart at the same fi-depth
  let fiDepth = 1;
  let exitIndex = -1;
  for (let i = validateStart + 1; i < LINES.length; i += 1) {
    const line = LINES[i].trim();
    if (line.startsWith('if ')) fiDepth += 1;
    if (line === 'fi') {
      fiDepth -= 1;
      if (fiDepth === 0) break;
    }
    if (fiDepth === 1 && /^\s*exit\s+0\s*$/.test(LINES[i])) {
      exitIndex = i;
      break;
    }
  }
  assert.ok(exitIndex > validateStart, 'expected exit 0 inside validate branch');

  const gateInValidate = findLineIndex(
    (line, idx) =>
      idx > validateStart && idx < exitIndex && /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line),
  );
  assert.ok(
    gateInValidate > validateStart && gateInValidate < exitIndex,
    `validate branch must invoke the delta gate before exit (gate=${gateInValidate}, validateStart=${validateStart}, exit=${exitIndex})`,
  );
});

test('production gate is NOT nested inside --skip-validate else (must run even with --skip-validate)', () => {
  // Find the multi-line SKIP_VALIDATE if block
  const skipValidateStart = findLineIndex((line) =>
    /if\s*\[\s*"\$SKIP_VALIDATE"\s*=\s*true\s*\]\s*;\s*then\s*$/.test(line),
  );
  assert.ok(skipValidateStart > 0, 'expected SKIP_VALIDATE branch');
  // Find the matching `fi` at depth 1
  let fiDepth = 1;
  let skipValidateFi = -1;
  for (let i = skipValidateStart + 1; i < LINES.length; i += 1) {
    const t = LINES[i].trim();
    if (t.startsWith('if ')) fiDepth += 1;
    if (t === 'fi') {
      fiDepth -= 1;
      if (fiDepth === 0) {
        skipValidateFi = i;
        break;
      }
    }
  }
  assert.ok(skipValidateFi > skipValidateStart, 'expected SKIP_VALIDATE matching fi');

  // Find the production (non-dry-run) gate call (the one before real sync)
  const realSyncIndex = findLineIndex((line) => /sync_filtered_into_target\s+"\$TARGET_DIR"/.test(line));
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  const productionGate = gateCalls.find((idx) => {
    if (idx >= realSyncIndex) return false;
    const slice = LINES.slice(idx, Math.min(idx + 30, LINES.length)).join('\n');
    return !slice.includes('--dry-run');
  });
  assert.ok(productionGate !== undefined, 'expected production gate before real sync');

  // The production gate MUST be AFTER the SKIP_VALIDATE fi (outside that block)
  assert.ok(
    productionGate > skipValidateFi,
    `production gate (line ${productionGate + 1}) must be AFTER SKIP_VALIDATE fi (line ${skipValidateFi + 1}) so --skip-validate cannot bypass the delta gate`,
  );
});

test('production gate uses pristine FILTERED_DIR, not polluted VALIDATION_TARGET_DIR', () => {
  const realSyncIndex = findLineIndex((line) => /sync_filtered_into_target\s+"\$TARGET_DIR"/.test(line));
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  const productionGate = gateCalls.find((idx) => {
    if (idx >= realSyncIndex) return false;
    const slice = LINES.slice(idx, Math.min(idx + 30, LINES.length)).join('\n');
    return !slice.includes('--dry-run');
  });
  assert.ok(productionGate !== undefined);
  // Scan forward 20 lines for --filtered-dir; assert it points at $FILTERED_DIR (pristine)
  const slice = LINES.slice(productionGate, Math.min(productionGate + 20, LINES.length)).join('\n');
  assert.match(slice, /--filtered-dir\s+"\$FILTERED_DIR"/, 'production gate must use pristine $FILTERED_DIR');
  assert.doesNotMatch(
    slice,
    /--filtered-dir\s+"\$VALIDATION_TARGET_DIR"/,
    'production gate must NOT use $VALIDATION_TARGET_DIR (polluted by pnpm install)',
  );
});

test('production gate passes --head-ref HEAD (worktree HEAD, not origin/main)', () => {
  const realSyncIndex = findLineIndex((line) => /sync_filtered_into_target\s+"\$TARGET_DIR"/.test(line));
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  const productionGate = gateCalls.find((idx) => {
    if (idx >= realSyncIndex) return false;
    const slice = LINES.slice(idx, Math.min(idx + 30, LINES.length)).join('\n');
    return !slice.includes('--dry-run');
  });
  assert.ok(productionGate !== undefined);
  const slice = LINES.slice(productionGate, Math.min(productionGate + 25, LINES.length)).join('\n');
  assert.match(slice, /--head-ref\s+HEAD/, 'production gate must pass --head-ref HEAD');
});

test('ALL gate invocations (production + dry-run + validate) pass --head-ref HEAD', () => {
  // dry-run + validate gate calls must match production semantics (worktree HEAD,
  // not origin/main) so AC-A5 historical replay reports are consistent with the
  // production path.
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  for (const callIdx of gateCalls) {
    // Scan forward up to 30 lines for the terminal line of the node invocation
    const slice = LINES.slice(callIdx, Math.min(callIdx + 30, LINES.length)).join('\n');
    assert.match(
      slice,
      /--head-ref\s+HEAD/,
      `gate call at line ${callIdx + 1} must pass --head-ref HEAD to match worktree semantics`,
    );
  }
});

test('production gate forwards target-owned roots', () => {
  // The bash should build an array of --target-owned-root args from TARGET_OWNED and forward them
  const scriptHasTargetOwnedForwarding = SCRIPT.includes('--target-owned-root') && SCRIPT.includes('TARGET_OWNED');
  assert.ok(
    scriptHasTargetOwnedForwarding,
    'production gate must forward --target-owned-root for each entry in TARGET_OWNED array',
  );
});

test('--skip-delta-gate flag is parsed', () => {
  const flagDecl = findLineIndex((line) => /SKIP_DELTA_GATE=false/.test(line));
  const flagParse = findLineIndex((line) => /--skip-delta-gate\)/.test(line));
  assert.ok(flagDecl > 0, 'SKIP_DELTA_GATE default declaration required');
  assert.ok(flagParse > flagDecl, '--skip-delta-gate CLI parser must come after declaration');
});

test('gate invocations must NOT be followed by `|| true` (no fail-open)', () => {
  // `|| true` would swallow real failures (baseline resolution, git, report write).
  // CLI --dry-run already handles BLOCK → exit 0; bash must not also suppress errors.
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  for (const callIdx of gateCalls) {
    // Find the end of the multi-line node invocation: lines ending in `\` continue;
    // first line without trailing `\` is the terminal command line.
    let terminal = callIdx;
    while (terminal < LINES.length - 1 && /\\\s*$/.test(LINES[terminal])) {
      terminal += 1;
    }
    const terminalLine = LINES[terminal];
    assert.ok(
      !/\|\|\s*true\b/.test(terminalLine),
      `gate call at line ${callIdx + 1} must NOT be followed by '|| true' (terminal line ${terminal + 1}: ${terminalLine.trim()})`,
    );
  }
});

test('--skip-delta-gate gates ALL three call sites', () => {
  // Each gate call must be guarded by SKIP_DELTA_GATE check
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  assert.equal(gateCalls.length, 3, 'expected exactly 3 gate call sites (prod / dry-run / validate)');

  for (const callIdx of gateCalls) {
    // Look backward up to 25 lines for SKIP_DELTA_GATE check (T4c expanded the prelude).
    let found = false;
    for (let i = callIdx - 1; i >= Math.max(0, callIdx - 25); i -= 1) {
      if (LINES[i].includes('SKIP_DELTA_GATE')) {
        found = true;
        break;
      }
    }
    assert.ok(found, `gate call at line ${callIdx + 1} must be guarded by SKIP_DELTA_GATE check within 25 lines`);
  }
});

test('ALL gate invocations pass --source-dir $SOURCE_SYNC_DIR (not $SOURCE_DIR)', () => {
  // $SOURCE_DIR is the dev worktree (feature branch / stale local checkout); $SOURCE_SYNC_DIR
  // is the detached worktree at origin/main (for full sync) or fallback to $SOURCE_DIR (dry/validate).
  // The CLI records sourceHead via `git -C sourceDir rev-parse HEAD`, so passing the wrong
  // checkout makes the report SHA not match the exported bytes — AC-A3/A5/A6 evidence breaks.
  const gateCalls = findLineIndices((line) => /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line));
  for (const callIdx of gateCalls) {
    const slice = LINES.slice(callIdx, Math.min(callIdx + 30, LINES.length)).join('\n');
    assert.match(
      slice,
      /--source-dir\s+"\$SOURCE_SYNC_DIR"/,
      `gate call at line ${callIdx + 1} must pass --source-dir "$SOURCE_SYNC_DIR" so sourceHead matches exported bytes`,
    );
    assert.doesNotMatch(
      slice,
      /--source-dir\s+"\$SOURCE_DIR"/,
      `gate call at line ${callIdx + 1} must NOT pass --source-dir "$SOURCE_DIR" (dev worktree, not exported bytes)`,
    );
  }
});

test('dry-run gate forwards target-owned roots (parity with production)', () => {
  // Without target-owned-root forwarding, dry-run reports false BLOCKs on paths Step 5c
  // preserves (docs/community/, .github/community/, etc.). AC-A5 historical replay relies
  // on dry-run reports being trustworthy, so dry-run and production must build the same args.
  const dryRunStart = findLineIndex((line) => /if\s*\[\s*"\$DRY_RUN"\s*=\s*true\s*\]\s*;\s*then\s*$/.test(line));
  assert.ok(dryRunStart > 0, 'expected dry-run branch');

  // Find the gate call inside the dry-run branch
  let fiDepth = 1;
  let exitIndex = -1;
  for (let i = dryRunStart + 1; i < LINES.length; i += 1) {
    const t = LINES[i].trim();
    if (t.startsWith('if ')) fiDepth += 1;
    if (t === 'fi') {
      fiDepth -= 1;
      if (fiDepth === 0) break;
    }
    if (fiDepth === 1 && /^\s*exit\s+0\s*$/.test(LINES[i])) {
      exitIndex = i;
      break;
    }
  }
  const dryRunGate = findLineIndex(
    (line, idx) =>
      idx > dryRunStart && idx < exitIndex && /node\s+"[^"]*check-sync-public-delta-gate-cli\.mjs"/.test(line),
  );
  assert.ok(dryRunGate > 0, 'expected gate call in dry-run branch');

  // Look backward up to 25 lines for DELTA_GATE_TARGET_OWNED_ARGS build (T4c expanded the prelude).
  let argsBuilt = false;
  for (let i = dryRunGate - 1; i >= Math.max(0, dryRunGate - 25); i -= 1) {
    if (LINES[i].includes('DELTA_GATE_TARGET_OWNED_ARGS+=')) {
      argsBuilt = true;
      break;
    }
  }
  assert.ok(
    argsBuilt,
    'dry-run gate must build DELTA_GATE_TARGET_OWNED_ARGS array (loop over TARGET_OWNED) within 25 lines before the gate call',
  );

  // The gate call itself must reference the args array
  const slice = LINES.slice(dryRunGate, Math.min(dryRunGate + 25, LINES.length)).join('\n');
  assert.match(
    slice,
    /"\$\{DELTA_GATE_TARGET_OWNED_ARGS\[@\]\}"/,
    'dry-run gate call must forward the DELTA_GATE_TARGET_OWNED_ARGS array via bash expansion',
  );
});
