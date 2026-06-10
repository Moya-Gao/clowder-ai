---
title: "Review Request: clowder-ai#889 CLI supervisor env-file args"
date: 2026-06-10
type: review-request
review_target_id: clowder-889
branch: fix/clowder-889-cli-supervisor-env-file
---

# Review Request: clowder-ai#889 CLI supervisor env-file args

Review-Target-ID: clowder-889
Branch: `fix/clowder-889-cli-supervisor-env-file`
Commit: `12d2941b5`

## What

- Added `sanitizeCliSupervisorExecArgv()` in `packages/api/src/utils/cli-spawn.ts`.
- TS source fallback now keeps safe Node loader/debug flags but drops cwd-sensitive `--env-file` and `--env-file-if-exists` flags before spawning `cli-supervisor.ts`.
- Regression coverage added near existing `resolveCliSupervisorNodeArgs()` tests:
  - source TS fallback drops inline and split env-file forms;
  - built JS path still returns only `[supervisorPath]` and does not inherit execArgv.

## Why

`defaultSpawn()` runs the supervisor under `options.cwd`, which is the thread project path. In dev/tsx mode, inheriting the API runtime's relative env-file flags means Node resolves `.env` against an external project and exits before the supervisor starts.

## Original Requirements

> Filter `--env-file` from `execArgv` in the `.ts` fallback path.
> Please handle both `--env-file=...` and split `--env-file ...` forms.
> Add regression coverage around `resolveCliSupervisorNodeArgs()`.
> Keep safe loader flags like `--import tsx` but drop API-local env-file flags.

- Source: clowder-ai#889 public triage comment
- Please verify this solves the reported external-project `exit 9` failure without breaking source TS fallback or built JS preference.

## Tradeoff

I did not change supervisor cwd. That would make the supervisor start from the API package but would also change the supervised CLI's effective project cwd unless we expanded the supervisor protocol to pass a separate child cwd. Filtering API-local Node flags at the supervisor boundary is narrower and preserves existing CLI cwd behavior.

## Architecture Ownership

Architecture cell: dispatch
Map delta: none
Why: This changes a process invocation boundary helper, with no new Store / Queue / Router / Adapter / Dispatcher / Binding and no ownership boundary change.

Reviewer focus:
- Confirm `Map delta: none` matches the diff.
- Check whether filtering both env-file flag families is sufficient for Node v24 dev mode.
- Check that preserving loader flags is correct for TS fallback.

## Open Questions

### 技术 OQ（给 reviewer）

- Should the sanitizer also strip any other cwd-sensitive Node runtime flags, or should this remain narrowly scoped to env-file flags for clowder-ai#889?

### 价值 OQ（给 CVO）

无。

## Next Action

Please review the two-file diff and either approve or request changes. After approval, proceed to merge-gate / outbound sync for clowder-ai#889.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/clowder-889/opus`
- Start Command: no web/API server needed; run the verification commands below from the review sandbox.
- Ports: none.

## Quality Gate Report

### Scope

Bugfix for user-visible CLI invocation failure on external project threads. No frontend, no Redis, no persistence schema, no public API contract change.

### TDD Evidence

- RED: `pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/cli-spawn.test.js`
  - Expected failure observed: new env-file test failed because actual args still contained `--env-file=.env`, split `--env-file .env.local`, `--env-file-if-exists=...`, and split `--env-file-if-exists ...`.
- GREEN: same command passed after implementation: `78` tests, `0` failures.

### Verification

- `pnpm --filter @cat-cafe/api run lint`: passed.
- `pnpm check`: passed, all 22 checks.
- `pnpm -r --if-present run build`: passed. Existing web lint warnings were emitted, unrelated to this API diff.
- `git diff --check`: passed.
- Root artifact hygiene:
  - `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true`: no output.
  - `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true`: no output.

### Dogfood-Your-Slice

Scope verdict: required, because this fixes a user-visible CLI invocation failure.

End-to-end path:
- Build `dist`.
- Resolve source TS supervisor args with real absolute `tsx` loader flags plus inherited env-file flags.
- Spawn the real supervisor under a temporary external cwd with no `.env`.
- Supervisor starts child Node successfully.

Observed output:

```json
{"status":0,"signal":null,"stdout":"supervisor-ok","stderr":""}
```

### Fallback Layer Check

`node scripts/check-fallback-layers.mjs` triggered because `packages/api/src/utils/cli-spawn.ts` already has high cumulative fallback count; this patch adds one inline-form branch.

Self-check:
- This repairs the coordinate system: env-file flags are parent API runtime configuration, not supervisor child runtime configuration.
- Changing cwd would be the wrong coordinate transform because the supervised CLI must still run in the thread project cwd.
- The split-form branch is needed to drop the following value; the inline-form branch is needed because Node accepts `--env-file=...` and `--env-file-if-exists=...`; the flag-name set is needed because Node supports both env-file variants.

### Architecture Ownership Check

`pnpm check:architecture-ownership`: exit 0. Existing repository warnings were reported, but `OK diff architecture nouns` passed for this diff.

## Related

- Source issue: https://github.com/zts212653/clowder-ai/issues/889
- Public triage comment: https://github.com/zts212653/clowder-ai/issues/889#issuecomment-4666544872
