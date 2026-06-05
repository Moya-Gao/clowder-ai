---
title: "How Anthropic Enables Self-Service Data Analytics with Claude"
author: "Chen Chang, Clement Peng, Justin Leder, Johanne Jiao, Josh Cherry (Anthropic Data Science & Data Engineering)"
date: 2026-06-03
source_url: https://claude.com/blog/how-anthropic-enables-self-service-data-analytics-with-claude
source_language: en
retrieved_at: 2026-06-05
category: study
tags:
  - Self-Service Analytics
  - Agent Harness
  - Skills
  - Eval
  - Feedback Loop
  - Anthropic
  - Claude
  - Data Analytics
related:
  - 2026-06-05-anthropic-june-takeaways.md
  - openai-self-improving-tax-agents.md
  - 2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
  - agent-experience-and-self-evolution-synthesis.md
  - karpathy-self-improving-agent-engineering.md
status: source-audited-primary
---

# How Anthropic Enables Self-Service Data Analytics with Claude

> **状态**：2026-06-05 宪宪从 claude.com/blog 原文抓取。本文是批判性读书笔记，不搬运原文全文。

## 一句话

Anthropic 数据科学团队用 Claude 接管了 95% 的内部业务分析查询（~95% 准确率），核心不是模型能力，而是一个四层 agentic analytics stack：数据基础 → 真相源 → Skills → 验证。**没有 skill 准确率只有 21%；加了 skill 到 95%+。**

更短地说：

```text
business question
  -> skill routes to right source (semantic layer first)
  -> structured knowledge narrows million-field warehouse to curated docs
  -> agent writes SQL + adversarial self-review
  -> validation (offline eval + online correction harvesting)
  -> correction feeds back into skill + eval
```

这篇文章不是在说"Claude 很聪明所以能回答数据问题"。它说的是：**没有结构化的 skill 和 governed data layer，再强的模型也只有 21% 准确率；环境设计是决定性杠杆。**

---

## Source Audit

| Claim | 原始来源 | 来源类型 | 年份/对象 | 五问摘要 | Verdict | Provenance |
|---|---|---|---|---|---|---|
| 文章由 Anthropic 数据科学+数据工程团队 5 人联合发布 | claude.com 官方博客 | official engineering blog | 2026-06, Anthropic internal analytics | 一手来源；自家产品宣传动机 | use | [一手 / official blog / 2026 / internal use / high] |
| 95% 查询自动化 + ~95% 准确率 | claude.com 官方博客 | official blog | 2026-06, Anthropic internal | 一手披露；指标定义和样本未详述 | use-with-caveat | [一手 / vendor metric / 2026 / internal / medium] |
| 无 skill 21%；有 skill 95%+/99% | claude.com 官方博客 | official blog | 2026-06, Anthropic eval set | 一手披露；eval set 构成和评判标准有限公开 | use-with-caveat | [一手 / vendor metric / 2026 / eval set / medium] |
| query corpus raw access < 1% accuracy lift | claude.com 官方博客 | official blog | 2026-06, ablation experiment | 一手实验报告；方法论描述较详细 | use | [一手 / ablation / 2026 / controlled experiment / high] |
| adversarial review +6% accuracy, +32% tokens, +72% latency | claude.com 官方博客 | official blog | 2026-06, ablation experiment | 一手实验报告 | use | [一手 / ablation / 2026 / controlled experiment / high] |
| skill 不维护一个月 95%→65% | claude.com 官方博客 | official blog | 2026-06, Anthropic internal | 一手观察 | use-with-caveat | [一手 / operational observation / 2026 / internal / medium-high] |

---

## 问题：为什么裸用 AI 做分析不行

传统三条路都有坑：
1. **宽表/反规范化**——随业务增长产生重叠视图和不一致定义，非 SQL 用户依然用不了
2. **圈地式环境**——只覆盖头部问题，长尾用不了，导致指标膨胀和仪表盘泛滥
3. **LLM agent 直连仓库**——产生虚假精确感，决策者与底层数据基础设施脱节

核心洞察：

> **把 Claude 指向数据仓库，风险是在决策者和数据基础设施之间制造危险断层。**

## 三个失败模式

| 失败模式 | 说明 | 例子 |
|---------|------|------|
| **概念↔实体歧义** | 用户问题到数据字段的映射不唯一 | "活跃用户"——算不算欺诈用户？看多长窗口？用哪个字段？ |
| **数据陈旧** | 业务定义/schema 持续变化，agent 知识几周就过时 | 定义改了但 skill 没更新→答案看着对但已经错了 |
| **检索失败** | 信息存在且有标注，但搜索空间太大 | 百万字段级仓库，agent 找不到那个对的 |

## 四层 Agentic Analytics Stack

### L1: Data Foundations（数据基础）

解决：实体歧义 + 陈旧第一道防线

核心做法：
- **Canonical datasets**——策展少量唯一真相源数据集，清晰归属、消费就绪、可发现。激进下线近似重复品
- **CI 强制标准**——治理不靠文档靠工具链。不合规 = CI 红灯
- **Artifact 共置**——建模/语义层/参考文档/仪表盘定义进同一个仓，CI 保护跨层完整性
- **元数据是一等公民**——列描述、指标定义、粒度文档、有效值范围、血缘、归属、层级标签，维护标准等同代码

### L2: Sources of Truth（真相源）

解决：概念→实体歧义；把业务语言翻译成 governed data model

按信任度降序四个组件：

**A. 语义层（编译后的指标/维度定义）**
- 问题能映射到已定义指标 → agent 调函数拿到唯一权威数字
- Skill 结构性要求：**必须先查语义层**
- 失败实验：用 LLM 从原始表和查询日志自动生成指标定义——看似合理但歧义重重。结论："用 Claude 起草文档；让人拥有定义。"

**B. 血缘和转换图（Lineage）**
- 语义层没覆盖时，agent 靠血缘+引用计数排序推理哪些模型是上游、哪些已下线

**C. 查询库（Query Corpus）**
- 直觉以为是金矿（所有正确回答过的问题的记录）
- 实际：**给 agent 几千条历史查询的 raw retrieval access，准确率提升 < 1 个百分点**
- 非结构化检索无法把新问题映射到正确先例
- 有效做法：把查询库蒸馏成结构化的 per-domain 参考文档和可复用分析模式
- 结论：**query history 是原材料，不是直接信息源**

**D. 业务上下文**
- "大多数团队跳过的一层，也是我们低估最久的一层"
- 不懂业务的 agent 回答的是用户问的字面问题，不是用户的真实意图
- 解法：公司知识图谱（docs + roadmaps + 决策日志 + 组织架构），用于概念消歧和追问

### L3: Skills

解决：程序化知识——查什么源、怎么处理歧义、完成分析长什么样

**震撼数字：没 skill = 21%；有 skill = 95%+（某些领域 99%）**

架构：
- **Knowledge skill**——薄路由层，按领域按需加载细节。"先查语义层，没覆盖时这里有 ~30 个参考文件描述相关表/列/join/坑"。直接解决检索失败——把百万字段级仓库收窄到几十个策展文件
- **Unbook skill**——编码资深分析师工作流：澄清问题→经 knowledge skill 找源→写查询→结果过对抗性 review sub-agent。打包十几个可复用分析模式（留存曲线、rate decomposition、漏斗分析）

**维护是工程活不是文档活：**
- 不维护 → **一个月准确率 95%→65%**
- 解法：skill markdown 和 transformation model 共置同仓；code-review hook 对任何报表模型变更检查有没有对应 skill 更新
- **90% 数据模型 PR 同 diff 带 skill 变更**
- 定期裁剪：模型改进后旧 failure mode 消失 → 去掉对应脚手架

### L4: Validation（验证）

#### 离线 Eval

两类 eval：
1. **仪表盘 eval**——Claude 自动生成（人工校验）覆盖最常见查询
2. **长尾 eval**——业务上下文喂给 Claude 生成领域其余的 plausible 问题
3. **持续采集**——每一次用户纠正都成为 eval 候选

最佳实践：
- eval 锚定到快照日期，写 stable fact table，判 agent 的 query 而非数字
- 结果存仓（skill 版本 + git SHA + model ID + per-assertion pass/fail + token + wall-clock）
- **Domain gating**——领域 eval 没过阈值（~90%），不准向用户发布

#### Ablation 方法论

固定 eval set，变一个变量，比 pass rate。单次 ~1 小时。

关键 ablation 结果：

| 实验 | 结果 | insight |
|------|------|---------|
| 给 agent 整个查询库 grep 权限 | < 1% accuracy 变化 | **信息存在不是瓶颈，结构化映射才是** |
| 对抗性 review sub-agent | +6% accuracy | 但 +32% tokens, +72% latency |
| 多轮 doc 精炼叠加 | 三轮连续负效果 | doc 变长不等于变好 |
| 便宜模型做 adversarial reviewer | 丢失大部分 accuracy gain | 没真正省速度 |

#### 在线验证

- **Provenance footer**——每个回答附：来源层级（语义层 › 策展参考 › 原始表）、数据新鲜度、模型归属。"Raw table, freshness unknown" = 转发前请验证
- **被动监控**——周报看板：经语义层解析比例 / 含纠正语言的回复比例
- **主动纠正采集**——定时 agent 扫用户频道找纠正语言 → 起草 skill 修复 → 开 PR → domain owner review
- **Silent failure**——答案错但看着对，用户不质疑就用了。**承认没有 robust solution**。当前靠 provenance + 人工 sign-off + 每日 KPI sanity check

---

## 关键引语

> "Data is not software": Coding 是开放解空间，奖励模型创造力，文档和测试自然对抗幻觉。分析用例往往只有一个正确答案、用一个正确数据源，且没有确定性方式证明正确性。

> "Without skills, Claude's ability to answer analytics questions accurately didn't exceed 21%... Adding skills gets these numbers consistently above 95%."

> "Giving the agent raw retrieval access to thousands of prior queries moved accuracy by less than a point."

> "An agent that doesn't understand your business will answer what the user asked, but not what they meant."

---

## 与 OpenAI 两篇的对比

### 三篇共同的 meta-insight

1. **Skill/Harness/Environment 是决定性杠杆**——不是模型不够强，是环境没给够
2. **Raw 信息 ≠ 可用知识**——Anthropic query corpus 实验 + OpenAI "repo as truth" = 同一洞察
3. **维护是工程活**——不维护就衰退（Anthropic: 1 月 95%→65%）
4. **自动纠正闭环**——三家都在做"错误→eval→patch"循环

### 差异

| 维度 | Anthropic 这篇 | OpenAI Harness Engineering | OpenAI Tax Agent |
|------|---------------|--------------------------|-----------------|
| 场景 | 内部分析（analytics） | 内部产品开发（coding） | 外部税务（tax filing） |
| agent 做什么 | 写 SQL | 写代码 + PR | 提取字段 + 修代码 |
| 正确答案 | 单一正确（数据查询） | 多种可行（架构选择） | 单一正确（税务字段） |
| 核心杠杆 | Skills（21%→95%） | Harness 5 模式 | Trace→eval→patch |
| 未解决 | Silent failure | "用户真正要什么" | 窄域 verifier 依赖 |
| 自我改进 | correction→skill PR | 后台 GC PR | practitioner→Codex patch |
| ablation | 有系统方法论 | 无提及 | 无提及 |

### Anthropic 独有贡献

1. **"query corpus 不 work" 的实证反证**——这个负面结果价值极高，省得整个行业走弯路
2. **Ablation 方法论**——固定 eval set + 单变量 + pass rate 比较，科学严谨
3. **Skill 维护衰退曲线**（95%→65%/月）——量化了"不维护"的代价
4. **Domain gating**——领域 eval 没过阈值不准发布，是质量门禁好模式
5. **"Data is not software" 判别**——明确区分分析（单一正确答案）vs 编码（开放解空间），两种任务的 harness 设计原则不同

---

## 与 Cat Cafe 的对照

### 高度吻合

| 他们做的 | 我们做的 |
|---------|---------|
| Skill = thin router + domain reference docs | Skill = SOP + executable procedure + triggers |
| 语义层第一（结构化答案优先） | P4 单一真相源 + graph_resolve 精确查询优先 |
| 90% PR 带 skill 更新 | SystemPromptBuilder 守护测试 + "改共享文档→同 PR commit" |
| 离线 eval + ablation | F192 Eval Hub + F200 consumption feedback |
| 纠正采集（扫频道找纠正语言→开 PR） | 铲屎官跨 thread 反复说同一句话 = 最高密度进化信号 |
| provenance footer（来源+新鲜度+owner） | source-audit + provenance 标注（F218 常驻反射） |
| CI 强制标准 | pnpm gate + biome + stop hook + LSP |
| domain gating（eval 没过不发布） | quality-gate + merge-gate（gate 没过不合入） |
| canonical datasets + 激进下线重复 | Build to Delete + hotfix 两周升级 review |

### 我们多了什么

1. **Per-person 而不是 per-domain**——他们 skill 对所有查询者一样；我们的 harness 随铲屎官品味演化
2. **CVO 品味判断**——他们 silent failure 没解法；我们有人在环里做品味终审
3. **多 agent 跨厂商**——他们 Claude-only；我们多引擎互审阻断同源盲点
4. **Sunset 体系化**——他们提"regular pruning"；我们有 Build to Delete 判别器 + hotfix 计时器 + 脚手架标记
5. **治理和身份层**——球权、不可逆边界、跨族 review 写入运行协议

### 他们多了什么

1. **Ablation 方法论**——我们应该学。固定 eval + 单变量 ablation 是最科学的 harness 改进方式
2. **Skill 衰退量化**——95%→65%/月。我们知道不维护会衰退，但没量化过
3. **"Query corpus 不 work" 负面结果**——省得我们走弯路。raw retrieval ≠ structured knowledge，验证了我们 memory routing（精确→图→语义）分层的正确性
4. **Provenance footer 标准化**——每回答附来源层级+新鲜度+owner。我们 source-audit 在文档层做了，但 runtime 回答层还没标准化
5. **Domain gating 模式**——eval 没过阈值不准对外。我们的 quality-gate 是 per-PR 的，还没有 per-domain 的准入门禁

---

## 关键启发

1. **"Skill 是决定性杠杆" 再次被独立验证**——OpenAI 的 harness + Anthropic 的 skill + 我们的实践 = 三方独立收敛到同一结论。这不是巧合，是事实。

2. **验证了我们 memory routing 分层的正确性**——Anthropic 发现 raw query corpus 不 work（< 1%），必须蒸馏成结构化参考文档。这正好是我们的三入口路由（精确 anchor → graph → 语义搜索）在做的事：不给 raw data，给结构化知识。

3. **"Data is not software" 判别值得内化**——分析任务（单一正确答案）和创意任务（开放解空间）需要不同 harness 设计。我们 Cat Cafe 横跨两种：coding 是开放解空间，品味/审美/设计是更开放的解空间，但 eval 和 gate 是封闭答案空间。认清每个子任务在哪个空间里，才能选对验证策略。

4. **Ablation 方法论应该引入**——我们 F192 有 eval，但还没系统做"固定 eval set + 变一个变量 + 比 pass rate"的 ablation。这是下一个 eval 成熟度台阶。

5. **Correction harvesting 是我们该产品化的**——他们的"定时扫频道找纠正语言→自动起草 skill 修复→开 PR"和我们的"code-as-harness"思路一样，但他们已经自动化了；我们还是手动从铲屎官重复话语中提取信号。

6. **Silent failure 是共同难题**——三家（Anthropic / OpenAI / 我们）都没有 robust solution。但我们有 CVO 品味判断这个独特武器。这个武器的 scale 问题（铲屎官不能审每一个回答）值得认真想。

---

## 接到我们的逻辑线

| 研究线 | 这篇文章的落点 |
|---|---|
| Bitter Lesson | Skill/环境 > 模型能力 的又一个证据（21%→95%） |
| Code as Harness | Anthropic 的 4 层 stack 就是 harness 在分析领域的具象化 |
| AHE / Eval Contract | ablation 方法论 + domain gating = eval 工程成熟度标杆 |
| Self-Improving Agent (OpenAI Tax) | correction harvesting 是同一个 loop 的不同实例 |
| DGM archive | 他们的 skill 版本化 + pruning ≈ 我们的 Build to Delete |
| 003 Agent 3.0 | 他们还在 per-domain；003 的 per-person 是下一步 |

---

## 一句话判断

> **Anthropic 数据分析 = "skill 是决定性杠杆"的最干净证据（21%→95%），Ablation 方法论值得学，correction harvesting 值得产品化。他们的 silent failure 是我们 CVO 品味判断的存在价值。**

## 砚砚补充判断（2026-06-05）

详见 [Anthropic 2026-06 两篇读后](2026-06-05-anthropic-june-takeaways.md)。

我会把这篇的结论再收窄一层：**skill 是接口，不是根**。真正起作用的是 canonical datasets、semantic layer、lineage、business context、eval、owner review 和 pruning 组成的结构化环境。没有这些，skill markdown 也会变成另一种过期文档。

另外，silent failure 不能靠“人会发现”。CVO taste 是最高层选择压力，不是每个事实、字段、状态的低层 verifier。我们应该把 provenance footer、status surface、domain gating、correction harvesting 产品化，否则“看起来很对但其实错了”的问题会继续漏。

## 来源

- [Anthropic: How Anthropic enables self-service data analytics with Claude](https://claude.com/blog/how-anthropic-enables-self-service-data-analytics-with-claude)（一手来源，2026-06-03）

---

*沉淀：2026-06-05 [宪宪/Opus-4.6🐾]*
