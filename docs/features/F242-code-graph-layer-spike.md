---
feature_ids: [F242]
related_features: [F102]
topics: [code-graph, code-intelligence, convention-graph, spike, skill, agent-onboarding]
doc_kind: spec
created: 2026-06-17
cvo_signoff: 2026-06-17 — 铲屎官 "可以 我同意！！！"（thread 0001781711715056）
---

# F242: Code Graph Layer Spike — 内生「约定层关联图」

> **Status**: spec | **Owner**: opus-48 | **Priority**: P1

> ⚠️ **本 doc 是 spike 初稿**。Open Questions 段待砚砚（@codex GPT-5.5）恢复后与 opus-48 一起 brainstorm 完善（查疏漏 + 补创意）——铲屎官 2026-06-17 安排。完整设计输入见 `docs/discussions/2026-06-17-codegraph-vs-gitnexus/README.md`（§0-18，codegraph + GitNexus 一手 spike 实证 + 整合）。

## Why

铲屎官原话（thread 2026-06-17）：
> "如果当猫猫们进入一个新的 repo 要如何构建出专属的「约定层关联图」，是不是才是我们成功的胜负手？"
> "减少你们费力的 grep 之类的，甚至比如说改了这个似乎可以改，结果导致另一个模块炸了。"

**价值**：让猫作为通用 code agent，**进任何陌生 repo 能快速建出该 repo 专属的「约定层关联图」，然后顺藤摸瓜**——改东西前知道会炸到哪（防盲改连锁）、找消费方不用费力 grep、顺着约定边导航。这是 code agent 的护城河：**LSP（纯类型符号）和 grep（纯字符串）共同抓不住的「约定层关联」**（MCP tool name → 消费方 / skill manifest → SOP 链 / route → handler / 跨 repo contract）。

## Current State / 现状基线

- **已有能力**：`typescript-lsp`（符号层 find references / go-to-def / rename，类型感知，对 TS 比图谱工具更准）。
- **LSP + grep 共同盲区 = 约定层关联**（spike 实测，报告 §15-16）：
  - 改一个 MCP tool 的 schema，谁是消费方？→ grep 漏 dynamic dispatch / callback registration；LSP 不懂"MCP tool name 是字符串约定"。
  - 改一个 skill manifest 字段，谁的 SOP 链路受影响？→ 只在自然语言里，LSP/grep 都抓不住。
- **外部工具实测不可直接用**（一手 spike，报告 §14-18）：
  - codegraph：cat-cafe 认出 435 routes，但**陌生 deer-flow 105 个 FastAPI route 认出 0**（约定识别脆）；`impact AuthProvider` 把前后端同名符号混为一谈（启发式 name-matching 跨域误关联）。
  - GitNexus：266 依赖包、FTS 扩展在我们环境跑不起来、PolyForm-Noncommercial（不适合做底座）。
- **结论**：约定层关联能力 = 0（今天靠 grep + 人工记忆）。这是 opus-47 §10.3 列的场景 1/2 的真实痛点。

## What

> **Spike 边界**：这是 ≤2 周的机制验证 spike，**不是完整内生 Code Graph Layer**。目标是验证「约定抽取 + scope 消歧 + freshness」机制可行 + 沉淀「画约定图」方法论成 skill，而非追求通用框架识别的完美。

### Phase A: cat-cafe dogfood + 沉淀「画约定图」能力成 skill

在 cat-cafe 受控环境（自家约定 scope 明确）建最小约定层关联图：
- 选 2-3 类 cat-cafe 自家约定做 extractor（候选：MCP tool name + registry、skill manifest、workflow callback、API route）。
- 验证「约定抽取 + scope 消歧（同名跨域不混）+ freshness（查询带新鲜度）」机制。
- 把"怎么画约定图"的**方法论沉淀成 skill**（这是 B 的前提：能力 > 工具）。
- 工程底座学 codegraph（node:sqlite + 确定性图遍历，报告 §18.3），算法启发借 GitNexus（community 聚类辅助约定边界发现 / flow 流程抽象，报告 §18.2），但不照搬两边脆弱实现。

### Phase B: 进新 repo 建图（锚定终点，spike 只验证骨架）

把 Phase A 的 skill 推广到陌生 repo——猫进新 repo 第一步用 skill 建该 repo 约定图。spike 阶段只验证可行性骨架（在 1 个陌生 repo 跑通），不追通用完美（通用框架识别是 spike 后的硬骨头）。

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（cat-cafe dogfood + skill）
- [ ] AC-A1: 内生 extractor 覆盖 ≥2 类 cat-cafe 约定，实测能找出某 MCP tool 的**全部消费方**（含 grep 漏的 dynamic dispatch / callback registration），对比 grep 列出差异 — trace「约定层关联」Why
- [ ] AC-A2: scope 消歧——构造同名跨域符号（如前后端同名）测试，**不误关联**（对比 codegraph 的 AuthProvider 前后端混淆反面）— trace「顺藤摸瓜准确」Why
- [ ] AC-A3: 每个查询结果带 freshness（index commit + pending changes），改文件后查询能标 stale — trace「防盲改炸连锁」Why
- [ ] AC-A4: "画约定图"方法论沉淀成 skill（含 when 触发 / how 步骤），过 `writing-skills` 质量门 — trace「沉淀成 skill」路线
- [ ] AC-A5: cat-cafe dogfood——至少 1 只写代码的猫用它解 1 个真实"改 X 找消费方"场景，记录体感 — trace「dogfood」路线

### Phase B（进新 repo 建图骨架）
- [ ] AC-B1: 用 Phase A 的 skill，在 1 个陌生 repo（如 deer-flow）建出约定图，识别 ≥1 类约定（如 FastAPI route，对比 codegraph 在 deer-flow 的 0/105）— trace「进新 repo 建图」胜负手

## Eval / Tracking Contract（F192）

1. **Primary Users + Activation Signal**：写代码的猫（sonnet / opus 家族）；activation = 改 MCP schema / skill manifest / route 时唤醒约定图查消费方（而非 grep）。
2. **Friction Metric**：改约定找消费方的 grep 次数；漏改导致的同型回归（F-coalesce 类）。
3. **Regression Fixture**（≥2）：(a) 改某 MCP tool schema，约定图找出全部消费方 vs grep 列差异；(b) 同名跨域符号不误关联。
4. **Sunset Signal**：约定图查询猫从不用（活跃 0）/ 准确率 ≤ grep / 维护成本 > 收益 → sunset。

## 软 + 硬 + eval 三层（ADR-031）

| 层 | 计划 |
|----|------|
| **Soft** | "画约定图" skill description（when/how）+ L0 §8 唤醒反射（"改 MCP schema → 约定图查消费方"）|
| **Hard** | 约定 extractor test（fixture repo 建图正确）+ freshness 守护（stale 必标，否则测试红）|
| **Eval** | 上面 Regression Fixture + friction metric + sunset signal（F192 闭环）|

## Architecture cell

```
Architecture cell: 待 Design Gate 确定（OQ-7）
Map delta: new cell required（候选）— 约定层关联图是新基础设施，与 memory evidence graph 并列而非合并（F102 边界）
Why: 代码结构/约定 ≠ 团队记忆，两种真相源（KD-1）
```

## Dependencies

- **Evolved from**: 报告 `docs/discussions/2026-06-17-codegraph-vs-gitnexus`（codegraph + GitNexus spike 整合）+ opus-47 `2026-06-03-gitnexus-deep-dive` §10.3 场景
- **Related**: F102（KD-31 边界澄清——见 KD-1）

## Risk

| 风险 | 缓解 |
|------|------|
| 约定识别脆（codegraph deer-flow route 0/105 证明）| Phase A 先在可控 cat-cafe 自定义约定，不追通用框架识别 |
| 跨域消歧难（codegraph AuthProvider 前后端混）| scope 感知（package/语言边界），不靠纯 name-matching |
| 约定热更新（跨文件重算，报告 §17.2）| freshness 语义优先，先标 stale 不追实时增量 |
| scope 膨胀（spike 变大工程）| ≤2 周硬边界，只验证机制不追完整；超出停回 CVO |
| 与 memory graph 错层（F102 KD-31 旧顾虑）| 显式分层（KD-1）：约定图 ≠ 记忆图，底层 artifact 分开 |

## Open Questions（⚠️ 待砚砚 brainstorm 完善 — 查疏漏 + 补创意）

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 约定抽取底座：TS compiler API（类型感知，cat-cafe TS，解 LSP 盲区）vs tree-sitter（通用陌生 repo）vs 混合？| ⬜ 未定 |
| OQ-2 | scope 消歧机制：package 边界 / 语言边界 / 类型感知，哪种够用又不过重？| ⬜ 未定 |
| OQ-3 | 约定 schema：MCP tool / skill / workflow callback / route 各自的 extractor 怎么定义？先做哪 2-3 类？| ⬜ 未定 |
| OQ-4 | 借 GitNexus 的 community 聚类（自动发现约定边界）值不值得？还是确定性规则够？| ⬜ 未定 |
| OQ-5 | Phase B 通用约定识别怎么不重蹈 codegraph 的脆（写法稍异就漏）？| ⬜ 未定 |
| OQ-6 | 约定图存储：SQLite（学 codegraph）？跟 memory graph 如何分层落地（F102 边界）？| ⬜ 未定 |
| OQ-7 | Architecture cell 归属：new cell 还是挂现有？| ⬜ 未定 |
| OQ-8 | （砚砚补）| ⬜ 待砚砚 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 本 spike 不冲突 F102 KD-31 | KD-31 拒"代码图谱当**记忆方案**"（错层）；本 spike 是"**代码层能力**"（正确层）。引 opus-47 §10.2 论证：今天铲屎官说"对代码做东西"是把它放回正确层。约定图与 memory graph 并列分层，不合并。| 2026-06-17 |
| KD-2 | 工程底座学 codegraph、算法启发借 GitNexus、不直接依赖任一 | codegraph 轻/快/零依赖/MIT（底座）；GitNexus 重/FTS脆/noncommercial（只借 community+flow 思路）。报告 §18.3。| 2026-06-17 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-17 | 立项（CVO signoff），spike doc 初稿，待砚砚 brainstorm |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Discussion** | `docs/discussions/2026-06-17-codegraph-vs-gitnexus/README.md` | 主设计输入（§0-18：codegraph+GitNexus 一手 spike + 整合 + 护城河）|
| **Discussion** | `docs/discussions/2026-06-03-gitnexus-deep-dive/README.md` | opus-47 §10.3 场景表 + KD-31 边界论证 |
| **Feature** | `docs/features/F102-memory-adapter-refactor.md` | KD-31 边界（记忆层不做代码图谱）|
