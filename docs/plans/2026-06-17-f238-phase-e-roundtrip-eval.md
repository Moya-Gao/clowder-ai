# F238 Phase E — Round-Trip and Eval Loop Implementation Plan

**Feature:** F238 — `docs/features/F238-bidirectional-boundary-symmetry.md`
**Goal:** Prove the boundary dictionary works bidirectionally with round-trip fixtures, structured scan counters, and a recurring check that fails on regressions.
**Acceptance Criteria:**
- AC-E1: Round-trip fixtures cover representative files across L0, ~~prompt templates~~, manifest, cat-config, desktop, sop-definitions, guides, and cat-cafe-skills.
- AC-E2: Sync/intake logs emit scan counters by term class, severity, and consumed exceptions.
- AC-E3: A recurring verdict or equivalent eval records whether dictionary-backed boundary scans remain green over time.
**Architecture cell:** opensource-ops
**Map delta:** none
**Map delta why:** Phase E adds tests and a CLI flag to existing scripts — no new architectural surface.
**Architecture:** Add `--summary-json` to `reverse-sanitizer.mjs` for structured counters (AC-E2). Create `scripts/boundary-roundtrip.test.mjs` with per-category fixture tests that verify bidirectional scan + suggestion reciprocity (AC-E1). Wire into `pnpm check` as the recurring verdict (AC-E3).
**Tech Stack:** Node.js test runner, reverse-sanitizer.mjs, brand-dictionary.yaml
**前端验证:** No

---

## Scope

**Building:**
- `--summary-json` flag on reverse-sanitizer CLI for structured counters
- Round-trip fixture tests against representative REAL files in the repo
- `check:boundary-roundtrip` wired into `pnpm check`

**NOT building:**
- Auto-rewriting (KD-3: detect-only)
- Modifications to `sync-to-opensource.sh` or `intake-from-opensource.sh`
- `assets/prompt-templates/**` coverage (dir doesn't exist yet — F237 scope)
- Separate eval service or dashboard

**Stateful Object Gate:** No stateful objects — pure functional CLI flag + test fixtures.

## Round-Trip Test Strategy

For each file category, the test:
1. Runs reverse-sanitizer **outbound** on a real cat-cafe file → expects home-term findings (these are correct home-only terms that would need sanitizing for export)
2. Runs reverse-sanitizer **inbound** on the same file → expects zero or near-zero public-term findings (cat-cafe files should not contain public-only terms)
3. Verifies **suggestion reciprocity**: outbound finding's suggestion = the term the inbound scanner would detect, and vice versa

This proves the dictionary is symmetric and the scanner works bidirectionally. "Round-trip" means: if we sanitize outbound (replacing home→public) and then scan the result inbound (detecting public→home), the chain is consistent.

### File categories and representative targets

| Category | File | Expected outbound findings | Expected inbound findings |
|----------|------|---------------------------|--------------------------|
| L0 | `assets/system-prompts/governance-l0.md` | P1: 铲屎官, Cat Cafe, CVO, etc. | ~0 (home-only file) |
| Manifest | `packages/web/public/manifest.json` | P1: Cat Cafe/Café brand | ~0 |
| cat-config | `cat-config.json` | P1: Cat Cafe brand, nicknames | ~0 |
| sop-definitions | `sop-definitions/development.yaml` | P1: 铲屎官, CVO, Cat Cafe | ~0 |
| guides | `guides/registry.yaml` | P2: possible home terms | ~0 |
| desktop | `desktop/package.json` (if exists) | P1: Cat Cafe brand | ~0 |
| skills | `cat-cafe-skills/BOOTSTRAP.md` | possible home terms | ~0 |

---

## Task 1: Add `--summary-json` flag to reverse-sanitizer (AC-E2)

**Files:**
- Modify: `scripts/reverse-sanitizer.mjs`
- Modify: `scripts/reverse-sanitizer.test.mjs`

### Step 1: Write failing test for `--summary-json`

```javascript
// In reverse-sanitizer.test.mjs
test('--summary-json outputs structured counters on stdout after NDJSON', async (t) => {
  // Write a fixture with known terms
  const tmp = ...;
  const { stdout } = await run(['--direction', 'outbound', '--summary-json', tmp]);
  const lines = stdout.trim().split('\n');
  const summary = JSON.parse(lines[lines.length - 1]);
  assert.ok(summary.totalFindings > 0);
  assert.ok(summary.byTermClass);
  assert.ok(summary.bySeverity);
  assert.ok(typeof summary.exceptionsConsumed === 'number');
});
```

### Step 2: Run test, verify fails

```bash
node --test scripts/reverse-sanitizer.test.mjs --test-name-pattern="summary-json"
```
Expected: FAIL — `--summary-json` not implemented.

### Step 3: Implement `--summary-json`

In `main()`, after dedup, when `--summary-json` is present:
- Aggregate findings by `termClass` and `severity`
- Count consumed exceptions (findings that were filtered by `isExcepted`)
- Output one final JSON line: `{"_type":"summary", totalFindings, byTermClass, bySeverity, exceptionsConsumed}`

### Step 4: Run test, verify passes

```bash
node --test scripts/reverse-sanitizer.test.mjs
```
Expected: all tests pass (30 existing + new).

### Step 5: Commit

```bash
git add scripts/reverse-sanitizer.mjs scripts/reverse-sanitizer.test.mjs
git commit -m "feat(f238): add --summary-json to reverse-sanitizer for structured counters

AC-E2: scan counters by term class, severity, and consumed exceptions."
```

---

## Task 2: Round-trip fixture tests (AC-E1)

**Files:**
- Create: `scripts/boundary-roundtrip.test.mjs`
- Modify: `package.json` (add `check:boundary-roundtrip` script)
- Modify: `scripts/run-checks.mjs` (register new check)
- Modify: `scripts/run-checks.test.mjs` (update count)

### Step 1: Write round-trip test scaffolding

```javascript
// scripts/boundary-roundtrip.test.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const exec = promisify(execFile);

async function scanOutbound(filePath) {
  // Run reverse-sanitizer outbound, return parsed findings
}

async function scanInbound(filePath) {
  // Run reverse-sanitizer inbound, return parsed findings
}
```

### Step 2: Write per-category round-trip tests

For each category:

```javascript
describe('round-trip: L0 (governance-l0.md)', () => {
  test('outbound scan detects home-only terms', async () => {
    const findings = await scanOutbound('assets/system-prompts/governance-l0.md');
    // P1 home terms expected (铲屎官, CVO, Cat Cafe, etc.)
    assert.ok(findings.length > 0, 'L0 should contain home-only terms');
    const p1 = findings.filter(f => f.severity === 'P1');
    assert.ok(p1.length > 0, 'L0 should have P1 home terms');
  });

  test('inbound scan finds zero public-only terms', async () => {
    const findings = await scanInbound('assets/system-prompts/governance-l0.md');
    // Home file should not contain public-only terms
    assert.equal(findings.length, 0, 'L0 should not contain public-only terms');
  });

  test('suggestion reciprocity: outbound suggestions are valid public terms', async () => {
    const findings = await scanOutbound('assets/system-prompts/governance-l0.md');
    for (const f of findings) {
      assert.ok(f.suggestion, `finding for "${f.matched}" should have a suggestion`);
      assert.notEqual(f.suggestion, f.matched, 'suggestion should differ from matched');
    }
  });
});

// Repeat for: manifest, cat-config, sop-definitions, guides, desktop, skills
```

### Step 3: Run tests, verify they work

```bash
node --test scripts/boundary-roundtrip.test.mjs
```

### Step 4: Wire into pnpm check

In `package.json`:
```json
"check:boundary-roundtrip": "node --test scripts/boundary-roundtrip.test.mjs"
```

In `run-checks.mjs`, add `'check:boundary-roundtrip'` to the checks array.

Update `run-checks.test.mjs` count.

### Step 5: Commit

```bash
git add scripts/boundary-roundtrip.test.mjs package.json scripts/run-checks.mjs scripts/run-checks.test.mjs
git commit -m "feat(f238): add round-trip boundary fixtures and wire into pnpm check

AC-E1: round-trip fixtures across L0, manifest, cat-config, sop-defs, guides, desktop, skills.
AC-E3: wired into pnpm check as recurring verdict."
```

---

## Task 3: Verify full pipeline

### Step 1: Run full `pnpm check` and confirm new checks pass

```bash
pnpm check
```

### Step 2: Run `--summary-json` against a real file to verify counters

```bash
node scripts/reverse-sanitizer.mjs --direction outbound --summary-json assets/system-prompts/governance-l0.md
```

### Step 3: Commit any fixups

---

## Open Questions

| # | Type | Question | Resolution |
|---|------|----------|------------|
| OQ-1 | Technical | Some real files may have expected "violations" (e.g. cat-config.json has both home and public terms by design). How to handle? | Use assertion ranges (`findings.length >= N`) not exact counts. If a file intentionally has cross-boundary terms, note it in the test. |
| OQ-2 | Technical | `assets/prompt-templates/` doesn't exist yet. | Skip — F237 scope. AC-E1 crossed out "prompt templates". Add coverage when F237 creates the dir. |
