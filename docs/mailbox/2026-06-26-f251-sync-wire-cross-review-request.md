---
feature_ids: [F251]
topics: [opensource, sync, gate, review, cross-review, cloud-clean]
---

# Cross-Review Request: F251 Task 4a — Sync Pipeline Wire (R6 final-SHA)

Review-Target-ID: f251-task-4a-cross
Branch: feat/f251-sync-wire
Original-Request: docs/mailbox/2026-06-26-f251-sync-wire-review-request.md (5a514f4ca, R2 APPROVE)
Final SHA: `9bf6cf7b9` (cloud R6 clean — body + inline both verified)

## Why a cross-review now

Your R2 APPROVE on `d6f5457c` shipped 9 P1/P2 to cloud because the reviewer body
was checked but inline comments weren't pulled (`gh api .../pulls/N/comments` — the
inline-blind APPROVE pattern). 5 follow-up commits land R3–R6 fixes; cloud R6 verdict
on `9bf6cf7b9` is clean (8 stale re-anchored inlines, 0 new since 14:11Z push). Need
fresh cross-review of the **delta from R2 SHA → R6 final-SHA** before opus48 final-SHA
gate + squash merge.

## What changed since R2 APPROVE

| Round | SHA | Substance |
|-------|-----|-----------|
| R3 | `102d25fd3` | Plan-layer re-design addressing 9 cloud P1/P2 (override semantics, baseline SHA recording, dry-run/validate `\|\| true` removed, report path constant pinning, etc.) |
| R4 | `89624a95b` | `normalizeRoot()` trims leading/trailing slashes (cloud P1 — `docs/community/`.startsWith(`docs/community//`) false-blocked every file under trailing-slash roots) |
| R4 | `99fd66efe` | `report.targetHead` resolved to SHA via `git rev-parse` (was 'HEAD' string); dry-run/validate gates pass `--head-ref HEAD` (was missing); binary detection via extension + NUL-byte sniff (binary-block mode was unreachable from sync runs) |
| R5 | `bafeadaaa` | Extract FS/path/binary helpers to `check-sync-public-delta-gate-fs.mjs` (CLI: 464 → 292 lines, 350 hard limit honored); production gate now passes `$SOURCE_SYNC_DIR` not `$SOURCE_DIR` (sourceHead now identifies exported bytes); dry-run gate forwards `DELTA_GATE_TARGET_OWNED_ARGS` (parity with production) |
| R6 | `9bf6cf7b9` | Extract CLI test fixtures to `check-sync-public-delta-gate-cli-fixtures.mjs` (test: 435 → 332 lines) |

## Tradeoff (delta-specific)

- **`$SOURCE_SYNC_DIR` semantic split**: For full sync `SOURCE_SYNC_DIR` = detached
  worktree @ `origin/main` (its HEAD == exported bytes). For dry-run/validate where
  `prepare_source_sync_tree()` is skipped, `SOURCE_SYNC_DIR` falls back to
  `SOURCE_DIR` via line 445. All 3 gate sites uniformly use `$SOURCE_SYNC_DIR` —
  it's the right pointer in every case but the "fall back" semantics is worth a
  fresh look from your side.
- **`isBinaryPath` extension allowlist**: 50 extensions covering images / fonts /
  archives / audio / video / executables / design / office. NUL-byte sniff (first
  8KB) as fallback. Coverage gap = unusual binary formats not in the list — they
  fall through to NUL-byte sniff which is git's own heuristic. Acceptable for V1?
- **CLI 292 lines / test 332 / fixtures 117 / fs 193**: Splits chose function
  (CLI orchestration vs FS helpers vs test fixtures) not size — happy to reconsolidate
  if you think the split is artificial.

## Architecture Ownership

Architecture cell: open-source sync pipeline extension (no new cell)
Map delta: none (still pure orchestration wire + extracted helpers)

## Please check

- **3-way enumeration correctness** in `buildItems` (cli.mjs:153-203 after split):
  union of (target `ls-tree` ∪ filtered-dir walk) and per-path blob lookup; baseline-only
  paths land via classifier's null-handling.
- **Bash wire ordering**: production gate runs after Step 5b validation passes, BEFORE
  Step 5c real rsync, OUTSIDE the `--skip-validate` block (so `--skip-validate` cannot
  bypass delta gate). Production gate guarded by independent `SKIP_DELTA_GATE` flag.
- **`SOURCE_SYNC_DIR` semantics**: full sync uses detached worktree @ origin/main;
  dry-run/validate fall back to SOURCE_DIR via line 445.
- **AC-A5 historical replay deferral**: this PR's test uses synthetic clowder-ai#723
  pattern (target-revert scenario). Real `#720 head=c3376252 merge=89cc0f22` replay is
  Task 4b separate PR (deferred — reconstructing 6-week-old state is its own scope).

## 自检证据

### Spec 合规

- Feature: `docs/features/F251-public-delta-preservation-gate.md`
- Plan: `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
- Scope verdict: Task 4a sync wire + helper splits + cloud-found bug fixes. AC-A1/A2/A3
  now wired (production sync invokes gate before real rsync). AC-A5 still UNCHECKED
  pending Task 4b. AC-A4 override still deferred (current path = `--skip-delta-gate` +
  CVO sign-off in PR body; override-with-reason is Task 4c).

### 测试结果

```bash
node --test scripts/check-sync-public-delta-gate.test.mjs \
            scripts/check-sync-public-delta-gate-cli.test.mjs \
            scripts/check-sync-public-delta-gate-wire.test.mjs
# tests 59, pass 59, fail 0

bash -n scripts/sync-to-opensource.sh
# syntax OK

pnpm biome check scripts/check-sync-public-delta-gate-{cli,fs,cli.test,cli-fixtures,wire.test}.mjs
# clean
```

File line counts (all ≤ 350):
- `check-sync-public-delta-gate-cli.mjs`: 292
- `check-sync-public-delta-gate-fs.mjs`: 193
- `check-sync-public-delta-gate-cli.test.mjs`: 332
- `check-sync-public-delta-gate-cli-fixtures.mjs`: 117
- `check-sync-public-delta-gate-wire.test.mjs`: 333

### 如果判断错了我最可能错在哪

1. **`$SOURCE_SYNC_DIR` fallback covers all real-sync paths**: I'm trusting that line
   445 `SOURCE_SYNC_DIR="$SOURCE_DIR"` runs before any gate site sees it. If there's a
   bash flow where SOURCE_SYNC_DIR is empty/unset at a gate site, the `git -C ''
   rev-parse HEAD` would fail. The unit tests pass `--source-dir` explicit so they
   don't catch this — would need a bash integration test to verify.
2. **Binary extension allowlist coverage**: 50 entries cover common cases but not
   exhaustive. If you spot a likely-binary extension I missed, easy add.
3. **CLI/test/fixtures split as 3 files might be over-split** — consolidating fixtures
   into the test file would put us back over 350 only by ~20 lines if I trim verbose
   comments. Open to reconsidering if you think it's wrong-shape.

### Provenance for cross-review framing

This is a **same-family delta cross-review** (布偶猫 author / 缅因猫 reviewer of
record, continuity criterion). Per `feedback_reviewer_cost_routing.md` codex(砚砚)
costs 2x gpt52 — chose 砚砚 here for context-continuity not safety; safety guarantee
came from cloud R3-R6 sequence. If you'd rather route to gpt52 for cost, say so and
I'll re-route.

[宪宪/Opus 4.7🐾]
