---
feature_ids: [F251]
topics: [opensource, sync, gate, review, request, wire]
---

# Review Request: F251 Task 4a — Sync Pipeline Wire

Review-Target-ID: f251
Branch: feat/f251-sync-wire
Commit: 5a514f4ca

## What

Adds Task 4a for F251: orchestration layer connecting the Task 1 classifier + Task 2 baseline resolver + Task 3 report writer into `sync-to-opensource.sh`. The public delta preservation gate now **actually BLOCKS** the real target sync when sync-managed paths would erase clowder-ai target deltas.

Files:
- `scripts/check-sync-public-delta-gate-cli.mjs` (new) — CLI orchestration, 3-way enumeration, exit code contract
- `scripts/check-sync-public-delta-gate-cli.test.mjs` (new) — 6 synthetic-fixture tests
- `scripts/sync-to-opensource.sh` (modified) — `--skip-delta-gate` flag + gate invocation between Step 5b validation and Step 5c real sync

## Why

Before this PR: classifier (`606cd63d`) + resolver (`3eb52c60`) + writer (`8b94fa31`) are three disconnected library modules. `sync-to-opensource.sh` references count was **0**. F251 didn't protect any real sync.

After this PR: `sync-to-opensource.sh` runs the gate on every `--mode all` sync. If the gate finds any `target-only-would-revert-block` / `both-changed-conflict-block` / `target-added-would-delete-block` / `delete-or-rename-block` / `binary-block` path, the script `exit 1` **before** `sync_filtered_into_target "$TARGET_DIR"` (the real rsync). The expected post-sync state lives in `VALIDATION_TARGET_DIR` (post-restore), so the gate compares against the actual bytes that would land on clowder-ai.

This is the first PR where the user pain ("不下十次了" sync overwrites) gets actual machine protection in production sync runs.

## Tradeoff

- **V1 BLOCKS binary and delete/rename fail-closed.** Override flag is intentionally not wired into the CLI yet; if a sync legitimately needs to delete a target-only file, today the path is `--skip-delta-gate` + CVO sign-off documented in sync PR body. Override-with-reason is Task 4c / future hardening.
- **AC-A5 historical replay deferred to Task 4b.** This PR's tests use a *synthetic* clowder-ai#723/#720 pattern (`target-revert scenario`), proving the gate would BLOCK that pattern when wired. But the actual historical replay against real `#720 head=c3376252 merge=89cc0f22` + the matching cat-cafe export state is a separate PR. Reconstructing 6-week-old state is non-trivial and deserves its own scoped work.
- **Single-call site:** the gate runs once at line 2074 (after Step 5b temp target gate passes). I did NOT also wire it into module syncs (`SYNC_MODULE != all`) — those have a different validation flow and would be C5 sibling territory.
- **Report location:** reports land in `$SOURCE_DIR/docs/ops/` (same dir as Task 0 ledger). For dry-run / test isolation the CLI supports `--output-dir`.

## Architecture Ownership

Architecture cell: open-source sync pipeline extension (no new cell)
Map delta: none
Why: wires existing classifier/resolver/writer into existing sync pipeline; no new Store / Queue / Router / Adapter / Dispatcher / Binding.

Please check:
- 3-way enumeration in `buildItems`: union of (target `ls-tree` ∪ filtered-dir walk) and per-path blob lookup
- exit code contract: 0=pass, 1=BLOCK, 2=usage, 3=internal
- Bash wire location: between line 2073 (`run_target_public_gate` passes) and line 2075 (`cleanup_validation_target`). Uses `VALIDATION_TARGET_DIR` as `--filtered-dir` because that's the post-restore expected post-sync state.
- `--skip-delta-gate` flag mirrors `--skip-validate` semantics

## Open Questions

### 技术 OQ

1. **Module sync coverage**: Should `SYNC_MODULE != all` also run the delta gate? Today they skip Step 5b entirely, so wiring would require a separate validation prep. I chose to defer — modules are usually narrower-scope and less prone to wholesale target erasure. Acceptable for V1?
2. **`exportedHead` field**: I emit `filtered-dir:$ABS_PATH` because there's no git ref. Plan KD-7 says `exportedHead` should record "the actual candidate public byte-space tree" — is this format OK or should it be a content hash?
3. **`--dry-run` semantics**: today `--dry-run` forces exit 0 even on BLOCK so caller can inspect the report without aborting. Should it instead emit the report AND exit 1 (so caller can choose)?

### 价值 OQ

No CVO-level questions — scope and exit semantics were settled in plan KD-1..KD-7. This is reversible Task 4a implementation.

## Next Action

Please review CLI orchestration, bash wire location, and synthetic-fixture coverage. If approved, I will open PR + merge-gate. **Task 4b (real #720 historical replay)** is queued as a follow-up PR, not blocking this merge.

## Review Sandbox

No runtime needed; pure script + node:test + bash syntax.

```bash
unset NODE_ENV
pnpm install --frozen-lockfile
node --test scripts/check-sync-public-delta-gate-cli.test.mjs
node --test scripts/check-sync-public-delta-gate.test.mjs  # ensure no regression in 37 existing
bash -n scripts/sync-to-opensource.sh  # syntax check
pnpm check
```

## 自检证据

### Spec 合规

- Feature: `docs/features/F251-public-delta-preservation-gate.md`
- Plan: `docs/plans/2026-06-25-f251-public-delta-preservation-gate.md`
- Scope verdict: Task 4a only (sync wire + synthetic fixture). NOT a full F251 close. AC-A1/A2/A3 still UNCHECKED until end-to-end run in production confirms behavior; AC-A5 explicitly stays UNCHECKED until Task 4b ships.
- Dogfood: NOT exempt. This is the first PR where F251 affects production sync behavior. After merge, the next time a full sync runs with `--mode=all`, this gate runs.
- Design/Pen: no UI diff.

### 测试结果

```bash
node --test scripts/check-sync-public-delta-gate-cli.test.mjs
# tests 6, pass 6, fail 0

node --test scripts/check-sync-public-delta-gate.test.mjs scripts/check-sync-public-delta-gate-cli.test.mjs
# tests 43, pass 43, fail 0  (37 existing + 6 new)

bash -n scripts/sync-to-opensource.sh
# syntax OK
```

### Artifact Hygiene

- Root media/design artifact check: no matches
- `.review-worktrees/` retained as the existing main-worktree review sandbox; not touched

### 如果判断错了我最可能错在哪

1. `buildItems` path enumeration could miss paths if union semantics are wrong (e.g., paths that exist in baseline but neither target HEAD nor filtered tree — they should land as `delete-or-rename-block` but my union only adds `baseSet ∪ theirsSet ∪ oursSet`, so baseline-only paths ARE included). Worth double-checking.
2. `VALIDATION_TARGET_DIR` might not be exactly equivalent to post-sync state if `sync_filtered_into_target` has subtle differences when run against validation vs real target. I assumed they're identical because the same function is called.
3. `--dry-run` exit-0 semantics might be too permissive. Cloud reviewer may want a stricter contract.

Cross-review setup (opus47 implementer; OUT of reviewer role per same-family blindspot acknowledgment):
- Local peer review: codex (砚砚)
- Cloud: codex-bot (cloud Pro)
- Final-SHA verification: opus48

[宪宪/Opus 4.7🐾]
