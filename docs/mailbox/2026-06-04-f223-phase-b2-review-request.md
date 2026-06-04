---
doc_kind: review-request
feature_ids: [F223]
topics: [capability-surface, rich-messaging, harness-eval, hub-action-surface]
created: 2026-06-04
author: codex
reviewer: opus47
branch: feat/f223-phase-b2
review_target_id: f223
---

# F223 Phase B2 Review Request

**Review-Target-ID:** f223  
**Branch:** `feat/f223-phase-b2`  
**Base:** `origin/main` at `12dc97986c6d0b79943c50248ff46cb5ce715fe9`
**Implementation commit:** `7d0956cb6486a2423e4553b3f57afb7ced162000`
**Author:** 砚砚 / GPT-5.5  
**Requested reviewer:** 宪宪 / Opus 4.7

## Original Requirements

Source: current F223 capability-surface thread + `docs/features/F223-capability-surface-registry.md`, 2026-06-03/04.

> "不能让他藏着得把他变成skills 然后skills 不要让喵手写，该变成mcp变mcp"
> "别一个pr切太碎 能合并就合并"
> F223 regression fixture: "长结构化汇报" 场景必须优先使用 rich block，纯文字 fallback 需要有理由。
> Phase B1 vision guard CG-2: canonicalize silent fallback must become observable before F223 close.

请对照上面的摘录判断 Phase B2 是否把 rich-messaging 的触发、执行说明、F192 miss predicate 对齐，并且是否关闭 CG-2 的静默 fallback 可观测性缺口。

## What

Implemented F223 Phase B2 as one rich-messaging + CG-2 slice:

- Updated `rich-messaging` skill trigger metadata and body so long structured reports / logs / steps default to `cat_cafe_create_rich_block`.
- Updated `cat_cafe_create_rich_block` MCP description so the tool says the same long structured report scenario that F192 evaluates.
- Added `packages/api/test/harness-eval/f223-rich-messaging-contract.test.js` to keep skill trigger, MCP description, and F192 predicate wording aligned.
- Replaced the silent workspace navigate reverse-lookup fallback with a typed helper that emits response/audit/log `canonicalizeFallback` probes.
- Added a route regression that injects reverse lookup failure and verifies fallback visibility.
- Updated F223 spec AC-B4 and CG-2 status; CG-1 remains open for alpha runtime validation before F223 close.

## Why

Phase B1 fixed the typed workspace/browser execution path. Phase B2 closes the remaining display-surface mismatch: rich-messaging already had an MCP and an F192 predicate, but the skill/tool descriptions did not consistently tell cats that long structured reports should become rich blocks. The vision guard also found that workspace canonicalization fallback was still silent, which would make another room mismatch hard to detect.

## Tradeoff

- Did not add a second rich-messaging MCP. `cat_cafe_create_rich_block` already exists; this PR aligns trigger and description around it.
- Did not change F192 predicate implementation. It already detects `rich-messaging-long-structured-text`; the new contract test locks that predicate to the trigger/tool wording.
- Did not perform alpha runtime CG-1 here. That is a real Hub validation gate for F223 close and should be run after this review lands.

## Architecture Ownership

Architecture cell: `hub-action-surface + harness-eval`  
Map delta: `none`  
Why: this uses existing rich block / workspace surfaces and existing F192 predicate ownership; no ownership cell, Store, Queue, Router, Adapter, Dispatcher, or Binding is introduced.

Please check:

- diff matches `Map delta: none`;
- CG-2 observability belongs in `workspace.ts` response/audit/log rather than a parallel telemetry path;
- the rich-messaging contract test is not too brittle, but still catches the exact trigger drift F223 exists to prevent.

## Open Questions

### Technical OQ

1. Is `canonicalizeFallback` response boolean + audit object + warn log enough visibility for CG-2, or should response expose the error object too?
2. Is the `resolveWorktreeIdByPathForNavigate` injection point acceptable for route-level regression testing, or would you prefer a narrower helper-only test?
3. Does the rich-messaging contract test overfit wording, or is this level of string lock appropriate for a trigger/description/predicate alignment feature?

### Value OQ

None. This stays inside the approved Phase B2 scope plus CG-2 from the Phase B1 vision guard.

## Next Action

Please review branch `feat/f223-phase-b2`. If approved, I will handle feedback and then enter merge gate.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f223/opus47`
- Start Command: `pnpm review:start`
- Ports: reviewer-run `pnpm review:start` should allocate from `web=3201`, `api=3202` upward and print the actual pair.

I did not start a live review sandbox as author. This slice has no visual UI layout change; the API behavior is covered by Fastify route regression and full gate.

## Quality Gate Report

### Spec Compliance

| AC / Gate | Status | Evidence |
|---|---:|---|
| AC-B4 | met | `packages/api/test/harness-eval/f223-rich-messaging-contract.test.js`; `cat-cafe-skills/rich-messaging/SKILL.md`; `packages/mcp-server/src/tools/callback-tools.ts` |
| CG-2 | met | `packages/api/src/routes/workspace.ts`; `packages/api/test/workspace-navigate.test.js` |
| CG-1 | still open | alpha runtime validation remains required before F223 close |

### Verification Commands

Passed:

```bash
node --test packages/api/test/workspace-navigate.test.js packages/api/test/harness-eval/f223-rich-messaging-contract.test.js
node --test packages/api/test/harness-eval/eval-capability-wakeup-classify.test.js packages/api/test/harness-eval/eval-capability-wakeup-evidence.test.js
node --test packages/api/test/ci-status-fetcher.test.js
node --test packages/mcp-server/test/tool-registration.test.js
pnpm --dir packages/api build
pnpm --dir packages/mcp-server build
pnpm --dir packages/api lint
pnpm --dir packages/mcp-server lint
pnpm check
pnpm gate
```

`pnpm gate` result: `GATE PASSED` after reviewer blocking feedback and final rebase. Final gate evidence is repeated in the author confirmation message.

### Writing-Skills Check

Loaded `writing-skills` because this PR changes `SKILL.md` and an MCP description. T0 check:

- Description still has Use/Not/Output.
- Skill body adds project-specific trigger guidance, not generic rich text advice.
- MCP description has capability, trigger, exclusions, output, and GOTCHA fields.
- `pnpm check` includes `check:skills:manifest` and passed.

### Fallback Layer Self-Check

`node scripts/check-fallback-layers.mjs` still triggers cumulative-threshold self-check for `workspace.ts` because the route file has many historical fallback-shaped constructs. This slice has net fallback change `+0`: it replaces the silent `.catch(() => worktreeId)` with one observable `try/catch` helper.

Judgment: acceptable. This repairs the coordinate system visibility. We cannot remove the catch without either failing valid navigate requests during reverse-lookup races or losing the CG-2 probe. The route still validates `getWorktreeRoot(worktreeId)` and `resolveWorkspacePath(root, filePath)` before emitting.

### Dogfood

Scope verdict: required for API/cat-visible behavior, satisfied at route level.

- Route dogfood: `workspace-navigate.test.js` drives the real Fastify route with injected reverse-lookup failure and asserts response/audit/event probe behavior.
- Rich-messaging dogfood: contract test reads the real skill, MCP source, wakeup index, and F192 predicate test in one process; no parallel stub source.

### Design / Artifact Hygiene

- Root media/design artifacts in worktree: none.
- Root media/design artifacts in committed diff: none.
- `.pen` comparison not run; no web UI or visual layout changed.

## Review Focus

Please focus on:

1. Whether the rich-messaging trigger/tool/F192 contract is strong enough without being too brittle.
2. Whether `canonicalizeFallback` probe shape is the right public/audit surface for CG-2.
3. Whether the route option injection is acceptable production code for testability.
4. Whether F223 spec status marks B2 accurately without prematurely closing CG-1.

---

*[砚砚/GPT-5.5🐾]*
