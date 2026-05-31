---
doc_kind: review-request
created: 2026-05-31
feature_ids: [F210]
topics: [antigravity, agy, phase-g, model-selection, review-request]
author: codex
reviewers: [opus]
---

# Review Request: F210 Phase G — AGY Model Selector Recon

Review-Target-ID: f210
Branch: feat/f210-agy-model-selector-smoke
Commit: d550592f5

## What

This is a docs-only Phase G truth-source sync for AGY model selection after PR #2004:

- Adds `docs/features/assets/F210/phase-g-agy-model-selector-recon-2026-05-31.md`.
- Records current AGY 1.0.3 model availability from official docs plus local read-only probe evidence.
- Records the exact AGY CLI settings surface: `~/.gemini/antigravity-cli/settings.json` key `model`.
- Records production selector labels for the F210 target families:
  - `Claude Opus 4.6 (Thinking)`
  - `Gemini 3.1 Pro (High)`
  - `Gemini 3.5 Flash (High)`
- Updates `docs/features/F210-antigravity-cli-migration.md` to close AC-G1 only.
- Keeps AC-G2 and AC-G6 open.

## Why

After PR #2004, F210 still needed the current selector truth source before exposing user-facing AGY profile cats. AGY still has no documented `--model` flag, so the deterministic Cat Cafe contract should be: write the intended human selector label into an isolated profile settings file, run AGY inside that profile HOME, and fail closed unless AGY logs confirm the same selected model label.

## Original Requirements

> 那我们规划一下？ 看看哪些现在agy局限下可以做的？
> 那你把这些记录到f210的md里面？

- Source: current F210 thread, CVO messages at 2026-05-31 14:14/14:20 UTC.
- Follow-up source: PR #2004 vision handoff said AC-G1/G2/G6 remain, with AC-G1 needing exact selector labels and model-selection storage surface.

## Tradeoff

- The new recon records placeholder IDs from local language-server APIs, but explicitly says they are recon evidence, not a production routing contract.
- The doc closes AC-G1 because official availability plus exact settings label surface is now recorded.
- The doc keeps AC-G2 open because user-facing per-profile Opus/Gemini cats still need live independent profile E2E smoke.
- The doc keeps AC-G6 open because language-server read-only catalog probes do not prove an interactive carrier API.

## Architecture Ownership

Architecture cell: `transport`
Map delta: none
Why: this records the verified AGY model-selection surface for the existing Antigravity CLI transport. It does not add a new adapter, router, store, queue, dispatcher, binding, ownership cell, or runtime code path.

Please check:

- AC-G1 closure is justified by the new recon evidence.
- AC-G2 and AC-G6 correctly remain open.
- Placeholder model IDs are not accidentally promoted into the production selector contract.
- The updated F210 spec remains honest about current AGY limits.
- The new recon doc is clear enough for the next implementation slice.

## Open Questions

### Technical OQ

1. Is label-based profile configuration plus post-run log verification the right deterministic contract until AGY exposes a supported per-call model selector?
2. Is the duplicate local `Gemini 3.1 Pro (High)` placeholder evidence documented with enough caution?
3. Should the next PR be live per-profile E2E smoke for AC-G2, or should AC-G6 interactive carrier spike happen first?

### Value OQ

None for this PR. User-facing AGY multi-profile exposure remains blocked on AC-G2 smoke and should come back to the CVO separately.

## Next Action

Please review the selector recon and F210 status update. If this passes, send it back for merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f210/opus`
- Start Command: not needed for this docs-only recon.
- Ports: not applicable.

## Self-Check Evidence

### Spec Compliance

- AC-G1: closed by official model availability recon plus exact AGY settings label surface.
- AC-G2: remains open for live independent per-profile smoke and user-facing exposure.
- AC-G3/G4/G5: unchanged from PR #2004.
- AC-G6: remains open for interactive carrier investigation.

### Test Results

```bash
REDIS_URL=redis://localhost:6398 pnpm check:features
# pass: check-feature-truth: features=225 backlog_active=53

REDIS_URL=redis://localhost:6398 pnpm audit:feature-docs
# pass: docs=226 green=208 yellow=15 red=3
# Generated F094 audit side effects were reverted.

git diff --check
# pass
```

### Root Artifact Gate

- `git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: no output.
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'`: no output.

## Related Files

- `docs/features/assets/F210/phase-g-agy-model-selector-recon-2026-05-31.md`
- `docs/features/F210-antigravity-cli-migration.md`

[砚砚/gpt-5.5🐾]
