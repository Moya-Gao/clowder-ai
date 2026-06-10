---
feature_ids: [F192]
topics: [harness-eval, capability-wakeup, review-request]
doc_kind: review_request
created: 2026-06-09
---

# Review Request: F192 byFamily truth sync

Review-Target-ID: f192-byfamily-truth-sync
Branch: fix/f192-byfamily-truth-sync

## What

Fix-forward for PR #2180 post-merge vision guard:

- removed the unconsumed `components[].byFamily` bundle snapshot field
- deleted the now-dead family breakdown helper
- kept trial-level `family` evidence in generated raw trials
- synced F192 AC-F8 / build sequence / timeline wording to the narrower truth

## Why

Opus 4.7 traced the runtime data flow and found a false closure: the live verdict generator wrote
`components[].byFamily`, but the shared bundle schema and Eval Hub read model dropped it, leaving
zero production consumers. The honest fix is to remove the decorative bundle field until the Hub
schema/UI actually consumes per-family rollups.

## Original Requirements

> "byFamily snapshot 拆分 ... 实际死代码"
> "立场：BLOCK AC-F8 closure，二选一立即修"
> "方案 A（推荐，最小诚实修）：删 live-verdict byFamily 写入 + 删 helper；同步 F192 doc"

- Source: Opus 4.7 post-merge vision guard on PR #2180, plus F192 AC-F8 truth source.
- Please verify the fix removes the false bundle-level closure without breaking the real AC-F8 path:
  omitted `sessionIds` window scan and trial-level family evidence.

## Tradeoff

Chose Option A over wiring true bundle/HUB `byFamily`:

- Phase F is coverage / sampling closure, not an Eval Hub UI schema expansion.
- A real per-family rollup should land with bundle schema + Hub read model + UI consumer in one PR.
- Keeping a field that the read model drops is worse than omitting it honestly.

## Architecture Ownership

Architecture cell: harness-eval
Map delta: none
Why: this removes a field from an existing eval bundle producer and updates tests/docs; it does not
create or move Store / Queue / Router / Adapter / Dispatcher / Binding ownership.

Please check:

- no production `byFamily` writer remains
- raw trial evidence still preserves `trial.family`
- F192 doc no longer promises bundle-level per-family rollup
- diff matches `Map delta: none`

## Open Questions

### Technical OQ

Is Option A sufficiently honest for AC-F8, given that family is still derived at the trial layer and
preserved in raw evidence, while bundle-level rollup is explicitly deferred until real Hub support?

### Value OQ

None. This is a reversible technical truth-sync fix for a post-merge guard finding.

## Next Action

Please review PR #2181-equivalent once opened. If it passes, hand back for merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f192-byfamily-truth-sync/opus47`
- Start Command: not needed; no frontend/runtime server required
- Ports: none

## Self-Check Evidence

### Spec Compliance

- F192 AC-F8 now says trial-level `family` evidence is preserved.
- F192 no longer claims `components[].byFamily` bundle snapshot split.
- AC-F9 remains open for data-driven re-eval closure.

### Test Results

```bash
pnpm --dir packages/api build
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=120000 packages/api/test/harness-eval/*capability-wakeup*.test.js
# tests 117, pass 117

pnpm check
# All 22 checks passed

git diff --check
# pass

pnpm check:features
# PASS check-feature-truth: features=235 backlog_active=61
```

Root artifact guard:

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
# no output

git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
# no output
```

### Related Documents

- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Prior PR: `#2180`
