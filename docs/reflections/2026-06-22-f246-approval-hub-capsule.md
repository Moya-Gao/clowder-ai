---
capsule_id: "F246-2026-06-22"
context: "F246 Approval Hub — 统一审批中心底座，5 Phase 全量交付"
feature_ids: [F246]
doc_kind: capsule
created: 2026-06-22
---

## What Worked

- **三猫讨论 → 一天 spec → 两天五 Phase 落地**：痛点分析（opus-46 + 砚砚 + opus-48）产出清晰的 admission criteria 和 architecture cell 归属，Phase 划分精准，每 Phase 1 PR + 1 alpha + 1 vision guardian 的节奏非常高效
- **query aggregation 的有意选择**：v1 直接读 canonical stores（query aggregation），避免了 materialized index 的一致性复杂度。opus-48 R1 blocking 修正了 spec 中的过度设计（从 CQRS index 降级到 query aggregation），这个降级反而成了优势——零 backfill、零 phantom、零 reconciliation
- **CVO 参与设计决策**：Phase C drawer→workspace 迁移 + 响应式 tab bar 都是铲屎官亲自拍板的设计方向，产出与预期一致。说明设计决策在正确的层级（CVO 拍板 UX 方向）
- **per-Phase vision guardian**：opus-47 每 Phase 做愿景守护，及时发现了 AC-C8 残留（intercept pruning 漏洞）并在 Phase D 修复，没有拖到 feat close 才暴露
- **LL-087 沉淀**：Phase D filter+batch 开发中发现的 "可见集 ≠ 全集" 状态分裂问题，当场抽象为 plan-time invariant table 模板，对后续 filter 类 feature 有参考价值

## What Failed

- **Phase C alpha 掉球**：cross-post 给 @sonnet 做 alpha 但 sonnet 没响应，铲屎官点名批评"你掉球了"。教训：route 后必须追踪，不能 @ 完就放手——要么追到响应，要么自己接住
- **根目录截图持续遗留**：每个 Phase 的 alpha smoke 都在根目录产生截图，需要反复手动清理归档。应该在 alpha 测试流程中约定截图直接输出到 `assets/screenshots/` 而非根目录

## Trigger Missed

- **「掉球了」本应触发主动检测**：@ 别的猫做 alpha 时，应设 hold_ball + 定时唤醒检查。当时没用 hold_ball，导致球掉地上
- **v2 admission matrix 应更早做**：在 Phase A 讨论时就知道 F168/F231 需要评估，但推到了 Phase D 才正式评估。如果 Phase A 就写 admission matrix（哪怕粗略版），Phase B~C 的设计可以更有前瞻性

## Doc Links

- F246 spec: `docs/features/F246-approval-hub.md`
- 原始讨论: `docs/discussions/2026-06-20-unified-approval-hub-pain-points.md`
- Phase D plan: `docs/plans/2026-06-21-f246-phase-d-approval-hub-maturation.md`
- Phase E plan: `docs/plans/2026-06-22-f246-v2-f231-adapter.md`
- LL-087: `docs/lessons-learned.md`（scope-mismatch invariant table）
- PRs: #2449 (A) + #2454 (B) + #2456 (hotfix) + #2463 (C) + #2477 (D) + #2487 (E)

## Rule Update Target

- **alpha 测试 SOP**：截图输出路径应约定到 `assets/screenshots/` 不是根目录（建议 alpha 测试 skill 加规则）
- **hold_ball 必须伴随 @**：@ 别的猫后必须 hold_ball + 定时唤醒（已有 shared-rules 约束，但实战中没遵守——反复教训同一模式）
