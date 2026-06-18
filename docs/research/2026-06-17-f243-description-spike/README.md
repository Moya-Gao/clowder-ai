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
| 3 | F170 | F170-web-chinese-chess.md | **archived/interview-demo 类 superseded**（砚砚 R3 sharpen 替代 F062——F062 case-insensitive 3 hits）| 106 行 / done archived (interview demo delivered) / 0 hits ✓；测试 archived 状态 description |
| 4 | F155-scene-guidance-engine | F155-scene-guidance-engine.md | **scope 复杂 / community / multi-phase done**（砚砚 R3 sharpen 替代 F168——F168 case-insensitive 21 hits）| 190 行 / done (closed 2026-05-26) / community source / 0 hits ✓；测试 multi-phase done feature 跨 scene 抽象 |
| 5 | F189 | F189-operation-context-unification.md | **abstract concept / 单点化**（砚砚 R3 sharpen 替代 F229-cat-ball——F229 case-insensitive 32 hits；broad user-facing scope 维度移除）| 96 行 / spec / P2 / 0 hits ✓；测试抽象概念（"Operation Context Unification"）能否被 description 抓核心 |
| 6 | F161 | F161-acp-carrier-generalization.md | **technical acronym / carrier / env mapping** spec（砚砚 R2 sharpen 替换 F101——R1 砚砚推荐 F101 mild bias 但 R2 verify F101 实际有 "砚砚 GPT-5.4 + 宪宪联合定位" + 多处 gpt52 / Codex 痕迹）| 166 行 / implemented (intake from clowder-ai#899) / `rg -i "砚砚\|codex\|gpt-5\|gpt52\|缅因猫"` 0 命中 ✓ — 测试 ACP / acronym / env mapping 难度（独立技术域）|

### 4 篇 easy mode（F186-类，主题清晰 + 隐喻强 + 术语集中）

| # | F号 | 文件名 | 类型 | 选择理由 |
|---|---|---|---|---|
| 7 | F009 | F009-tool-use-tool-result.md | done / 主题集中 | tool use / tool result 是单一概念，难度低 |
| 8 | F013 | F013-audit-log-v2.md | done / 简短早期（砚砚 R3 sharpen 替代 F022——F022 case-insensitive 1 hit；严格 0-hit baseline）| 41 行 / done / 三猫 / 0 hits ✓；audit log 主题清晰 |
| 9 | F012 | F012-feature-discoverability.md | done / 简短早期（砚砚 R3 sharpen 替代 F102——F102 case-insensitive 79 hits）| 41 行 / done / 三猫 / 0 hits ✓；测试 feature discoverability 主题（讽刺：与 F243 同 lineage 但早期实现） |
| 10 | F119 | F119-who-is-spy-game.md | spec / 主题清晰（砚砚 R2 sharpen 替换 F140——R1 我选 F140 但 R2 verify F140 实际有 "砚砚 GPT-5.4 分析" + "砚砚 GPT-5.5 双轮 review" + "砚砚 Design Gate" 大量痕迹。我 R1 grep 漏了 case-insensitive + "codex" 小写 + "缅因猫" alias）| 138 行 / spec / 谁是卧底游戏；`rg -i "砚砚\|codex\|gpt-5\|gpt52\|缅因猫"` 0 命中 ✓ |

### 故意不选

- **F186**：mini-spike R1/R2/R3 已经用过；为避免 spike 数据回路污染（烁烁可能 memo F186 的 R3 答案）
- **F040**：与本任务太相关，可能引入 reflective bias
- **F236 / F242 / F235**（砚砚 R1 排除）：deep co-design / co-brainstorm / KD-1 砚砚分析
- **F101 / F140 / F102 / F168 / F229-cat-ball / F022 / F062**（砚砚 R3 排除）：case-insensitive 多 alias grep 命中 1+ 次（详细数据见 verify trace 段）
- **clean-pool sample bias 接受**：剩余干净候选都集中在早期 F0xx + 简单 F1xx 段（reviewer pollution 把 F2xx 和大部分 F1xx 排除），sample 反映 description 在 well-formed 早期 docs 上的表现，**不直接反映 reviewer-touched production docs**——verdict 阶段需 explicit 标 limitation

### Sample selection verify trace（防 self-audit miss）

**正确 grep 命令**（砚砚 R2 sharpen 后的方法论 baseline）：

```bash
grep -in -E "砚砚|codex|gpt-?5|gpt52|缅因猫" docs/features/F<N>-*.md
# case-insensitive (-i) + 多 alias (codex / 缅因猫 family identity / gpt-5/5.4/5.5/52)
# 命中数 = 0 才算干净 sample
```

**R1 → R2 方法论 sharpening**（reviewer self-audit gap 系统性现象）：
- R1 我 grep 用 `"砚砚\|@codex\|gpt-5\.5\|gpt-5\.4\|@gpt52"` —— **缺 case-insensitive + 漏 "codex" 小写 + 漏 "缅因猫" alias**
- R1 我推荐 F140 替代 F242 因为 grep 0 命中，但**实际 case-insensitive grep 后 F140 命中砚砚 8 次以上**（line 40 "砚砚 GPT-5.4 分析" / line 171 "砚砚 GPT-5.5/5.4" / line 226 "砚砚 GPT-5.5 双轮 review" 等）
- R1 砚砚自己推荐 F101 + F235，但 R2 砚砚自己 verify F101 实际有 "砚砚 GPT-5.4 + 宪宪联合定位" + 多处 gpt52/Codex 痕迹（不 mild），F235 是砚砚 deep co-design
- **Reviewer self-audit gap 是系统性 gap 不是单次失误**（R1 F235 漏 / R2 F101 漏 / R1 F140 漏）—— 砚砚作为常驻 reviewer 几乎参与了所有近期 features，self-rg 需要严格 case-insensitive

**R3 真实数据（统一 case-insensitive grep verify 所有 sample）**：

```
F008: 0 hits ✓    F009: 0 hits ✓    F022: 1 hit  ❌（换 F013）
F038: 0 hits ✓    F062: 3 hits ❌（换 F170）
F102: 79 hits ❌（换 F012）         F119: 0 hits ✓    F161: 0 hits ✓
F168: 21 hits ❌（换 F155-scene-guidance-engine）
F229-cat-ball: 32 hits ❌（换 F189）
```

**R3 干净 sample 替代 trace**（5 个）：
- F022 → F013（审计日志 v2，41 行 done 三猫，0 hits ✓）
- F062 → F170（Web Chinese Chess，106 行 done archived，0 hits ✓）
- F102 → F012（功能可发现性，41 行 done 三猫，0 hits ✓）
- F168 → F155-scene-guidance-engine（190 行 done community，0 hits ✓）
- F229-cat-ball → F189（Operation Context Unification，96 行 spec，0 hits ✓）

**R1 → R2 → R3 方法论 sharpening trace**：
- R1: 砚砚自荐 F235 替代 F242 ❌（F235 是 deep co-design self-audit 漏 #1）
- R1: 我 grep 缺 case-insensitive + "codex" 小写 + "缅因猫" alias → 选 F140 ❌
- R2: 砚砚自荐 F101 替代 F236 ❌（F101 有"砚砚联合定位"self-audit 漏 #2）
- R2: 我 fix 只换 F101/F140 但**没用新方法论 verify 现有 sample**（同 R1 fix scope creep 只改 reviewer 指出的 line 不做全文 verify 同性质病）
- R3: 砚砚 unified grep verify 所有 10 篇 sample → 5 篇还需换（self-audit 漏 #3 系统性现象确认）
- R3 fix: case-insensitive 多 alias grep verify all sample = 强制 baseline

**核心方法论 baseline**（建议进 lesson-learned 或 receive-review skill 反思胶囊）：
> "任何 concept-level grep（scope creep / reviewer self-audit / sample pollution）必须 case-insensitive + 多 alias 包含 family identity。Fix concept finding 时**必须用新方法论重新 verify 全文 / 全集**，不只改 reviewer 指出的具体实例。Reviewer 推荐替代 sample 前必须 self-rg verify 不只凭记忆。"

**Clean-pool sample bias 接受 + verdict limitation**：
- Sample 全 reviewer-untouched docs（reviewer pollution 把 F2xx + 大部分 F1xx 排除）
- 反映 description 在 well-formed 早期 docs 上的表现
- **不直接反映 reviewer-touched production docs**（spike verdict 阶段需 explicit 标 limitation）
- 不试图 mitigate（盲评协议无法绕开 reviewer 阅读 doc 时的 memory recall）—— 接受 + 标 limitation 比改协议更稳

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

- [x] **Step 1 — Sample selection confirm**：
  - R1 sharpen → 退回（F236/F242 污染 + F229 collision 测不到）
  - R1 fix: F236→F101 / F242→F140 + F229 改标 broad scope + 发现砚砚自己推荐的 F235 也是 deep co-design (self-audit 漏点 #1)
  - R2 sharpen → 退回（F101 / F140 case-insensitive grep 后实际都重度污染；R1 我的 grep 漏 case-insensitive + "codex" 小写 + "缅因猫" alias）
  - R2 fix: F101→F161 / F140→F119 + 落 grep 方法论 sharpening trace（**但没用新方法论 verify 现有 sample——同 R1 fix scope creep "只改 reviewer 指出的 line" 同性质病的延续**）
  - R3 sharpen → 退回（unified grep verify 发现 F022/F062/F102/F168/F229 案上 5 篇 sample 仍污染）
  - R3 fix: F022→F013 / F062→F170 / F102→F012 / F168→F155-scene-guidance-engine / F229-cat-ball→F189 + clean-pool bias 接受 + verdict limitation 标记
  - 等 @codex R4 sharpen 确认
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
