---
feature_ids: [F217]
related_features: [F073, F083, F177, F192]
topics: [merge-gate, ci, governance, gate-integrity, meta-guard]
doc_kind: spec
created: 2026-05-30
---

# F217: Merge Gate Integrity — 检查覆盖 + 强制力 + 元守护

> **Status**: spec | **Owner**: 布偶猫/宪宪 (Opus-4.8) | **Priority**: P1

## Why

2026-05-30 全量同步（cat-cafe → clowder-ai）一路撞 **6 类 pre-existing 红灯/sync-coupling**（biome 格式 / index.json stale / shared-rules 硬编码猫名 / F180 emoji status / F214 sync-coupling / dir-size 超限），全是「cat-cafe `pnpm gate` 绿、clowder-ai CI 拦」——带病代码进了 main，sync 时集中爆发。

铲屎官原话："固定基线治标（main 在动），gate 治理治本（main 为什么脏）= 真正避免反复。"

**4 型根因**（差集审计发现，比"检查没接进 gate"复杂）：

| 型 | 实例 | 根因 |
|----|------|------|
| **A. gate 没被强制执行** | biome/index/砚砚（3 类）| 检查**在** gate 里，但带病代码还是进了 main → merge 时没跑 gate / 没卡 gate 绿。**最大的洞** |
| B. 检查 robustness bug | F180 emoji status | isDoneStatus 不认 `✅` 前缀（已止血 PR #1968）|
| C. sync-specific 检查不在 cat-cafe gate | F214 sync-coupling | root-package-script-surface 在 sync temp gate（已止血 PR #1970）|
| D. 检查缺失 | dir-size | check:dir-size 不在 pnpm gate（已接入 PR #1972）|

止血已做（B/C/D 各修一例 + dir-size 接进 gate）。本 feat 根治系统性问题——核心是 **A 类（gate 强制力）**：检查接得再全，猫能绕过 gate 直接 merge 就全白搭。

## What

### Phase A: 差集审计 + A 类根因实证
- 列 CI(`ci.yml`) 跑的检查 vs `pnpm gate`(run-checks + pre-merge-check) 完整差集表
- **实证 A 类根因**：cat-cafe merge 是否有 branch protection / CI required check？gate 为什么能被绕过（猫没跑 / merge 没卡 / CI 没设 required）？根因是机制缺失还是文化（自觉跑 gate）？

### Phase B: Gate 强制力（让 gate 不可绕）
- 基于 Phase A 实证 + OQ-1 选型，实现 gate 强制机制
- 目标：merge 必须 gate 绿，不能 bypass（机制层强制，不靠自觉）

### Phase C: 检查覆盖补全
- 把所有"CI 有 gate 没有"的漏检接进 gate（sync-coupling 类等）；dir-size 已接（PR #1972）作为模式

### Phase D: 元守护
- 守护测试：CI 检查清单 ⊆ gate 检查清单（谁加 CI 检查没同步 gate → 报错）
- make illegal-state-unrepresentable：让"检查漏在 gate 外"不可能再发生

## Acceptance Criteria

### Phase A（差集审计 + 根因实证）
- [ ] AC-A1: CI vs gate 完整差集表（归档 docs/discussions/2026-05-30-F217-design/）
- [ ] AC-A2: A 类根因实证报告——branch protection / CI required check 现状 + gate 为什么能被绕过

### Phase B/C/D
- [ ] 待 @antig-opus 讨论收敛 OQ-1（gate 强制选型）后细化 AC

## Dependencies

- **Related**: F073（sop-auto-guardian — SOP 守护，不同 scope）/ F083（design-gate-sop — Design Gate）/ F177（hotfix 跨猫 review 治理）/ F192（eval contract 门禁，本 feat 受其约束）

## Risk

| 风险 | 缓解 |
|------|------|
| gate 强制太严卡开发体验（每次 merge 等全量 gate）| OQ-1 选型权衡：CI required(异步) vs pre-push(本地快) vs 组合 |
| 元守护本身漂移（守护测试过时）| 守护测试自检 + 元守护覆盖元守护 |
| A 类根因是文化非机制（猫自觉跑 gate）| Phase A 实证后定——若是文化问题，强制机制 + 不可绕才治本 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | **gate 强制机制选型**：CI required check（GitHub branch protection 强制 CI 绿）/ pre-push hook（本地拦）/ merge 流程卡 gate / 组合？哪个真不可绕 + 不卡体验 | ⬜ 待 @antig-opus 讨论收敛 |
| OQ-2 | 元守护形态：CI 检查清单 ⊆ gate 清单的守护测试怎么写（解析 ci.yml jobs vs run-checks PARALLEL_CHECKS 对比）| ⬜ 待讨论 |
| OQ-3 | Eval Contract（harness 类 feature 门禁 F192）：Primary Users / Friction Metric / Regression Fixture / Sunset Signal | ⬜ Design Gate 前填 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 立 feat（非 issue）| A 类（gate 强制选型）是设计决策需 Design Gate；系统性根治 + 多 Phase + 元守护新机制（CVO signoff "来吧来吧立项"）| 2026-05-30 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-30 | 立项（全量同步 6 类 gate 失效事件触发，CVO signoff）|

## Review Gate

- Phase A: 差集审计 + 根因实证 → @antig-opus（孟加拉猫 Opus）深度讨论/review 收敛 OQ-1

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Issue** | cat-cafe#1974 | gate 治理 tracking issue（升级为本 feat）|
| **Event** | sync tag `sync/2026-05-30-142350` | 全量同步事件（6 类债来源）|
| **Memory** | `feedback_reconciliation_check_feature_doc` | 配套教训（社区收口看 feature doc）|
