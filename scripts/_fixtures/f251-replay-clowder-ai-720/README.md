# F251 Task 4b — clowder-ai#720 Historical Replay Fixture

> **DO NOT REGENERATE WITHOUT VERIFYING.** This fixture freezes the 3-way byte-state
> of the real `clowder-ai#723` regression for AC-A5 anti-placebo validation. If you
> re-extract, manually diff `manifest.json` provenance fields to confirm the merge
> SHA / parents / baseline ref point at the same commits.

## Anchor incident

- **clowder-ai issue**: [#723](https://github.com/zts212653/clowder-ai/issues/723) — "Console 视觉审计：#720 同步覆盖了 F190 设计实现（17 项回退）"
- **Reporter**: `mindfn` (吴浪)
- **Class**: C1a + C3 compound (target had community delta from PRs #662 + #669, sync overwrote with older version)
- **Severity**: 教科书级 — `2 P1 + 10 P2 + 5 P3` visual regressions
- **Bad sync PR**: `clowder-ai#720` (squash merge `89cc0f220936d863cbb571bd51ff94e6d7efe583`, 2026-05-19 08:18 UTC)
- **Ledger entry**: `docs/ops/community-sync-incident-ledger.json` issueId 723

## 3-way byte-state

`89cc0f220` is a squash-merge (one parent), so the 3-way state is reconstructed via:

| Side | Ref | What it represents |
|------|-----|-------------------|
| `base` | `sync/2026-05-06-183113` → `ddaca35469db900d4dbbf106250f0390b0203de5` | Previous landed sync on clowder-ai (13 days before bad sync) |
| `theirs` | `89cc0f220^1` → `373b4bdd4910d4c8140069b0643de4e4ec64f87d` | clowder-ai main right before #720 — has community PRs #662 + #669 with the F190 17 items |
| `ours` | `89cc0f220` itself | What the bad sync PR wrote (the bytes that landed on main, erasing the F190 items) |

## Affected paths (23 total)

Enumerated from `clowder-ai#723.evidence.affectedPaths` (3 concrete files + 3 `**` globs
expanded against the `theirs` commit at extraction time):

- 3 concrete: `AppShell.tsx`, `ChatContainer.tsx`, `HubListModal.tsx`
- 0 under `packages/web/src/components/voice/` (not present at theirs time)
- 19 under `packages/web/src/components/settings/`
- 0 under `packages/web/src/components/skills/`
- HubListModal exists at base + ours but not theirs (community removed it — sync would recreate)

Of the 23 paths:
- **20 must BLOCK** when replayed through the gate:
  - 18 `base=null, theirs/ours differ` (community added files; sync writes different bytes — conflict)
  - 1 `all three differ` (ChatContainer.tsx — full 3-way divergence)
  - 1 `theirs=null, base/ours present` (HubListModal — sync recreates a target-deleted file)
- **3 skipped** (no-delta): MarketplaceContent.tsx / SettingsPlaceholder.tsx / settings-nav-config.ts (theirs == ours, so the classifier short-circuits)

## Hermeticity (KD-8)

This fixture is committed as **frozen bytes** under `base/`, `theirs/`, `ours/`. The
replay test stages 3 synthetic git repos from these trees, runs the CLI offline
(`--no-fetch`), and asserts BLOCK. CI never touches the live clowder-ai repo —
guarantees:
- Test result does NOT depend on clowder-ai's current branch state
- Re-extraction is an explicit operator action with manual provenance check
- No network during test run

## Re-extraction (rare, manual)

```bash
node scripts/extract-historical-sync-fixture.mjs \
  --clowder-ai-dir /path/to/clowder-ai \
  --out scripts/_fixtures/f251-replay-clowder-ai-720
```

After re-extraction:
1. `git diff scripts/_fixtures/f251-replay-clowder-ai-720/manifest.json` — provenance fields MUST be unchanged unless you're explicitly retargeting a different incident
2. `git diff scripts/_fixtures/f251-replay-clowder-ai-720/{base,theirs,ours}` — byte changes must be explainable by clowder-ai history rewrite (unlikely on a public repo)
3. Run replay test: `node --test scripts/check-sync-public-delta-gate-replay.test.mjs` — must still BLOCK

## Why frozen instead of live fetch

| Approach | Pros | Cons |
|---------|------|------|
| **Frozen (chosen)** | Hermetic, deterministic, CI-friendly, audit-trail in git | Re-extraction adds operator step; storage cost (~few MB) |
| Live clone in test | Always current | CI flakiness, network dependency, test result coupled to clowder-ai branch state |
| Git submodule pinned to commit | Pin is explicit | Adds submodule complexity; same storage cost |

Frozen wins for AC-A5: the value is "would the gate have caught the documented
event," which is a fixed historical fact — there's nothing to keep current.
