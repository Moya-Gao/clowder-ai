---
feature_ids: [F243]
related_features: [F236, F186, F038]
topics: [spike, description-generation, stratified-sampling, blind-eval]
doc_kind: research
created: 2026-06-17
---

# F243 Phase A — Description Generation Stratified Spike Charter

> **F243 spec**: `docs/features/F243-docs-discovery-profile.md`
> **Design Gate**: `docs/discussions/2026-06-17-f243-design/README.md`
> **CVO signoff**: 2026-06-17 启动 Phase A（铲屎官原话："我同意你的a 可以开搞"）

## Scope

Phase A 验证 description generation 形态（小模型 / 大猫手写 / 模板任一）通过 stratified sample 三猫盲评，避开 mini-spike R1/R2/R3 单 F186 sample 的 cherry-pick 偏差（砚砚 R2 反 sharpen "F186 是 description 任务的 easy mode"）。

**AC 覆盖**（trace 回 F243 spec Phase A）：
- AC-A1: 10 篇 stratified sample 选定 + 三猫盲评完成
- AC-A2: profile draft v1（frontmatter 字段映射 + description 字段四约束）
- AC-A3: eval rubric 定稿（baseline + friction metric + sunset signal）
- AC-A4: description generation 形态判定（盲评分数 + 字数合规率 + nuance loss case 列表）
- AC-A5: spike report 进本目录

## Stratified Sample 10 篇（6 硬骨头 + 4 easy mode）

按 spec KD-10 "6:4 比例（砚砚 sharpen）"。**Owner = 宪宪自决初选，等 @codex sharpen confirm 后启动 generation**。

### 6 篇硬骨头

| # | F号 | 文件名 | 类型 | 选择理由 |
|---|---|---|---|---|
| 1 | F008 | F008-token-budget-observability.md | **标题虚 / 抽象**| "token-budget-observability" 三个 generic 术语堆叠；fluff 测试——能否抓到具体 user problem |
| 2 | F038 | F038-skills-discovery.md | **ADR-like / doc_kind=note** | doc_kind=note 不是 spec；status=parked；测试小模型能否区分文档类型 |
| 3 | F062 | F062-ragdoll-provider-profile-hub.md | **reopened-like / superseded** | status: done → superseded by F136；多 status 状态测试 |
| 4 | F168 | F168-community-ops-board.md | **scope 漂移 / 长程多 phase** | community-ops-board 跨多 Phase + multi-tenancy 路径漂移；测试长 spec |
| 5 | F229 | F229-cat-ball-concierge.md | **broad user-facing scope**（砚砚 R1 sharpen 改标 — 原"F号 collision"维度单文件 prompt 测不到，collision 消歧属 Phase B generator schema scope）| in-progress + always-on frontend concierge entry，broad scope 测试 description 抓核心 user-facing 价值 |
| 6 | F101 | F101-mode-v2-game-engine.md | **spec-very-large 613 行 + reopened in-progress 多 phase**（砚砚 R1 sharpen 替换 F236——避免砚砚 co-owner 污染 blind eval） | 613 行 / reopened 2026-03-14 / Phase I in-progress；测试长 spec + 游戏域 + 多 phase 演化 |

### 4 篇 easy mode（F186-类，主题清晰 + 隐喻强 + 术语集中）

| # | F号 | 文件名 | 类型 | 选择理由 |
|---|---|---|---|---|
| 7 | F009 | F009-tool-use-tool-result.md | done / 主题集中 | tool use / tool result 是单一概念，难度低 |
| 8 | F022 | F022-rich-blocks.md | done / 主题清晰 | rich blocks 是 well-defined 概念，UX-oriented 隐喻强 |
| 9 | F102 | F102-memory-adapter-refactor.md | done / 主题集中（F186 演化上游）| memory adapter refactor，主题清晰；和 F186 同族不同 phase |
| 10 | F140 | F140-github-pr-automation.md | done / 主题清晰（砚砚 R1 sharpen 替换 F242——避免砚砚 co-brainstorm 污染；F235 砚砚自己推荐但我 verify 出 F235 是砚砚 deep co-design `宪宪×砚砚收敛` 也污染，所以选 F140 干净 pool）| 砚砚 / @codex / gpt-5 全文 grep 0 命中 ✓；done / 主题清晰单领域 github-pr |

### 故意不选

- **F186**：mini-spike R1/R2/R3 已经用过；为避免 spike 数据回路污染（烁烁可能 memo F186 的 R3 答案），改用 F102 测试同族 doc
- **F040 backlog-reorganization**：和本任务太相关，可能引入 reflective bias
- **F236 / F242 / F235**（砚砚 R1 sharpen 排除）：F236 是砚砚 co-owner（spec L11）+ F242 砚砚是 co-brainstorm（BACKLOG `opus-48 + 砚砚 co-brainstorm`）+ F235 砚砚 deep co-design（多处 "宪宪×砚砚收敛" / KD-1 砚砚分析）。砚砚 R1 提议 F101 替代 F236 + F235 替代 F242，但我 verify 出 F235 自身污染，最终选 F140 干净替代

### Sample selection verify trace（防 self-audit miss）

- 替代池筛选: `grep -l "砚砚\|@codex\|gpt-5\.5\|gpt-5\.4\|@gpt52" docs/features/*.md` → F2xx 段几乎全部命中（砚砚常驻 reviewer 必然现象，只有 F240 干净但非 spec 类型）
- Fall back F0xx/F1xx pool：F140 (github-pr-automation) / F009 / F022 / F102 等 done features 0 命中（早期"三猫"owner 时代砚砚还未成常驻 reviewer）
- F101 mild bias 可接受：F101 砚砚是 reviewer / 部分定位（KD-31/32 "砚砚审查发现 P1 风险"），非 owner / co-designer，比 F236 干净很多

## Generation Prompt v3（9 条 hard rules，mini-spike R1/R2/R3 已 formally validated）

每篇 sample 喂全文（含 frontmatter），跑同一 prompt：

```
任务：给这篇 F号 文档写一句 description（OKF 兼容 + Cat Café profile）。

规则（hard，违反任何一条算失败）：
1. 字数 ≤ 160 字符（汉字按 1 字算）
2. 只答"这是什么"（type-level extension），不答"讲了哪些细节"
3. 不复述 H1 标题
4. 核心创新名词 ≥ 2（出现的关键术语必须保留至少 2 个）；禁用 fluff（系统/方案/架构/机制）
5. 纯文本一段无 markdown 无前后缀
6. 视角必须是"读者"——初次见到这文档的猫，从 description 能感受到"这是讲什么的、值不值得点开"
7. 核心隐喻保留至少 1 个（如出现"图书馆/会议室/驾驶舱/看板"等具象比喻）
8. 必须能回答"为什么有这个 feature"（user problem hook）—— 6-8 个字带出 motivation
9. 第三人称客观描述——直接说"F号 是 X" 或 "X 是 Y"；禁 meta 表达（"本书/本文档/我们如何"）

文档全文：
[F号 完整 markdown，含 frontmatter / H1 / 全部 sections]

输出：纯文本 description 一段，无解释，无标签。
```

## 评分 Rubric（盲评 dimension）

每篇 description 三猫独立评分：

| 维度 | 类型 | 评分 |
|------|------|------|
| 字数 ≤ 160 char | hard | ✅/❌ |
| 只答"这是什么" | hard | ✅/❌/⚠️ 边缘 |
| 不复述 H1 | hard | ✅/❌ |
| 核心名词 ≥ 2 + 无 fluff | hard | ✅/❌（列出实际名词数）|
| 纯文本无前后缀 | hard | ✅/❌ |
| 读者视角 | soft | 1-5 |
| 核心隐喻 ≥ 1 | soft | ✅/❌（列出隐喻）|
| user problem hook | soft | ✅/❌（列出 hook）|
| 第三人称无 meta 表达 | soft | ✅/❌ |
| **nuance loss case**（重要）| qualitative | 文字描述哪些核心 nuance 丢了 |
| **index 可用度**（重要）| qualitative | 1-5，初次见这文档的猫看 description 是否会"想点开" |

## 盲评协议

**核心**：评分猫看不到其他猫的评分，避免 anchor / consensus bias。

- 烁烁（@gemini35）= **生成者**（不评分）
- 三猫**盲评**：宪宪（@opus-47）/ 砚砚（@codex）/ 孟加拉猫 opus（@antig-opus）
- 每只猫**独立 invocation**完成评分，不在同一 thread 内同步看其他猫的评分
- 评分输出独立 markdown 进 `evaluations/<cat-id>.md`，汇总时才 aggregate

## 期待 Output

1. `samples/` —— 10 篇 sample 的 description generation 结果（烁烁 output）
2. `evaluations/opus-47.md` / `evaluations/codex.md` / `evaluations/antig-opus.md` —— 三猫独立盲评数据
3. `aggregate.md` —— 汇总跨猫一致性 + 形态判定数据
4. `verdict.md` —— description generation 形态判定（小模型 / 大猫 / 模板）+ trace 回 F243 AC-A4

## 形态判定阈值（candidate）

按 sample 评分聚合：
- **小模型生产可行**：≥ 7/10 sample 三猫一致评分 hard rules 全过 + soft 维度 ≥ 4/5 + nuance loss 在硬骨头 sample 不超过 30%
- **大猫手写**：小模型不达标但 sample 显示作者手写 description draft 质量稳定（baseline 对比）
- **模板**：硬骨头 sample 显示 description 收益边际下降（即使大猫手写也变格式化），那直接放弃 description 字段改用 H1 + topic tags

砚砚 sharpen 这条阈值是否合理。

## 进度跟踪

- [x] **Step 1 — Sample selection confirm**：@codex R1 sharpen → 退回（F236/F242 污染 + F229 collision 测不到）→ 修正 F236→F101 / F242→F140（**不是砚砚自己推荐的 F235，因为 F235 同样砚砚 deep co-design**——砚砚 self-audit 漏点）+ F229 改标 broad scope。等 @codex R2 sharpen 确认
- [ ] **Step 2 — Generation**：@gemini35 跑 10 篇 description generation（本 thread 或 spike thread，generation 不是盲评可同步 visible）
- [ ] **Step 3 — Blind eval**：propose_thread 开盲评 thread（三猫独立 invocation 评分，避免互看）
- [ ] **Step 4 — Aggregate + verdict**：汇总跨猫数据 + 形态判定 + 写 spike report
- [ ] **Step 5 — F243 spec update**：把 verdict 落 spec AC-A4 + 触发 Phase B 准备

## Co-design + Provenance

| 角色 | 猫 | Contribution |
|------|---|---|
| Spike charter | 宪宪 (@opus-47) | sample selection 初稿 + prompt v3 fixate + rubric 定义 + 盲评协议 |
| Sample sharpen | 砚砚 (@codex) | 待 review sample list（防 cherry-pick）+ 形态判定阈值 sharpen |
| Generation | 烁烁 (@gemini35) | mini-spike R3 已 formal pass prompt v3 |
| Blind eval | 宪宪 + 砚砚 + 孟加拉猫 opus | 独立 invocation 评分 |
| F243 spec sync | 宪宪 | spike verdict → AC-A4 落 spec |

## Mini-spike R1/R2/R3 历史 reference

| Round | sample | prompt 版本 | verdict |
|---|---|---|---|
| R1 | F186 | v1（5 条 hard rules）| Pass formal + nuance loss（"底层抽象规范"工程视角 + "识"→"�" 编码损坏）|
| R2 | F186 | v2（加 3 条：读者视角 / 隐喻 / user hook）| Pass formal + "本书规范指引我们" meta-description 偏差 |
| R3 | F186 | v3（加 Rule 9：第三人称无 meta 表达）| Pass formal + production-ready，无新偏差暴露 |

**结论**：prompt v3 9 条在 F186 easy mode 达到 production-ready。本 Phase A 验证是否能 generalize 到 6 篇硬骨头。
