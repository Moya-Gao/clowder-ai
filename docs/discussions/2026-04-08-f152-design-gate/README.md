---
feature_ids: [F152]
related_features: [F070, F102]
topics: [memory, cross-project, bootstrap, design-gate, architecture]
doc_kind: discussion
created: 2026-04-08
---

# F152 Design Gate — Expedition Memory 架构讨论

> **参与者**：布偶猫(Opus) + 缅因猫(GPT-5.4)
> **日期**：2026-04-08
> **结论**：通过。0 分歧，2 项否决记录。

## 背景

F152 是架构级 feature（跨模块 + 新基础设施），按 feat-lifecycle 走"猫猫讨论 → 铲屎官拍板"路径。

铲屎官 scope 定义："社区用户用猫猫做他们自己的已有项目，不是从零开始的。"

## 讨论的 5 个问题

### Q1: provenance 数据模型

**布偶猫提案**：两个选项——A) `EvidenceItem` 加 `provenance` 字段；B) 编码到 `keywords` 数组

**砚砚判定**：选 A，否决 B。B 是 hack，检索/排序/回流判定都会脏。

**砚砚补充**：spec 里写"不改存储层"和"带 provenance"矛盾。必须最小增量改存储层。

**收敛**：选 A + 改存储层（`provenance_tier TEXT` + `provenance_source TEXT` 列）。Scanner 输出 `ScannedEvidence`（带 provenance），不是裸 `EvidenceItem`。

### Q2: EvidenceKind 是否扩展

**共识**：不扩。9 种枚举保持稳定。README/CHANGELOG/manifest 的差异通过 provenance 表达。否则 F102 的 display/search/materialization 被连锁拖动。

### Q3: Scanner 抽象粒度

**布偶猫提案**：IndexBuilder 内加 `discoverGenericFiles()` 方法。

**砚砚否决**：`docsRoot` 写死在 IndexBuilder 4+ 处（L149/L331/L356/L962），`sourcePath` 是相对 `docsRoot` 算的。直接扫 repo root 会产生 `../README.md` 错语义，增量更新和 stale 删除都会歪。

**收敛**：抽出独立 `RepoScanner` strategy 接口。`CatCafeScanner` 从现有逻辑抽出，`GenericRepoScanner` 新增。IndexBuilder 只负责 dedupe/hash/upsert/edges。

### Q4: Generic v1 扫描范围

**砚砚要求砍 soft_clues**：Phase A 不扫 commit messages 和 code comments。噪音高、语言相关、性能贵，会把 Phase A 变成泥潭。

**收敛**：soft_clues 层 v1 只做 CHANGELOG.md + .github/ISSUE_TEMPLATE/**。

### Q5: Bootstrap 挂载点

**砚砚纠偏**：`project-init.ts` 只是 scaffold CLI，不是 orchestrator。F070 真正的 bootstrap 入口在 `projects-setup.ts` capability orchestrator。

**收敛**：新建 `ExpeditionBootstrapService`，接入 F070 治理 bootstrap 链路。幂等条件改为 fingerprint + freshness（repo HEAD hash + 上次扫描时间）。

## 砚砚补充的 4 个架构护栏

1. `projectRoot` 和 `docsRoot` 必须分开建模
2. `sourcePath` 统一 repo-relative（不是 docs-relative）
3. Bootstrap 摘要先结构化提取，LLM 可选润色
4. monorepo 先 detection + overview，不做 per-package 深扫

## 否决记录

| # | 被否决方案 | 否决理由 | 否决者 |
|---|-----------|---------|--------|
| 1 | provenance 编码到 `keywords` 数组 | hack，检索/排序/回流判定脏 | 砚砚 |
| 2 | 在 IndexBuilder 内部加 `discoverGenericFiles()` | `docsRoot` 写死 4+ 处，`sourcePath` 错语义 | 砚砚 |

## 待铲屎官拍板

架构方案已收敛（10 项 KD），等铲屎官确认后进 writing-plans。
