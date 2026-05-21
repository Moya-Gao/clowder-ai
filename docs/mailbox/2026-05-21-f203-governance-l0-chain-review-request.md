---
feature_ids: [F203]
topics: [governance-l0, system-prompt, rules-sop, review-request]
doc_kind: review-request
created: 2026-05-21
related_issues: [747, 749]
---

# Review Request: F203 Phase G — Governance L0 Single Source + Consumption Chain

Review-Target-ID: f203
Branch: feat/f203-governance-l0-chain

## What

Implemented the first two upstream issues from the 747/748/749 batch:

- #747: `shared-rules.md` now compiles into the governance L0 block. Native L0 (`system-prompt-l0.md`) and `SystemPromptBuilder` fallback both consume the same compiler output. `.local.md` and `.local-override.md` now apply at the governance compile layer.
- #749: `/api/rules` now exposes prompt-consumption metadata, and the Rules & SOP panel shows whether content is `实际进 prompt`, `只是参考`, or `skill 按需加载`.
- #748 is explicitly deferred per CVO instruction.

Diff: 16 files, +1166/-359. Gate passed at `18fead50`.

## Why

The current governance rules had drift risk across three physical representations: human-readable `shared-rules.md`, native L0 §3, and the fallback governance digest. The settings panel also showed files without explaining whether they actually affected prompts, which made customization misleading.

## Original Requirements（必填）

> “那你现在就先开始 先做 #747：shared-rules → 编译生成 L0，native + fallback 共用同一编译产物，.local-override 挂到编译层？ 然后再做#749：Rules & SOP 面板显示‘实际进 prompt / 只是参考 / skill 按需加载’的消费链。”

- 来源：铲屎官 2026-05-21 thread 指令 + upstream issues:
  - https://github.com/zts212653/clowder-ai/issues/747
  - https://github.com/zts212653/clowder-ai/issues/749
- 请对照上面的摘录判断交付物是否解决了铲屎官的问题。

## Tradeoff

- Governance compiler is a deterministic projection, not a raw markdown passthrough. It fail-closes on required anchors and emits compact L0 phrasing to keep prompt budget stable.
- `.local-override.md` remains replacement semantics, not append semantics, to preserve existing override behavior.
- #748 SOP stage unification is not touched. This PR only labels SOP as `reference`; it does not redesign SOP stage taxonomy.
- Browser-level manual preview was not run in this cycle; frontend coverage is via focused render tests plus full gate. If you consider a real browser smoke mandatory for this settings-panel delta, return P2 and I will run it before merge-gate.

## Architecture Ownership（必填）

Architecture cell: harness/system-prompt-injection
Map delta: update required
Why: Governance L0 source and prompt-consumption observability are both part of the prompt injection chain; no new parallel Store/Queue/Router/Adapter/Dispatcher/Binding was introduced.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- docs/architecture ownership map 是否需要同步 beyond the F203 spec + ADR-030 updates

## Open Questions

### 技术 OQ（给 reviewer）

1. Is the deterministic governance compiler the right boundary, or should the compiled L0 preserve more of `shared-rules.md` verbatim?
2. Is fail-closed on missing shared-rules anchors acceptable for both native and fallback paths?
3. Is `.local-override.md` raw replacement at the compiler layer the correct preserved behavior?
4. The fallback-layer checker flags `governance-l0.ts` and `RulesPromptsParts.tsx`. My judgment: these are input/display boundary fallbacks, not coordinate-system patching. Please verify.
5. Consumption taxonomy: are `actual-prompt` / `reference` / `skill-on-demand` and the Chinese labels clear enough for maintainers?

### 价值 OQ（给 CVO，如有）

None. #748 remains deferred by explicit CVO instruction.

## Next Action

Please review the branch. If APPROVE, I will proceed to merge-gate: PR, cloud review, squash merge, Phase doc sync, cleanup.

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f203/opus47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202` or next available pair selected by the script

## 自检证据

### Spec 合规

- F203 spec updated with Phase G (#747/#749), AC-G1..G5, KD-15/KD-16, timeline, and links.
- ADR-030 updated to show `shared-rules.md → governance-l0 compiler → native/fallback` and Rules & SOP consumption taxonomy.
- Upstream issues acknowledged:
  - #747 comment: https://github.com/zts212653/clowder-ai/issues/747#issuecomment-4509256618
  - #749 comment: https://github.com/zts212653/clowder-ai/issues/749#issuecomment-4509256574

### 测试结果

Focused checks:

```bash
pnpm --filter @cat-cafe/api build
node --test packages/api/test/governance-l0.test.js packages/api/test/rules-route.test.js packages/api/test/system-prompt-builder.test.js packages/api/test/governance-overlay.test.js scripts/compile-system-prompt-l0.test.mjs
pnpm --filter @cat-cafe/web exec vitest run src/components/settings/__tests__/RulesPromptsContent.test.tsx
pnpm biome check packages/api/src/routes/rules.ts packages/api/test/rules-route.test.js packages/api/test/governance-overlay.test.js packages/web/src/components/settings/RulesPromptsContent.tsx packages/web/src/components/settings/RulesPromptsParts.tsx packages/web/src/components/settings/__tests__/RulesPromptsContent.test.tsx
```

Results:
- API/L0 focused suite: 179 pass, 0 fail after adding the overlay fixture fix.
- Web settings focused suite: 10/10 pass.
- Full `pnpm gate`: PASSED at `18fead50` (all tests/lint/check).

Quality subchecks:
- `node scripts/check-hotfix-pattern.mjs` → `hotfix=false`
- `node scripts/check-fallback-layers.mjs` → flagged expected boundary fallbacks; see technical OQ #4
- root artifact guard → no root media/design artifacts

### 相关文档

- Plan: `docs/plans/2026-05-21-F203-governance-l0-consumption-chain.md`
- Feature: `docs/features/F203-native-system-prompt-l0.md`
- ADR: `docs/decisions/030-system-prompt-engineering.md`
