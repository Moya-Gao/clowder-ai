---
feature_ids: [F210]
topics: [antigravity-cli, agy, cache, profile-sandbox, workspace-hygiene]
doc_kind: bug-report
created: 2026-06-02
status: open
severity: P2
owner: codex
---

# Bug Report: F210 AGY project registry cache leaks into repo root

> Reporter: 砚砚 / Codex, after root hygiene self-check in an unrelated thread
> Severity: P2. This does not corrupt Redis or Cat Cafe business state, but it pollutes the git worktree and can recur whenever AGY runs without a fully pinned profile/cache home.
> Current status: root-cause candidate identified; no fix applied in this report.

## Symptom

A new untracked file appeared under the Cat Cafe repo root:

```text
cache/projects.json
```

The file is not tracked by git and is not ignored by the current `.gitignore` rules:

```text
$ git status --short -- cache/projects.json
?? cache/projects.json

$ git ls-files --stage -- cache/projects.json
<empty>

$ git check-ignore -v cache/projects.json
<empty>
```

Its content is a project path to UUID registry entry:

```json
{
  "/Users/lysander/projects/relay-station/cat-cafe": "03ec66cd-ce3c-4262-b882-53028b26cc2f"
}
```

## Evidence

The same UUID is present in the Antigravity CLI cache:

```json
{
  "/Users/lysander/projects/relay-station/cat-cafe": "03ec66cd-ce3c-4262-b882-53028b26cc2f",
  "/tmp": "68022d68-dcdc-49c7-b6c7-0a0ed2c3cbc1",
  "/tmp/agy-rt-work": "7104c684-1a29-413d-8c4c-0bec6089d8dd",
  "/tmp/agy-slow-work": "fd6e7730-b935-4dac-87a7-d580c99db757",
  "/tmp/agy-spike-work": "cc19101e-16df-4bc4-92ba-0774645e5828"
}
```

Source file:

```text
/Users/lysander/.gemini/antigravity-cli/cache/projects.json
```

Timestamps also align:

```text
/Users/lysander/.gemini/antigravity-cli/cache/projects.json
  birth=Jun  1 20:14:32 2026
  mtime=Jun  2 21:54:08 2026

cache/projects.json
  birth=Jun  2 21:54:18 2026
  mtime=Jun  2 21:54:18 2026
```

Only three `projects.json` files were found in the relevant local search:

```text
/Users/lysander/.gemini/projects.json
/Users/lysander/.gemini/antigravity-cli/cache/projects.json
/Users/lysander/projects/relay-station/cat-cafe/cache/projects.json
```

Current runtime code makes this an F210 surface:

- `GeminiAgentService` defaults to `antigravity-cli`, i.e. `agy`.
- `invokeAntigravityCLI` spawns `agy` with `cwd: workingDirectory`.
- If `agyProfile` is present, Cat Cafe sets `HOME` to the isolated profile home.
- If `agyProfile` is absent, the child inherits the ambient home/account/callback environment.
- `resolveAgyAppDataDir(childEnv)` treats AGY app data as `${childEnv.HOME ?? homedir()}/.gemini/antigravity-cli`.

Relevant code:

- `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`
- `packages/api/src/domains/cats/services/agents/providers/agy-profile-manager.ts`
- `packages/api/src/domains/cats/services/agents/providers/agy-trajectory-observer.ts`

`cat-config.json` currently defines `gemini` and `gemini25` variants without `agyProfile`, even though F210 Phase G introduced profile sandboxing for deterministic AGY routing.

## Root Cause Candidate

AGY maintains a project registry at:

```text
~/.gemini/antigravity-cli/cache/projects.json
```

During an invocation around 2026-06-02 21:54 America/Los_Angeles, AGY updated its normal registry and also wrote an isomorphic registry file to the repository working directory:

```text
./cache/projects.json
```

The most plausible explanation is that one AGY path resolved a cache or project-registry directory relative to the current working directory instead of the intended AGY app data dir. Because Cat Cafe launches `agy` with `cwd` set to the project worktree, the fallback relative `cache/` path landed in the repo root.

This report does not prove whether the relative path is in upstream AGY itself, a Cat Cafe wrapper/env leak, or an AGY profile/config edge case. It does prove the leaked file is AGY-shaped, AGY-timed, and AGY-correlated.

## Impact

- Pollutes the repo root with untracked files.
- Triggers Cat Cafe root hygiene self-checks.
- Can confuse future dirty-worktree gates or human review.
- Risks recurring whenever `antigravity-cli` runs without a deterministic profile/cache home.
- Does not appear to touch Redis, Cat Cafe persisted user data, or tracked business files.

## Expected Behavior

Running any Cat Cafe AGY-backed cat should not create untracked files in the repository root.

AGY project registry/cache state should live under either:

```text
~/.gemini/antigravity-cli/cache/
```

or an explicit Cat Cafe profile sandbox such as:

```text
~/.cat-cafe/agy-profiles/<profile-id>/.gemini/antigravity-cli/cache/
```

## Actual Behavior

AGY registry state leaked into:

```text
/Users/lysander/projects/relay-station/cat-cafe/cache/projects.json
```

## Suggested Fix

Prefer a real F210 fix over adding `cache/` to `.gitignore`.

1. Ensure all `antigravity-cli` invocations use `agyProfile` or an equivalent explicit HOME/app-data sandbox.
2. Add a regression test that launches the AGY adapter with a fake `agy` binary that writes to its resolved cache path, then asserts repo-root `cache/projects.json` is not created.
3. Add config coverage for `gemini` / `gemini25` so production variants do not run AGY from shared or ambiguous app-data state.
4. Keep the root hygiene self-check noisy for this path until the underlying leak is fixed.

Ignoring `cache/` would hide the symptom and allow AGY state bleed to continue unnoticed.

## Verification Plan

After the fix:

1. Remove the leaked file locally:
   ```bash
   rm -rf cache
   ```
2. Invoke an AGY-backed cat from the Cat Cafe repo root.
3. Confirm:
   ```bash
   test ! -e cache/projects.json
   git status --short -- cache
   ```
4. Confirm AGY state lands only under the intended app-data or profile path.

## Notes for F210 Owner

This looks adjacent to F210 Phase G/H rather than a general worktree hygiene bug because F210 owns:

- the `antigravity-cli` default switch,
- AGY profile sandboxing,
- AGY app-data path derivation,
- and the current user-facing Gemini/Gemini25 AGY path.

The leaked file was intentionally left in place during initial triage to preserve forensic evidence.
