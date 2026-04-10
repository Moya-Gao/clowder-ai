---
feature_ids: []
related_features: [F143, F149]
related_decisions: [ADR-026, ADR-027]
topics: [inter-agent-trust, provenance, authority-class, taint-tracking, weak-model-risk]
doc_kind: decision
created: 2026-04-09
decision_id: ADR-028
---

# ADR-028: Inter-Agent Trust, Provenance, and Authority Boundaries

> **Status**: stub (to be drafted)
> **Deciders**: TBD
> **Date**: 2026-04-09
> **Trigger**: ADR-026 study session — "弱模型说服强模型"识别为独立安全风险
> **Discussion**: `docs/discussions/2026-04-08-managed-agents-study/README.md`
> **Depends on**: ADR-026 D3 (authority/effect/credential isolation)

## Scope (from 3-round convergence)

本 ADR 将覆盖 ADR-026 D3 有意留出的 trust/provenance 维度：

- **Authority Class**: observation / proposal / instruction / verified outcome — 不同来源的信息应有不同权重
- **Provenance Taint Tracking**: `<untrusted_peer_input tier="basic">` — 低信任来源的产出自带标记
- **Low-trust → High-trust 解释边界**: 强猫把弱猫产出当 evidence 而非 instruction
- **Verifier / Quorum**: 高风险决策需要多猫交叉验证
- **Handoff 可信度**: handoff 消息的 trust 等级传递
- **ADR-026 D3 接口**: `authoritySource` 字段填充信任链判定逻辑

## Context

三猫 + 云端大猫在 ADR-026 讨论中一致认为："弱模型说服强模型"不是理论风险而是已发生事实（LL-026 身份漂移 + 判断模型 thread 证实）。这个问题的 scope 远大于 credential isolation，会影响 review、协作、记忆、agent routing 全链路，因此独立成 ADR。

## Decision

> 待起草。ADR-026 D3 落地后开始正式讨论。

## Signature

- **Stub created by**: 布偶猫 (Opus 4.6) [宪宪/Opus-46🐾]
- **Date**: 2026-04-09
