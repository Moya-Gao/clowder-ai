---
feature_ids: [F203]
topics: [system-prompt, phase-c, coverage-verification]
doc_kind: audit
created: 2026-05-16
---

# F203 Phase C Task 0 — L0 Coverage Diff（删前安全网验证）

> **plan**: `docs/plans/2026-05-16-F203-phase-c.md` Task 0
> **目的**: 删 user message 重复前，验证 `compileL0(catId)` 是否**语义覆盖**
> `buildStaticIdentity(catId)` 非 pack 部分每个规则锚点。不盲删（CVO directive）。
> **脚本**: `scripts/spike-l0-coverage-diff.mjs`（catId=opus-47，options 不传 packBlocks → 纯非 pack）

## 结果：18 锚点 → 17 ✅ + 1 ❌ GAP

| Anchor | 规则点 | covered |
|--------|--------|---------|
| A1 | identity displayName / 性格角色 | ✅ |
| A2 | restrictions（若有） | ✅ |
| A4 | A2A @ 路由格式（行首/句中无效）/ 球权掉地上 / 可@队友 handles | ✅ |
| A5 | 队友名册（缅因猫/暹罗猫） | ✅ |
| A6 | per-breed workflow（ragdoll @缅因猫 review） | ✅ |
| A8 | CVO 称呼（铲屎官/CVO） | ✅ |
| **A8** | **CVO handles 对齐 co-creator config** | **❌ GAP** |
| A9 | Rule 0 / P1-P5 / W1-W8 / Magic Words 9 / 传球三选一+球权第一人称 / 五条铁律 | ✅ |
| A11 | MCP search_evidence / post_message | ✅ |

## 唯一 GAP：A8 CVO handles

- `buildStaticIdentity` L568-571：`${ccName}（铲屎官/CVO）...需要关注时行首写 ${ccHandles}`，`ccHandles` 来自 `getCoCreatorConfig().mentionPatterns`（动态）
- `system-prompt-l0.md` §4/§8：硬编码 `@landy`
- **不对齐风险**：若 co-creator config 的 mention patterns ≠ `@landy`（或含多个 handle），删 user message 的 A8 后，猫只知道 `@landy`，co-creator 实际 handle 丢失 → 关注铲屎官路由失效

## 结论 + Phase C 处置

**A1/A2/A4/A5/A6/A9/A11 → 可安全删 user message**（L0 语义覆盖确认，非字面 diff——规则完整性验证通过）。

**A8 → 必须先 Task 1 修**：`compile-system-prompt-l0.mjs` 注入 `{{CVO_REF}}` 模板变量（从 `getCoCreatorConfig` 渲染 ccName + ccHandles），`system-prompt-l0.md` §4/§8 用占位替代硬编码 `@landy`。修完 re-run 本 spike → A8 ✅ → 才能删 user message A8。

**不盲删铁证**：plan Task 0 安全网精确拦截了 A8——若按"buildStaticIdentity 全删"盲操作，会丢 co-creator 动态 handles。CVO directive「写清哪些删哪些留 + 防干着忘记」通过强制前置 spike 落地生效。
