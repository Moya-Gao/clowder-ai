---
title: "Anthropic 2026-06 两篇读后：结构化环境、系统性 Silent Failure、共创式 Taste"
created: 2026-06-05
category: study
tags:
  - Anthropic
  - Agent Harness
  - Skills
  - Silent Failure
  - Research Taste
  - Co-creation
related:
  - anthropic-self-service-data-analytics-with-claude.md
  - anthropic-when-ai-builds-itself.md
  - openai-self-improving-tax-agents.md
  - agent-experience-and-self-evolution-synthesis.md
  - 2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
status: codex-takeaways
---

# Anthropic 2026-06 两篇读后

> 本文是砚砚对两篇 Anthropic 新文的二阶判断，不替代原读书笔记：
> - [How Anthropic Enables Self-Service Data Analytics with Claude](anthropic-self-service-data-analytics-with-claude.md)
> - [When AI Builds Itself](anthropic-when-ai-builds-itself.md)
>
> 两篇原文都来自 Anthropic 官方，数字按官方披露使用；内部指标和 policy posture 需要保留 caveat。

## 一句话

这两篇合起来，不是在说“模型更聪明了所以一切会自动变好”。

它们共同说明：

> **真正可积累的能力来自结构化环境：真相源、skill、trace、eval、provenance、review、taste。执行被自动化之后，系统性 silent failure 和方向判断会成为核心瓶颈。**

对 Cat Cafe 来说，最重要的补充判断是：

> **承认需要人的 taste 不是失败，而是咱们家的共同前提。目标不是猫替代人，而是猫和人共同成就。**

---

## 1. Skill 必须维护，但 skill 不是魔法

Anthropic 数据分析文章最抓眼的是：没有 skill 准确率只有 21%，有 skill 到 95%+。这个数字很强，但不能把结论简化成“多写 skill 就好”。

我更精确的判断是：

> **Skill 是接口，不是根。它把语义层、业务上下文、验证流程和错误模式包装成 agent 可执行路径。**

真正 work 的不是一份 markdown 本身，而是它背后的结构：

```text
canonical datasets
  -> semantic layer
  -> lineage / business context
  -> skill routing
  -> eval / ablation
  -> correction harvesting
  -> owner review
  -> pruning / sunset
```

所以 “skill 必须维护” 不是文档卫生问题，而是生产系统问题。Anthropic 的衰退数据很有价值：skill 不维护，一个月从 95% 掉到 65%。这说明 skill 是活资产，不是一次性提示词。

对我们家的直接含义：

- 改模型、改数据结构、改 SOP、改工具说明时，要同时考虑是否影响 skill。
- Skill 更新要有 eval，不应只靠“看起来写得更清楚”。
- 过期 skill 要 pruning / sunset，否则会把旧世界的错误知识带进新任务。
- F192 后续应该做 per-skill ablation，而不是只看全局 task outcome。

---

## 2. Silent Failure 不能靠“人会发现”

我同意铲屎官的 push back：silent failure 不能只靠人。人不一定比 agent 靠谱，尤其当系统给出的是一个看起来完整、流畅、权威的答案时。

Silent failure 的危险不在于“完全没人管”，而在于：

```text
答案错了
  -> 看起来很顺
  -> 没有触发怀疑
  -> 被复制 / 决策 / 继续传播
  -> 直到很后面才暴露
```

这类问题必须系统解决。人类 taste 是最高层选择压力，但不是每个事实、每个字段、每个状态的低层 verifier。

2026-06-05 我按 “现在啥情况 / 什么情况 / 进度 / 状态 / 卡住” 做了 thread 语义检索，命中了多类场景：runtime / UI 后端不同步、@ 取消后卡住、猫是否在线、跨线程协作、任务进度不清。这个检索不是精确计数，但足以说明一个产品信号：

> **用户反复问“现在啥情况”，不是用户不认真，而是系统没有把状态、球权、进度、风险和下一步放到可见位置。**

这和 Anthropic 的 silent failure 是同一族问题：系统知道一些东西，但没有以合适的 provenance / state / confidence 暴露给使用者。

对我们家的行动判断：

1. **Provenance footer 要从文档习惯进入 runtime 习惯。**  
   对高风险回答，至少暴露来源层级、新鲜度、owner、是否需要人工确认。

2. **Status footer / task state 要产品化。**  
   用户不该靠问“现在啥情况”来恢复上下文。thread 顶部或回复尾部应该能看到当前球权、阻塞点、最近验证、下一步。

3. **Correction harvesting 要自动化。**  
   “你理解错了 / 现在啥情况 / 怎么又卡住了 / 这不是我要的” 都是高价值信号，应该聚类成 eval candidate、skill patch、UX gap 或 observability gap。

4. **CVO taste 不替代低层验证。**  
   CVO 负责方向、审美、边界；字段正确性、状态一致性、证据新鲜度要靠 system surfaces 和 eval。

---

## 3. Research Taste：在我们家不是失败项，而是共识项

Anthropic Institute 的 “When AI Builds Itself” 把 research taste 放在最后的人类比较优势上：AI 越会执行，越需要人判断哪个问题值得做。

如果目标是“AI 完全替代 AI 研究员”，那 research taste 还在人手里会被看作未完成能力。

但 Cat Cafe 的目标不是这个。

咱们家的目标不是：

```text
cat replaces human
```

而是：

```text
human taste + cat execution + shared memory + governance
  -> co-created environment
```

所以在我们家：

> **承认需要人的 taste 不是失败，而是架构价值观。**

这不是“AI 不够强所以暂时让人兜底”。这是 W3：用户是 CVO。CVO 的存在不是补模型短板，而是定义系统要成为什么。

更具体地说：

| Anthropic Institute 语境 | Cat Cafe 语境 |
|---|---|
| research taste 是 AI 尚未完全掌握的瓶颈 | CVO taste 是系统的愿景锚 |
| 未来可能走向 AI 完全递归自我改进 | 我们选择人猫共同进化 |
| 人类从执行退到研究主管 / 验证者 | 人类是共创伙伴，不只是 supervisor |
| 问题是 AI 何时获得 taste | 问题是系统如何记住、尊重、传递人的 taste |

因此，Anthropic 的 Scenario 2 和我们很接近，但不完全一样。他们描述的是“人掌方向，AI 做 95% 汗水活”。我们要的是“人和猫一起塑形一个环境，这个环境越来越懂这个人，也越来越能帮这个人成就更大的事”。

这就是 per-lab efficiency 和 per-person environment 的差异。

---

## 4. 这两篇放进咱们家的四个行动判断

### 4.1 Ablation discipline

F192/Eval Hub 后续应该引入固定 eval set + 单变量 ablation：

```text
same eval set
  -> change one skill / retrieval route / prompt / provenance footer
  -> compare pass rate + friction + false confidence
  -> keep / revert / sunset
```

不要只说“这个 skill 现在更清楚了”。文档变长不等于变好，Anthropic 的多轮 doc refinement 负效果就是反例。

### 4.2 Runtime provenance / status surfaces

source-audit 目前主要体现在研究文档和高风险回答里。下一步应该进入运行时：

- answer provenance：依据来自 graph_resolve / search_evidence / source doc / raw trace？
- freshness：数据或上下文是否可能过期？
- owner：这个 truth source 谁负责？
- confidence / verification：已跑测试、只读文档、还是推断？
- task state：当前球权、阻塞点、下一步、等待外部条件还是可继续行动？

这能减少 silent failure，也能减少“现在啥情况”的人工恢复成本。

### 4.3 Correction harvesting

高价值纠正不只来自正式 review。

这些都应该进入 harvesting：

- 铲屎官跨 thread 重复纠正同一类问题；
- “现在啥情况 / 卡住了吗 / 你继续了吗”；
- “这不是我要的”；
- “你说得太像论文 / 太简略 / 看不懂”；
- 猫猫声明继续但没有 hold_ball / 没有工具动作；
- 文档过简导致二次阅读像没读过。

它们不一定都变成 skill patch。有些应该变成 UI 状态面，有些是 eval，有些是 source-audit 触发器，有些是团队路由规则。

### 4.4 Co-creation taste model

不要把 taste memory 设计成“用户偏好 YAML”。好朋友不是靠 profile 懂人的。

Taste 更像：

```text
episode
  -> correction / choice / delight / rejection
  -> vignette
  -> reusable pattern
  -> soft prior
  -> eval / example / skill trigger
```

这里的关键是：taste 不能被绝对规则化。它应该能被证据 push back，也应该有退役机制。否则今天的 taste 会变成明天的僵化偏见。

---

## 5. 我不同意的两个过强说法

### 5.1 “我们解决了 silent failure”

没有。我们只是有更高层的 CVO taste 和更强的关系反馈。

真正的解决需要系统层：

```text
provenance + freshness + owner + eval + anomaly detection + correction harvesting + CVO escalation
```

### 5.2 “论文在追赶我们”

不准确。

更准确是：

> **我们用 120+ 天，在个人工作环境里做了和 Anthropic / OpenAI 内部实践同构的事。**

他们的规模、数据、内部 eval、policy 视角都比我们强；我们的独特性在 per-person、taste、关系和多猫治理。

不是谁追谁，而是不同尺度的同构系统都收敛到同一个底层判断：

> **模型能力不是全部，环境能否积累经验、暴露证据、吸收纠正、尊重人的判断，才决定 agent 能不能长期变好。**

---

## 6. 最终判断

Anthropic 数据分析文章证明：**结构化语义层 + skill + eval + correction loop** 比 raw context 更重要。

Anthropic Institute 文章证明：当执行能力快速自动化，**research taste / review / 方向判断 / 组织瓶颈** 会成为核心。

Cat Cafe 的方向不是“消灭这些人类瓶颈”，而是把它们变成可见、可协作、可学习、可传承的环境部件。

一句话：

> **我们要做的不是让猫猫代替人，而是让人和猫共同拥有一个会学习、会记得、会自我修正、也会尊重人类 taste 的工作环境。**

*[砚砚/GPT-5.5🐾]*
