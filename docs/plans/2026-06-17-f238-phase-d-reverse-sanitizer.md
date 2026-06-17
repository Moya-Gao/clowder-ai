# F238 Phase D — Reverse Sanitizer Detect-Only V1

**Feature:** F238 — `docs/features/F238-bidirectional-boundary-symmetry.md`
**Goal:** Detect home-only terms in public exports and public-only terms in cat-cafe imports, without auto-rewriting.
**Acceptance Criteria:**
- AC-D1: A detect-only reverse sanitizer reports `severity | direction | file | line/field | term id | suggestion` and exits non-zero for P0/P1 violations.
- AC-D2: JSON/YAML inputs report field paths where practical; text inputs report file/line.
- AC-D3: The tool supports outbound-export validation and inbound cat-cafe validation without auto-rewriting.
**Architecture cell:** `scripts/` (boundary toolchain)
**Map delta:** none
**Map delta why:** Adds a new script to the existing boundary toolchain alongside brand-dictionary-helper.mjs; no ownership map change.
**Architecture:** Single Node.js CLI script (`scripts/reverse-sanitizer.mjs`) reads `assets/brand-dictionary.yaml`, scans files by type (JSON/YAML → field-path walking, text → line scan), outputs structured findings, exits non-zero on P0/P1. Reuses the `yaml` package already in devDeps.
**Tech Stack:** Node.js, `node:fs`, `yaml` (existing devDep)
**前端验证:** No — CLI tool only.

---

## Stateful Object Gate

**No stateful objects.** This is a pure function: files in → findings out. No lifecycle, no persistence, no state machine. Gate does not apply.

## What We're NOT Building

- No auto-rewriting (V1 is detect-only per KD-3)
- No integration into sync/intake pipelines yet (Phase E)
- No `pnpm check` entry yet (will add after tests stabilize — avoid blocking other PRs on a new scanner)
- No recursive directory walking built-in (caller passes explicit file list via glob/find)

## Terminal Schema

```typescript
// Finding — one per violation
interface Finding {
  severity: string;       // "P1" | "P2"
  direction: string;      // "outbound" | "inbound"
  file: string;           // relative path
  location: string;       // "line:42" or "$.manifest.name" (JSON/YAML field path)
  termId: string;         // "product.primary"
  termClass: string;      // "brand" | "role" | "persona" | "l4_culture"
  matched: string;        // the actual text matched
  suggestion: string;     // replacement hint from dictionary
}

// CLI output: one JSON line per finding, summary on stderr
// Exit code: 0 = clean, 1 = P0/P1 found, 2 = P2-only found
```

## Implementation Steps

### Task 1: Scaffold + first red test

**Files:**
- Create: `scripts/reverse-sanitizer.mjs`
- Create: `scripts/reverse-sanitizer.test.mjs`

**Step 1:** Write failing test — CLI exists, `--direction outbound` on a file containing "Cat Café" produces a finding with correct shape.

```javascript
// Test: scans a text file with a home-only term in outbound direction
it('detects home-only term in outbound text file', () => {
  // create tmp file with "Cat Café" content
  // run: node scripts/reverse-sanitizer.mjs --direction outbound <tmpfile>
  // assert: stdout contains JSON with termId "product.primary", severity "P1"
  // assert: exit code non-zero
});
```

**Step 2:** Run test → FAIL (script doesn't exist).

**Step 3:** Implement minimal CLI:
- Parse `--direction` flag
- Load `assets/brand-dictionary.yaml`
- For each file arg, read content, scan for home/public term variants
- Output findings as JSON lines
- Exit non-zero if any P0/P1

**Step 4:** Run test → PASS.

**Step 5:** Commit: `feat(f238): scaffold reverse-sanitizer CLI with text scanning`

### Task 2: JSON/YAML field-path reporting

**Files:**
- Modify: `scripts/reverse-sanitizer.mjs`
- Modify: `scripts/reverse-sanitizer.test.mjs`

**Step 1:** Write failing test — scanning a `.json` file reports field path (`$.name`) not line number.

```javascript
it('reports JSON field path for violations in .json files', () => {
  // create tmp JSON: {"name": "Cat Café Hub", "version": "1.0"}
  // run: --direction outbound <tmpfile.json>
  // assert: finding.location starts with "$." (e.g. "$.name")
});

it('reports YAML field path for violations in .yaml files', () => {
  // create tmp YAML with home term in nested key
  // assert: finding.location is dotted path
});
```

**Step 2:** Run test → FAIL (location shows line number, not field path).

**Step 3:** Implement:
- Detect file extension (.json / .yaml / .yml)
- For JSON: `JSON.parse` → recursive walk with path accumulator
- For YAML: `yaml.parse` → same recursive walk
- For other extensions: keep line-based scanning

**Step 4:** Run test → PASS.

**Step 5:** Commit: `feat(f238): JSON/YAML field-path reporting in reverse-sanitizer`

### Task 3: Inbound direction + exception handling

**Files:**
- Modify: `scripts/reverse-sanitizer.mjs`
- Modify: `scripts/reverse-sanitizer.test.mjs`

**Step 1:** Write failing tests:

```javascript
it('detects public-only term in inbound direction', () => {
  // create tmp file with "Clowder AI" in a cat-cafe path context
  // run: --direction inbound <tmpfile>
  // assert: finding with direction "inbound"
});

it('respects dictionary exceptions', () => {
  // create tmp file containing "@cat-cafe/shared" (excepted pattern)
  // run: --direction outbound <tmpfile>
  // assert: no finding for that match (exception applies)
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement:
- `--direction inbound`: scan for public→home term variants
- Exception matching: check if matched text falls within a dictionary exception pattern

**Step 4:** Run → PASS.

**Step 5:** Commit: `feat(f238): inbound direction + exception handling`

### Task 4: Exit codes + summary + biome

**Files:**
- Modify: `scripts/reverse-sanitizer.mjs`
- Modify: `scripts/reverse-sanitizer.test.mjs`

**Step 1:** Write failing tests:

```javascript
it('exits 0 when no violations found', () => {
  // clean file, outbound scan
  // assert: exit code 0, no findings
});

it('exits 1 when P1 violation found', () => {
  // file with "Cat Café"
  // assert: exit code 1
});

it('exits 2 when only P2 violations found', () => {
  // file with P2-only term (e.g. 猫猫)
  // assert: exit code 2
});

it('prints summary to stderr', () => {
  // assert: stderr contains "N violations (X P1, Y P2)"
});
```

**Step 2:** Run → FAIL.

**Step 3:** Implement exit code logic + stderr summary.

**Step 4:** Run → PASS. Then `pnpm exec biome check --write scripts/reverse-sanitizer.mjs scripts/reverse-sanitizer.test.mjs`.

**Step 5:** Commit: `feat(f238): exit codes + summary output`

### Task 5: Add to package.json + pnpm check (optional, based on stability)

**Files:**
- Modify: `package.json` (add `check:reverse-sanitizer`)
- Modify: `scripts/run-checks.mjs` (add to PARALLEL_CHECKS)
- Modify: `scripts/run-checks.test.mjs` (update count)

Only if tests are stable and not flaky. Otherwise defer to Phase E.

## Verification

After all tasks:
```bash
node --test scripts/reverse-sanitizer.test.mjs   # all pass
pnpm check                                        # no regression
# Manual smoke: scan a known-leaky fixture
echo '{"name":"Cat Café","desc":"三只 AI 猫猫的协作空间"}' > /tmp/test.json
node scripts/reverse-sanitizer.mjs --direction outbound /tmp/test.json
# Should show 2 findings (product.primary P1, product.tagline P1)
```
