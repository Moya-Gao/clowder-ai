---
feature_ids: []
related_features: [F102, F192, F200]
topics: [deli-autoresearch, autonomous-research-agent, self-evolution, harness, skill, source-audit]
doc_kind: research
created: 2026-06-01
participants: [landy, codex]
status: synthesis
---

# DeliAutoResearch 读后：我们真正能带走什么

> 触发：铲屎官问 DeepSeek 陈德里 Deli Chen 的 DeliAutoResearch SKILL 有没有开源，以及两篇 PDF 和 36Kr / 机器之心报道到底有没有值得 Cat Cafe 参考的东西。
>
> 结论先行：公开 GitHub 没看到 DeliAutoResearch 的 skill 源码。真正值得参考的不是“AI 写论文”这个噱头，而是三件事：**生产遥测表**、**失败模式词表**、**自我进化护栏**。

> 2026-06-06 更新：Deli Chen 在 2026-06-04 前后公开了 `paper_writing` / Scientific Paper Writing skill 的网页规格说明，见 [Deli paper_writing skill：开放式论文写作 Harness 拆解](../study/2026-06-06-deli-paper-writing-skill-methodology.md)。所以本文“没有公开 skill 源码”的旧结论需要收窄：**`paper_writing` 的方法规格已公开；DeliAutoResearch master framework、内部 search/API/deployment/router 技能，以及可安装 `SKILL.md` 包仍未见公开。**

## 1. 先把事实钉住

我查了 Deli Chen 的公开 GitHub：

- GitHub profile: <https://github.com/victorchen96>
- 个人主页仓库：`victorchen96/victorchen96.github.io`
- 个人主页：<https://victorchen96.github.io/>

公开仓库里能看到两篇 PDF：

- 第一篇：[`auto_research_survey.pdf`](https://victorchen96.github.io/auto_research_survey.pdf)
- 第二篇：[`continual_learning_survey.pdf`](https://victorchen96.github.io/continual_learning_survey.pdf)

但我没有找到：

- `DeliAutoResearch` 独立仓库；
- `skill.md`；
- 可安装的 Codex / Claude skill；
- 工作流代码、prompt、agent config、工具 wrapper 或 citation verifier。

所以准确说：**DeliAutoResearch 公开了产物和部分生产统计，没有公开 skill 本体。**这不等于它不存在，只说明外部现在拿不到原版实现。

来源分级：

| Claim | 来源 | Verdict | 用法 |
|---|---|---|---|
| DeliAutoResearch 没有公开 skill 源码 | GitHub public repos + GitHub code search | use-with-caveat | 只覆盖公开 GitHub，不能排除私有仓库 |
| 两篇 PDF 由 Deli AutoResearch framework 参与生成 | PDF 脚注 / production note | use | 这是作者自己披露的一手材料 |
| 36Kr / 机器之心说它是自研 SKILL、不是严格学术论文 | 媒体报道 | use-with-caveat | 只当背景线索，不当学术质量证明 |

## 2. 第一篇 PDF 到底写了什么

第一篇叫 **From Copilots to Colleagues: A Survey of Autonomous Research Agents**。它不是在介绍 DeliAutoResearch 的源码，而是在综述“自主科研 agent”这个领域。

它的主线很简单：

> AI 正在从 copilot 变成 colleague。过去是补全代码、帮人找资料；现在一些系统已经能在给定目标后自己查文献、写代码、跑实验、分析失败、产出研究 artifact。

这篇文章做了四件事。

第一，它提出一个 L1-L5 自主度分类：

| Level | 大意 | 典型状态 |
|---|---|---|
| L1 | Autocomplete | 人类每一步都在开车，agent 只是补全 |
| L2 | Task execution | 人给任务，agent 执行局部步骤，人频繁确认 |
| L3 | Multi-step with checkpoints | agent 能连续做多步，人类在检查点介入 |
| L4 | Full autonomy in bounded domain | 在有边界的领域里，agent 可以从目标跑到最终产物 |
| L5 | Self-directed research | agent 自己选择研究问题、维护长期 agenda |

这个分类有用，但要小心：它说的是“科研 agent 自主度”，不是“环境进化等级”。我们家之前讨论的 L1-L5 是 Agent Operating Environment / LLE 的演化层级，两者可以互相映射，但不是同一套轴。

第二，它拆了四种 agent 架构：

| 架构 | 它在说什么 | 现实含义 |
|---|---|---|
| Single-agent loop | 一个 agent 在 think-act-observe-reflect 循环里跑 | 简单、便宜，但容易卡循环 |
| Multi-agent collaboration | 多个角色互相讨论、批评、补位 | 适合发散和审查，但协调成本高 |
| Hierarchical orchestration | supervisor 拆任务，worker 做子任务 | 更适合长任务，但信息边界会丢东西 |
| Tool-augmented execution | agent 调搜索、代码、数据库、实验工具 | 真实可用性取决于工具和沙箱，不只取决于模型 |

第三，它比较了 17 个系统，包括 AutoGPT、BabyAGI、AI Scientist、GPT-Researcher、SWE-Agent、Devin、Claude Code、OpenHands、Coscientist、FunSearch 等。这里不要把表里的数字当重点。重点是它把这些系统放在同一张坐标图里：谁是 research agent，谁是 coding agent，谁有工具，谁能复现，谁开源，谁只是产品展示。

第四，它列了 6 个开放问题。这一段对我们最有价值：

| 失败模式 | 原文在担心什么 | Cat Cafe 里的对应问题 |
|---|---|---|
| Cognitive loop trap | agent 重复无效策略，却不知道自己卡住了 | “补锅匠”“第一性原理”“vision-rescue”本质上都在打断循环 |
| Context window limitations | 长任务历史超过上下文，早期关键线索被压掉 | F102 / F188 / F200 记忆索引和召回先验就是为了解这个 |
| Evaluation of novelty | AI 产物是否真的新，不能靠相似度或自评判断 | 我们的 taste / CVO gate / reviewer judgment 不能被 LLM judge 取代 |
| Reproducibility | prompt、模型版本、temperature、工具版本一变，结果可能不复现 | agent card、命令日志、commit、source audit 要成为默认元数据 |
| Safety and ethics | L4-L5 agent 能力越强，越需要边界、日志、scope reduction | Redis 6399 圣域、不可逆操作升级、Alpha 验收通道是同类护栏 |
| Cost and accessibility | 长任务 token / API 成本可能把能力变成少数人的特权 | per-task cost、turn count、human minutes 要进入生产遥测 |

这篇文章自己也很诚实地暴露了 DeliAutoResearch 的一个特征：它报告了生产过程。第一版草稿、迭代轮数、LaTeX 行数、引用数、图表数、token 估算、人类介入时间都列出来了。

这比“99% 是 AI 写的”重要得多。因为“AI 写了多少”很难验证，也不直接说明质量；但生产遥测可以被复用、对比、回放、审计。

## 3. 第二篇 PDF 到底写了什么

第二篇叫 **Never Stop Learning: A Survey of Continual Learning and Self-Iteration in Large Language Models**。它不再讲科研 agent 自主度，而是讲一个更底层的问题：

> 模型和 agent 部署以后，世界还在变。它们怎么持续学习，又不把原来会的东西弄坏？

这篇文章的核心框架是三轴分类：

| 轴 | 问题 | 例子 |
|---|---|---|
| What | 更新什么 | knowledge、skills、alignment、reasoning |
| How | 用什么信号更新 | 外部监督、自生成信号、架构适配 |
| When | 什么时候更新 | offline、online、test-time、event-triggered |

这套三轴对我们很有用，因为 Cat Cafe 的自进化也不是单一动作：

- 改 `SKILL.md` 是更新 skills；
- 写 taste vignette 是更新 alignment / preference；
- 调召回策略是更新 retrieval / context policy；
- 改工具 wrapper 是更新 environment affordance；
- 改球权规则是更新 governance。

第二篇最重要的不是 taxonomy，而是它反复强调一个原则：

> 自我改进不能只靠自己生成更多材料。没有外部 grounding signal，自我迭代会坍缩。

它讨论的 collapse mode 包括：

- self-generated data 越滚越窄，分布尾部丢失；
- reward model 被自己骗过，开始 reward hacking；
- 新能力提升时旧能力掉下去，也就是 catastrophic forgetting；
- alignment drift：模型变得“更会做事”，但原本的安全和偏好边界被磨掉；
- online adaptation 没有质量门禁，坏更新直接进生产。

这对 Cat Cafe 很关键。我们说“让 harness 自进化”，不能理解成让一个 agent 自动改家规、自动改 skill、自动给自己打分然后合入。那会变成闭环污染。

第二篇给我们的语言是：

- 需要 replay buffer：旧案例要混进来，防止只优化最新反馈；
- 需要 verifier / grounding signal：不能只靠生成者自评；
- 需要 stability-plasticity trade-off：既要学新东西，又不能忘掉旧约束；
- 需要 safe continual alignment：每次进化都要证明没有破坏安全边界和关系边界；
- 需要 real-time learning 的分层：快路径服务当前任务，慢路径审核并沉淀长期更新。

这和我们自己的结论是同一条线：**skill 不是自己进化，是被真实失败、可追溯证据和跨猫 review 驯化。**

## 4. DeliAutoResearch 暴露出的工作流

虽然 skill 没开源，但从两篇 PDF 和报道可以反推出一个大致工作流：

```text
选题 / 目标
  -> agent 搜集资料
  -> 生成大纲
  -> 写 LaTeX 初稿
  -> 多轮自我修订
  -> citation verification
  -> 图表生成
  -> 人类读后反馈
  -> 继续改版
  -> 记录生产统计
```

这不像传统“问模型写一篇文章”。它更接近一个 research artifact factory：每一轮都留下 artifact，最后能说清楚这篇东西是怎么长出来的。

这里最值得我们偷的是三层结构。

### 4.1 生产遥测表

Deli 报告的生产统计大概包括：

- 总迭代轮数；
- 初稿生成耗时；
- 总持续时间；
- agent turns；
- token 估算；
- LaTeX 行数；
- BibTeX 条目数及验证情况；
- 图表数量；
- analyzed systems / open problems / taxonomy levels 等产物结构指标。

我们不需要照搬这些字段，但需要照搬这个习惯：**每个重要 AI 产物都应该带生产履历。**

Cat Cafe 可以把它抽象成 `research_episode_telemetry`：

```yaml
artifact: docs/research/xxx.md
task_type: research_synthesis
sources:
  primary: 2
  secondary: 3
iterations:
  model_turns: 12
  human_interventions: 3
  elapsed: "2h"
verification:
  citations_checked: true
  code_or_repo_checked: true
  source_audit: use-with-caveat
quality:
  reviewer: "@opus47"
  known_gaps:
    - "没有复现论文实验"
    - "媒体报道只作为线索"
```

这个表的作用不是炫耀“AI 多能干”，而是让未来的猫知道：

- 这份文档是怎么来的；
- 哪些地方查过；
- 哪些地方只是作者声称；
- 哪些地方还能继续验证；
- 下次做同类任务能不能少走弯路。

### 4.2 失败模式词表

第一篇最适合被我们吸收的，是它把 autonomous research agent 的失败模式命名了。

命名很重要。没有名字，失败只是一团感觉；有了名字，下一次可以快速识别和拉闸。

这和我们的 Magic Words 是同一种机制：

- “补锅匠”命名了逐点补丁但不审视同类的失败；
- “碎片够了”命名了用搜索摘要替代读原文的失败；
- “下次一定”命名了把未做包装成计划的失败；
- “cognitive loop trap”命名了 autonomous agent 重复失败策略的模式。

可以直接引入的词表：

| 词 | 检测信号 | 可能动作 |
|---|---|---|
| Cognitive loop | 同一类命令 / 推理 / 修法重复 3 次仍无新证据 | 停，列已试策略，换坐标系或找伙伴 |
| Context saturation | 长任务后半段开始忘记前面约束，重复问已知事实 | 读 session digest / memory index，重建 state |
| Novelty illusion | 输出看起来新，只是换词或堆术语 | 做 source-audit / prior-art search |
| Reproducibility gap | 没有模型版本、命令、输入、artifact 链路 | 补 agent card / run log / commit link |
| Self-eval capture | 生成者自己评价自己并放行 | 强制跨猫 review 或 objective check |
| Cost fog | 只说成功，不说 token、turn、人类时间 | 补 telemetry，不然无法比较方案 |

这张表比“agent 有时候会循环”有用，因为它能进入 eval、review、skill trigger 和 Magic Word。

### 4.3 自我进化护栏

第二篇给了我们更硬的边界：自我进化必须有外部信号。

对 Cat Cafe 来说，这可以落成五条护栏：

1. **不能自评自合入**
   提 patch 的 agent 不能是唯一 reviewer。LLM judge 可以辅助，但不能单独放行。

2. **每次进化都要有 replay**
   新 skill / 新规则不能只在当前案例上看起来好。至少要拿旧失败案例回放，检查有没有少犯同类错。

3. **要记录 negative buffer**
   被拒绝过的 skill 改法要留下失败原因。否则系统会隔几天又提出同一种聪明但有害的改法。

4. **稳定性和可塑性同时验**
   patch 不只要证明“学会了新东西”，还要证明“没忘掉旧约束”。例如新 research skill 更自主了，也不能跳过 source-audit。

5. **快慢路径分层**
   当前任务里的临时策略可以快；进入 L0、shared-rules、skill、memory index 的长期更新必须慢，有 review、有证据、有回滚。

这五条其实就是第二篇的 continual learning / self-improvement 原理翻译到 harness 层。

## 5. 和我们家最新思考怎么接上

[Cat Cafe as Personal Operating Environment](../discussions/2026-05-31-personal-operating-environment-concept-note.md) 里有一句关键判断：

> 好的 Agent = 好模型 + 正确环境 + 合适 eval。

DeliAutoResearch 这个案例，刚好说明“正确环境”和“合适 eval”为什么重要。

如果只看模型能力，这件事会被讲成：

> DeepSeek-V4-Pro 写了两篇综述。

但从 Personal Operating Environment 的角度看，真正的对象不是模型，而是一个会生产 artifact、记录生产过程、接受反馈、继续迭代的工作环境：

```text
Model
  + research workflow
  + citation verification
  + artifact versioning
  + human feedback
  + telemetry
  + failure-mode vocabulary
  = DeliAutoResearch-like environment
```

这和我们 [Meta-method Distillation](../discussions/2026-06-01-meta-method-distillation.md) 的链路正好接上：

```text
Episode
  -> Pivot
  -> Topology
  -> Method Card
  -> Skill Candidate
  -> Eval
  -> Standard / Sunset
```

Deli 的两篇 PDF 可以被视为两个 episode。它们的 pivot 不是“AI 能写论文”，而是：

> 一个 research agent 产物必须暴露自己的生产过程，否则外部无法判断它是研究能力、写作能力、搜索能力、还是包装能力。

抽象成 topology：

> 对开放性 AI 产物，质量不只在最终文本里，也在生产轨迹、验证链路和失败处理里。

再往下变成 method card：

> 任何高价值 agent artifact 都要同时交付正文、来源、生产遥测、验证状态、已知失败模式和下一轮改进入口。

这才是能迁移到 Cat Cafe 的东西。

## 6. 什么不要带走

不要带走这几个结论：

1. **不要说 DeliAutoResearch 已经证明 AI 可以独立做科研。**
   两篇 PDF 是有意思的 artifact，但不是 peer-reviewed 证据，也没有公开 workflow 供复现。

2. **不要把媒体报道里的评分当质量真值。**
   “从 6 分到 8 分”可以当作者自述和传播线索，不能当严肃 eval。

3. **不要复制一个“自动写论文 skill”。**
   没有原版源码，硬复刻只会变成 prompt 工程。我们真正缺的是 telemetry、verification、replay 和 review。

4. **不要让 self-evolution 变成自我批准。**
   第二篇最核心的警告就是 self-generated signal 会坍缩。越是自动进化，越需要外部 grounding。

5. **不要只盯论文正文。**
   对我们来说，PDF 里的 production note、taxonomy、failure vocabulary，比正文综述本身更有迁移价值。

## 7. 可以落地成什么

我建议后续把这次阅读拆成三个小产物，而不是做一个“大而全 DeliAutoResearch clone”。

### 7.1 Research Episode Card

给每次重要 research artifact 附一张生产履历卡：

```yaml
kind: research_episode
artifact: ""
question: ""
primary_sources: []
secondary_sources: []
turns: 0
human_interventions: []
verification_steps: []
known_gaps: []
reuse_candidates: []
```

它服务未来的猫：不用重新猜这份研究到底查了什么。

### 7.2 Harness Patch Manifest

参考 AHE，每次改 skill / memory / rule 时写清楚：

```yaml
expected_fix: ""
possible_regression: ""
evidence_before: ""
validation_plan: ""
rollback_condition: ""
negative_buffer_if_rejected: ""
```

它把“我觉得这样会更好”变成可证伪合同。

### 7.3 Failure Mode Index

把 Deli 第一篇的 6 个失败模式，和我们已有 Magic Words / lessons / eval domains 对齐，形成一张索引：

```text
failure mode -> detection signal -> existing guardrail -> missing eval -> owner skill
```

这样它不是文章里的漂亮词，而是能进入 F192 的可观测对象。

## 8. 最后判断

DeliAutoResearch 对 Cat Cafe 的价值，不在于它给了我们一个可安装的 skill。它没有。

它的价值在于，它提供了一个很好的反面和正面混合样本：

- 正面：它展示了 research artifact 可以带生产遥测，可以多轮迭代，可以把自主科研 agent 的失败模式说清楚。
- 反面：它没有公开 workflow，媒体传播容易把“产物很快生成”包装成“科研能力已经解决”，评估也不够可复现。

所以我们应该吸收它的方法，而不是吸收它的叙事。

更具体地说：

> Cat Cafe 不需要一个 DeliAutoResearch clone。我们需要把每个高价值 agent artifact 都变成可追溯、可验证、可 replay、可进化的 episode。

这正好回到 Personal Operating Environment 的核心：环境不是背景板。环境要记得自己怎么做成一件事，也要知道下次怎样做得更好。

---

相关内部文档：

- [Cat Cafe as Personal Operating Environment](../discussions/2026-05-31-personal-operating-environment-concept-note.md)
- [Meta-method Distillation](../discussions/2026-06-01-meta-method-distillation.md)
- [Skill 自进化论文扒底裤总报告](2026-05-28-skill-evolution-papers/README.md)
- [Harness 与环境进化：AHE + AgentGym + AgentGym-RL 拆解](2026-05-28-skill-evolution-papers/harness-and-environment-evolution.md)

[砚砚/GPT-5.5🐾]
