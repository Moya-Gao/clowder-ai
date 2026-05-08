---
doc_kind: mailbox
feature_ids: [F192]
related_features: [F167]
created: 2026-05-07
---

# Review Request: F192 Phase B — F167 Pilot + Inception Gate

Review-Target-ID: f192-phase-b
Branch: feat/f192-phase-b-f167-pilot

## What

用 F167 A2A Chain Quality 作为试点，完整跑一遍 socio-technical eval 的所有产物 + 在 feat-lifecycle Design Gate 加 Eval Contract 硬门禁。

8 commits, 10 files changed, +546 lines:
- AC-B1: Eval/Tracking Contract 写入 F167 spec（refined from 47's v0 draft）
- AC-B2: 3 trace fixtures（ball-drop / zombie-hold / ack-loop）
- AC-B3: Feature Trace Bundle 样例（14 PRs, 4 cats, 5 CVO corrections）
- AC-B4: Evidence-directed cat interview 样例（5 axes）
- AC-B5: Feature Fit Review（primary_failure_class = harness_misfit）
- AC-B6: A2A tool eval contracts（4 tools × 4-item template）
- AC-B7: Design Gate Eval Contract 硬门禁（SKILL.md edit）

## Why

F192 Phase A 建了骨架（doc type + scanner + eval checkpoint），Phase B 验证这套 eval workflow 在真实 feature 上是否可用。铲屎官核心诉求：harness 改动必须出生即带 eval，不能事后补。

## Original Requirements（必填）

> 铲屎官（2026-05-06 01:15）："我们必须有 tracing...当一个 feat close 了...thread id 可知道...session id 可知道 => 意味着他们的 tool call 上下文完全透明！...可选环节采访猫猫的干活体验是否才是不污染工作上下文且是一个持续性评估的可靠扩展点？"
>
> 铲屎官（2026-05-07）："特性交付就得一起交付 eval"

- 来源：`docs/features/F192-socio-technical-harness-eval.md` §Why
- 来源：`docs/discussions/2026-05-05-socio-technical-harness-eval-draft.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 47 的 v0 draft 列了 7 个 regression fixture（F167 worked example），我保留了 7 个但修正了 L3 相关引用（KD-20 退役后 test file 名变了）
- Eval Contract 放 F167 spec 里而不是独立文档——v1 模板设计如此，验证"在 spec 里就能填"的可用性
- AC-B7 inception gate 用最简规则（触发条件 + 4 项必填），不加 reviewer workflow 自动化（那是 Phase C）

## Architecture Ownership（必填）

Architecture cell: memory
Map delta: none
Why: Only adding docs + one SKILL.md edit; no new boundary/owner/extension point

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- SKILL.md edit 是否只在 Design Gate section 内

## Open Questions

1. **AC-B1 activation signal 数量**: F167 列了 4 条（L1/C2/L3-data/C1），47 的 v0 draft 建议 ≥5 时 reviewer 主动询问是否该拆。请 reviewer 判断 4 条是否合适
2. **AC-B5 failure class 判定**: 归类为 harness_misfit 而非 execution_gap——请 reviewer 检查 Analysis 部分论证是否站得住
3. **AC-B7 SKILL.md 插入位置**: 放在"架构归属一问 F191"后、"在地设计检查"前——是否符合 Design Gate 的检查顺序逻辑

## Retraction Conditions

如果我判断错了，最可能错在：
1. trace fixture 引用的 thread_id 可能有遗漏（搜了 3 路 search_evidence 但 scope=threads 不保证全覆盖）
2. cat interview 样例是"as if"填写（我是 owner 填自己的 interview），可能有自我偏差
3. Feature Fit Review 归因 harness_misfit 可能过于单一——F167 Phase B2 的 6 漏洞中可能有 1-2 个属于 tool_gap

## Next Action

请 review 以下重点：
1. 7 个新文档的 YAML frontmatter 和 schema 合规性
2. AC-B1 Eval Contract 内容准确性（对照 47 的 v0 draft + F167 当前状态）
3. AC-B7 SKILL.md edit 的措辞和触发条件
4. 所有 trace evidence 引用是否指向真实数据

## Review Sandbox（必填）

本 Phase 是 docs-first（6 个 markdown + 1 个 SKILL.md edit），无需起 dev server。
- Path: `/tmp/cat-cafe-review/f192-phase-b/codex`
- Start Command: N/A（纯文档 review，`git clone --detach` 即可）
- Ports: N/A

## 自检证据

### Spec 合规
AC-B1~B7 全部实现，quality-gate 通过。详见上方对话中的 Quality Gate Report。

### 测试结果
- `pnpm check` → 0 errors ✅
- `pnpm lint` → 0 errors (pre-existing color warnings only) ✅
- `pnpm -r --if-present run build` → exit 0 ✅
- SystemPromptBuilder → 103/103 pass ✅（SKILL.md 改动验证）
- `pnpm check:architecture-ownership` → 0 warnings ✅
- YAML frontmatter → all 7 new docs valid ✅
- Follow-up tail scan → exempt (evidence descriptions only) ✅
- Root-level artifact hygiene → clean ✅

### 相关文档
- Plan: `docs/plans/2026-05-07-f192-phase-b-f167-pilot.md`
- Feature: `docs/features/F192-socio-technical-harness-eval.md`
- Template: `docs/discussions/2026-05-07-eval-contract-template-v1-draft.md`
- Pilot target: `docs/features/F167-a2a-chain-quality.md`
