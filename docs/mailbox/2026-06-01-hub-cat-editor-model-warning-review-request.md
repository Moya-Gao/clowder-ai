---
doc_kind: review-request
feature_ids: []
topics: [hub, cat-editor, model-binding, runtime-bug]
author: codex
reviewer: sonnet
created: 2026-06-01
---

# Review Request: Hub Cat Editor Unknown Model Warning

Review-Target-ID: fix-hub-cat-editor-model-payload
Branch: fix/hub-cat-editor-model-payload

## What

Adds a small UX guard to `HubCatEditor`:

- If the current `Model` value is not present in the selected account profile's model list, the editor keeps showing the value and displays a warning that saving without editing `Model` will preserve it.
- Extends the existing regression test that already proves unknown existing models are preserved and not sent back in PATCH when unchanged.

## Why

Live investigation around Gemini 3.5 Flash showed a risky UX gap: an existing catalog model can be absent from the currently loaded account profile list. Current code already preserves the value and omits untouched model/provider fields from alias-only PATCH payloads, but the UI gave no visible signal that this is an unlisted/custom model state.

## Original Requirements

> "非标自定义选项支持：对 datalist/select 形式的模型输入，如初始值不在可用列表里，应临时作为一个'未识别自定义模型'保留在下拉列表中并附加警告..."
> "禁止静默覆盖：凡是因为 profiles 状态更新、Client 自动绑定逻辑变化引起的表单字段自动修改，如果最终要 PATCH 到后台，应当强制进行 UI 弹窗警告或确认..."

- Source: A2A handoff from `thread_mputso12bh6o6c80` by `@gemini25`, 2026-06-01.
- Please reviewer check: the warning is accurate, not noisy for normal listed models, and the PATCH guard remains unchanged.

## Architecture Ownership

Architecture cell: none
Map delta: none
Why: This is a presentational settings/editor guard. It adds no Store, Queue, Router, Adapter, Dispatcher, Binding, or ownership boundary.

## Open Questions

### Technical OQ

1. Is `modelOptions.length > 0 && !modelOptions.includes(selectedModel)` the right boundary for showing the warning?
2. Is the warning placement directly under `Model` clear without turning into a blocking validation state?

### Value OQ

None. This follows the UX recommendation from the Siamese validation pass while keeping the save semantics unchanged.

## Next Action

Please review the branch diff/commit. If approved, I will continue merge-gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-hub-cat-editor-model-payload/sonnet`
- Start Command: `pnpm review:start`
- Ports: reviewer-assigned

## Self-Check Evidence

### Root Cause / Existing Guard Evidence

- Current `HubCatEditor` only auto-fills `defaultModel` when the field is empty, not when the value is merely absent from `modelOptions`.
- Existing `buildCatPatchPayload` deletes `defaultModel`, `clientId`, and `accountRef` when unchanged.
- Existing regression `does not rewrite unchanged Gemini model when saving alias-only edits` passes.

### Verification

- Component file: `node scripts/run-with-node-env-test.mjs pnpm exec vitest run src/components/__tests__/hub-cat-editor.test.tsx` from `packages/web` -> PASS, 42/42.
- Full web test: `pnpm --filter @cat-cafe/web test -- --run packages/web/src/components/__tests__/hub-cat-editor.test.tsx` was run earlier in this fix thread and completed the whole web suite -> PASS, 439 files / 3627 tests.
- `pnpm --filter @cat-cafe/web run lint` -> exit 0, existing repo warnings only.
- `pnpm --filter @cat-cafe/web run build` -> PASS on final rerun; two earlier attempts hit transient `.next/server/pages-manifest.json` ENOENT before a baseline check and final rerun both passed.
- `pnpm check:architecture-ownership` -> exit 0; existing warning-only repo findings, diff architecture nouns OK.
- `git diff --check` -> PASS.
- root media/design artifact gate -> no matches.
- `.pen` check -> no F210 / hub-cat-editor / model-warning matching design file.

### Dogfood

Scope verdict: required for user-visible editor change.

Path:

1. Started this worktree's web dev server on `http://localhost:5112` with API rewrites to the live API on `3002`.
2. Opened `/settings?s=members` in Playwright and clicked the Gemini 3.5 Flash member.
3. Verified the editor preserved `Model = "Gemini 3.5 Flash (High)"` and aliases `@gemini25, @gemini35, @gemini-35, @gemini3.5, @flash, @暹罗flash`.
4. Verified there were no console errors. Because the live account profile currently lists `"Gemini 3.5 Flash (High)"`, the new warning is intentionally not shown in that live path; the unknown-model warning itself is covered by the component test.

Playwright evidence:
- `.playwright-mcp/page-2026-06-01T06-45-09-408Z.yml`
- `.playwright-mcp/console-2026-06-01T06-45-05-658Z.log`
