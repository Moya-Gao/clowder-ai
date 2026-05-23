# Review Request: F203 #748 SOP Stage Externalization

Review-Target-ID: f203
Branch: feat/f203-sop-stage-externalization
Commit: latest branch HEAD after rebase and review-fix

## What

Implemented the #748 upstream slice: `SopDefinition` is now a YAML-backed single source of truth for the development SOP stages, with predicate metadata for the future `eval:sop` closure but no evaluator runtime in this change.

- Added `sop-definitions/development.yaml`, three schema-only cross-domain stubs, validator/codegen scripts, and generated runtime TS.
- Ported all 18 old `manifest.yaml:sop_navigation` rules into `development.yaml`; removed the manifest duplicate.
- Added `sopDefinitionId` to `WorkflowSop`, with old records defaulting to `development`.
- Runtime hints now resolve `nextSkill` as manual override; otherwise use the definition-sourced `suggestedSkill`.
- API, callback route, MCP tool schema, thread context, Mission Hub UI, and system prompt briefing now expose/use definition-vs-override skill source.
- Aligned `docs/SOP.md`, `BOOTSTRAP.md`, and SOP skills with `writing-plans -> worktree -> tdd`.
- Fixed a scheduler-sensitive `tmux-agent-spawner` timing test that full `pnpm test` exposed as flaky under load.

## Why

#748 identified that SOP stage vocabulary and navigation rules were split across docs, code unions, and dead `sop_navigation` manifest data. The fix keeps the #748 goal primary: one machine-readable SOP definition for development, with the predicate fields retained as the bridge into F192 Phase E-sop after this change merges.

## Original Requirements

> "你直接和砚砚brief讨论吧 不过你别忘记你的初心是 #748 然后我们新增的f192 的e 是我们的其中一个闭环"
> "fold 上面 4 个 clarification 进 plan，写正式 implementation plan..."
> "#748 本轮 in-scope... `sop-definitions/development.yaml`... 18 rules port... sopDefinitionId seam..."

- 来源：thread `thread_mp6b68w9w0wt1boc`, messages `0001779527665682-000331`, `0001779528157460-000338`, `0001779527851062-000334`; plan `docs/plans/2026-05-23-F203-sop-stage-externalization.md`
- 请对照上面的摘录判断交付物是否解决了 #748，而不是提前实现 F192 eval runtime。

## Tradeoff

- `domain` remains an open string for future categorization; `id` is the generated runtime registry key.
- Stubs validate schema only and are excluded from runtime codegen, avoiding fake multi-domain runtime support.
- `manual_only` predicates are explicit `not_evaluable` source material for future eval, not pass/fail guards today.
- `feature_owner` owner variant was removed for this slice; rule owners default to `stage_suggested_skill` with optional explicit `skill`.
- `nextSkill` remains a manual override for compatibility; null means "use definition suggestion".
- Generated TS is kept complete but compacted by codegen formatting; no runtime metadata was dropped to satisfy line limits.

## Architecture Ownership

Architecture cell: `harness-eval`
Map delta: update required (anchors only, no boundary)
Why: This change adds `SopDefinition` as predicate-backed SOP expectation source material for future F192 `eval:sop`, so the existing `harness-eval` cell needs new anchors; it does not add a new eval domain, adapter, store, router, dispatcher, queue, or ownership boundary.

Please check:
- diff matches `Map delta: update required (anchors only, no boundary)`
- no new parallel Store / Queue / Router / Adapter / Dispatcher / Binding was introduced
- `sopDefinitionId` is a seam on the existing WorkflowSop path, not a second SOP runtime

## Open Questions

### 技术 OQ

1. Generated code shape: `sop-definition.generated.ts` is now 301 lines after compact short-object formatting. Is the codegen helper boundary (`scripts/lib/sop-definition-codegen.mjs`) clean enough, or should rendering be simplified further before merge?
2. Predicate schema: the seven predicate types are schema-only today. Please check whether any of the 18 ports have misleading predicate semantics, especially `manual_only`, `command_sequence`, and `handle_check`.
3. Routing semantics: confirm `nextSkill` override vs definition-sourced suggestion is correctly represented across REST, MCP, thread context, Mission Hub, and `SystemPromptBuilder`.
4. Docs/skills alignment: confirm `writing-plans -> worktree -> tdd` is consistently reflected and no stale `sop_navigation` source remains.
5. Flake fix: confirm the `tmux-agent-spawner` timeout change is a valid test stabilization and not masking behavior.

### 价值 OQ

无。F192 eval runtime remains explicitly out-of-scope for this #748 slice.

## Next Action

Please review the branch. If approved, I will run merge-gate: PR creation, cloud review, squash merge, Phase doc sync, and then downstream outbound sync to clowder-ai.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f203/opus47`
- Start Command: `pnpm review:start`
- Suggested ports: `web=auto`, `api=auto` via review sandbox; do not use 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规

- All 18 `sop_navigation` hard rules/pitfalls are ported into `sop-definitions/development.yaml`.
- Runtime codegen includes only `development`; `video-cocreation`, `tech-article`, and `family-office` remain schema-only stubs.
- `sopDefinitionId` defaults to `development` for old records.
- Mission Hub differentiates `定义建议` from `手动 override`.
- F192 eval runtime / predicate evaluator / verdict handoff are not implemented in this slice.

### 测试结果

Final-post-codegen checks:

```bash
pnpm check
pnpm check:sop-definitions
pnpm biome check scripts/sop-definitions.mjs scripts/lib/sop-definition-codegen.mjs scripts/sop-definitions.test.mjs packages/shared/src/types/sop-definition.generated.ts --diagnostic-level=error
pnpm --dir packages/shared build && pnpm --dir packages/api build && pnpm --dir packages/mcp-server build
git diff --check
```

Earlier full gate evidence from this same worktree before final generated formatting compaction:

```bash
pnpm test
pnpm lint
pnpm -r --if-present run build
pnpm check:architecture-ownership
node scripts/check-fallback-layers.mjs
```

Frontend dogfood:

- Started worktree dev server with real Redis on API `3142`, web `5142`, Redis `6358`.
- Created a real backlog item and `WorkflowSop`.
- Verified Mission Hub SOP panel first showed `定义建议：writing-plans`.
- Updated `nextSkill` to `worktree`; verified reload showed `手动 override：worktree`.
- Playwright console: 0 errors; `/workflow-sop` API endpoint fetched.
- Stopped server; `lsof` confirmed no listeners left on 3142/5142/6358.

Artifact hygiene:

- No root media/design artifacts in git status or diff.
- No matching `.pen` artifacts for F203 / SOP / stage / workflow.

### 相关文档

- Plan: `docs/plans/2026-05-23-F203-sop-stage-externalization.md`
- Feature: `docs/features/F203-native-system-prompt-l0.md` (#748 routing note / F192 E-sop relationship)
- SOP definition: `sop-definitions/development.yaml`
