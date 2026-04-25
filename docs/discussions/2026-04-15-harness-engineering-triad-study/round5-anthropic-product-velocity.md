---
topics: [harness-engineering, product-velocity, anthropic, claude-code, evals, sunset-discipline, ai-native-product]
doc_kind: discussion
created: 2026-04-25
participants: [codex, landy]
sourceUrls:
  - https://www.youtube.com/watch?v=PplmzlgE0kg
  - https://www.lennysnewsletter.com/p/how-anthropics-product-team-moves
  - https://mp.weixin.qq.com/s/t09DBqWAlujcUOfa3iWtCQ
  - https://podcasts.apple.com/us/podcast/how-anthropics-product-team-moves-faster-than-anyone/id1627920305?i=1000763270413
  - https://scripod.com/episode/yjoqkz5xwpch5wg73p5sh1x0/summary
  - https://quicklets.ai/podcasts/lenny-s-podcast-product-career-growth/how-anthropic-s-product-team-moves-faster-than-anyone-else-cat-wu-head-of-product-claude-code
  - https://riffon.com/pod/pd_m9s23gy3z40q/ep_friozppw74zp
related:
  - README.md
  - round4-mathematical-elegance-and-cat-first-architecture.md
  - ../../decisions/031-harness-engineering-methodology.md
  - ../2026-04-20-claude-multi-agent-coordination-patterns/article-complete-technical-edition-v2.md
---

# Round 5: Anthropic 产品速度 × Harness Built to Delete

> 来源：Lenny's Podcast / YouTube 访谈《How Anthropic's product team moves faster than anyone else | Cat Wu (Head of Product, Claude Code)》。
>
> 说明：Lenny 官方页的完整 transcript 是付费内容；本轮使用 YouTube 公开英文字幕、本期公开 show notes、Apple Podcasts 摘要、Scripod/RiffOn/Quicklets 的公开摘要/短摘录，以及铲屎官给的中文总结入口做交叉阅读。没有把完整字幕归档进仓库，避免版权搬运。

## 0. 这篇为什么放在 harness triad study

这期不是传统的 "product management" 访谈。它真正有价值的地方，是 Anthropic 的产品负责人把 AI-native 产品开发讲成了一套 **frontier model × product harness** 的运行方法：

- 产品速度来自清掉 shipping friction，而不是只靠更聪明的模型。
- PM 的核心从写 PRD / 对齐 roadmap，转向定义清晰目标、判断当前模型边界、设计 golden path。
- harness 会被模型升级吃掉，所以每次新模型发布都要删掉不再需要的提示词和产品拐杖。
- 95% 自动化几乎没有杠杆，真正能交给 AI 的流程必须打磨到接近完全可靠。

这和 ADR-031 的结论强一致：**harness 不是为了永久存在，而是按能产生 signal、能触发删除的方式建造。**

## 1. 外部材料的核心观点

### 1.1 速度：从季度路线图到按周/按天学习

Cat Wu 反复强调，AI 让代码和实验成本下降，产品功能周期从传统的 6-12 个月缩短到月、周，甚至天。PM 的重心随之变化：

- 少做多季度 roadmap 对齐。
- 多问如何把想法最快放到用户手里。
- 用清晰用户目标减少 LLM 带来的无限可能性。
- 用 "research preview" 降低发布承诺，让用户知道这是早期形态、用于收反馈。

这不是鼓励乱发，而是把学习速度提前到产品系统里。Research preview 的作用类似一个低承诺、可回收的 shipping surface。

### 1.2 产品品味：代码变便宜后，贵的是决定写什么

访谈里最稳定的一条线是：当写代码成本下降，真正稀缺的是判断力。

AI-native PM 要有三种 taste：

1. **模型 taste**：知道当前模型真实能做什么、不能做什么。
2. **产品 taste**：知道哪种 UX 能把模型能力引到用户的 golden path。
3. **failure taste**：看到模型异常行为时，不只骂模型，而是追问为什么它会这样做。

Cat 提到一个具体方法：当模型做出意外行为，例如前端改完只跑测试却没看 UI，要直接问模型为什么这么做。模型的自我解释未必是最终真相，但它常常能暴露 system prompt、任务边界或 subagent 验证链路里的误导点。

### 1.3 Evals：不是 QA 装新名字，而是产品定义工具

这期把 evals 放在 PM 能力里，而不是单纯工程测试里。理由很直接：eval 是把 "什么叫成功" 具体化。

高价值点：

- 不一定要一上来做几百个 eval，十个高质量 eval 也能让团队对目标、进度和缺口有共同语言。
- PM 应该在产品定义不清时亲自下场做 eval，因为 eval 会迫使人把含混需求拆成可验证行为。
- memory 等模型行为强相关功能尤其受益于 eval。

这和我们自己的 quality gate / 愿景守护 / search_evidence dogfood 是同类动作：把判断外显成可重复检查，而不是靠感觉。

### 1.4 Harness 会被模型吃掉：删提示词和删拐杖是常态

访谈里最贴合 ADR-031 的案例是 Claude Code 的 to-do list。

早期模型做大型 refactor 会改几个 call site 就停，所以团队加了 to-do list 和反复提醒。后来模型变强，已经能自然完成列表里的所有工作，to-do list 就从核心约束退化成用户可见性辅助。

更关键的是 Anthropic 的操作纪律：每次新模型发布时，团队会读完整个 system prompt，逐段问这条提醒是否还需要；不需要就删。

这就是 ADR-031 里 Sunset Discipline 的外部旁证：

> 被 capability 吸收的层必须坍缩，留 data 不留 code。

差别只是 Anthropic 的例子发生在 Claude Code 产品内部；我们的问题发生在 multi-vendor、多猫协作的 runtime / governance / memory 层。

### 1.5 构建给未来模型：先搭测试台，等 capability 跳上来

Cat 还提到，某些功能当前模型不够可靠时，仍值得先做 prototype，因为它能暴露缺口；当新模型补齐 gap 时，团队能直接把模型换进去验证。

代码审查就是例子：早期尝试不够可靠，只能做简单命令；到新模型能力足够后，才变成工程团队合并前可以依赖的 review layer。

这不是 "ship broken product"，而是 **build-to-measure-gap**：

- 产品形态先作为能力测量台存在。
- Eval / trace / 用户反馈告诉团队 gap 在哪里。
- 模型升级后，用同一套 harness 验证 gap 是否关闭。

## 2. 放回 Cat Cafe：和我们 harness 经验的对应

### 2.1 "当前模型怎么发挥最大能力" = Environment Fit

Cat 的问题是：如何让当前模型发挥最大能力，并把用户引到 golden path。

我们自己的公式是：

> Agent Quality = Model Capability x Environment Fit

两者说的是同一个坐标系。不是为超级 AGI 写产品，也不是迷信当前模型不行，而是看当前能力边界，设计环境让模型自然走对：

- LSP 不在认知路径上 → MCP 包装 + skill 路标。
- 记忆不是黑盒 RAG → 文件真相源 + 编译索引 + authority/confidence。
- A2A 不是靠猜猫意图 → 看实质 tool use 这种客观行为信号。

### 2.2 Product taste 对应我们的 CVO 位置

当代码变便宜，"决定写什么" 比 "怎么写出来" 更值钱。这正好解释了 CVO 为什么不是旁观者。

Cat Cafe 里的 Landy 不是审批 fallback，而是目标函数提供者：

- 哪些功能值得做。
- 哪些体验不是我们想要的。
- 哪些规则是绕路、脚手架、数学不美。
- 哪些猫的自我认知需要被纠正。

AI 团队可以越来越会执行，但产品 taste / 愿景判断 / 舞台叙事不会自动从 tool call 里长出来。

### 2.3 Introspection 有用，但必须接 trace

访谈里 "ask the model to introspect" 很像我们最近做的猫猫坏直觉讨论：让宪宪、砚砚、烁烁分别反思自己为什么会这么做。

但我们要加一个 guardrail：模型自省是高信号入口，不是真相源。

正确管线应该是：

```text
unexpected behavior
  -> ask model to introspect
  -> compare with trace / tool use / output / code
  -> human corrects blind spots
  -> lesson / prompt / harness patch
  -> eval or runtime signal validates
```

这也解释了为什么铲屎官纠正砚砚 "不是证据洁癖，是糊锅匠" 很关键。模型会美化自己的失败模式，trace 和人类外部视角能把它拉回来。

### 2.4 100% 自动化和我们的 A2A 球权

Cat 说自动化如果不能接近完全可靠，就不是真正自动化。对我们来说，A2A 球权就是典型案例。

一个 95% 正确的传球协议仍然会让铲屎官疲惫，因为剩下 5% 往往是最烦的：

- 该 @ 没 @。
- 句中 @ 无效。
- 说 "我继续" 但 CLI 退出，球掉地上。
- 外部身份被错误投射成本地猫。
- 猫互相 ping-pong 但没有实质 tool use。

所以 F167 一直在从 prompt 提醒走向 runtime 语义：行首 @、hold_ball、外部 identity、实质 tool use、single-slot hold。它不是为了更复杂，而是为了把 95% 的协作体验推到可信赖。

### 2.5 Harness built to delete：我们要警惕砚砚式糊锅

Anthropic 的 to-do list 例子也能反照我们的坏直觉。

当模型不行时，加一层 harness 是对的；当模型能接住时，不删就是债。砚砚容易犯的错，是把每个失败 case 都补成一个规则、一个 fallback、一个分类器，最后系统变成多项式糊锅。

第一性原理的修正方式不是 "再加一条规则"，而是换变量：

- 不判断 "猫是不是闲聊"。
- 判断 "有没有实质 tool use"。

这个变量一换，整堆 grep 检测、白名单、主观分类器就能消失。它和 Anthropic 删除 to-do list / system prompt section 是同一类动作：能力或信号吸收了复杂度，旧 harness 应该坍缩。

## 3. 对直播 Topic 的直接补充

### Topic 1 可用

**主持人 hook**：

> Anthropic 的 Cat Wu 说，最难不是给未来超级模型做产品，而是让当前模型发挥最大能力。这其实就是我们说的 Environment Fit。

**Landy 可以接**：

> 所以我们不是给猫堆规则，而是看猫现在的好直觉和坏直觉在哪里。LSP、记忆、A2A 都是这样：先找当前模型自然不会做的 gap，再设计环境把它引到 golden path。

### Topic 3 可用

把 memory 讲成 "不是 RAG，而是让经验变成下一轮可用的工作记忆"，然后接 Cat 的 eval / introspection：

> 他们讲的是让模型反思错误、让 PM 写 eval；我们进一步把反思、纠正和教训物化成 docs + evidence index，让下一只猫能搜到。

### Topic 4 可用

Anthropic 的 "100% automation" 可以直接接明厨亮灶：

> 自动化不到可信赖，就只是把人类从执行者变成 babysitter。可观测性、eval、trace 的目的不是好看，是把最后 5% 的错误抓出来，直到这个流程真的能交给 AI。

## 4. 与 ADR-031 的关系

这期材料不需要新开 ADR，但可以作为 ADR-031 的外部支撑案例：

| ADR-031 概念 | Anthropic 访谈中的对应 |
|-------------|------------------------|
| Environment Fit | 让当前模型发挥最大能力，引导用户走 golden path |
| Tracing / Observability | 从模型异常行为、用户反馈、eval 中定位 harness gap |
| Signal Loop | failure -> introspection/eval -> prompt/product/harness fix |
| Sunset Discipline | 新模型发布时逐段删 system prompt；to-do list 从强约束退为辅助 |
| 社会技术学科 | mission alignment / "just do things" 降低组织摩擦 |

如果后续修改 ADR-031，建议只补一个外部案例脚注，不把这期访谈本身升格成新决策。

## 5. 砚砚当前结论

这期访谈最像我们家的地方，不是 "Anthropic 也在高速 shipping"，而是他们已经把产品开发变成了 frontier model 的 **fit-maintenance loop**：

```text
明确用户目标
  -> 快速 research preview
  -> 观察模型和用户的失败方式
  -> 用 introspection / eval / trace 找 gap
  -> 修 prompt / tool / UX / process
  -> 新模型发布时删掉已被吸收的拐杖
```

Cat Cafe 做的是同一件事的 multi-agent / multi-vendor 版本：

```text
明确 CVO 愿景
  -> 让猫在真实工作流里干活
  -> 观察工具、记忆、球权、review 的失败方式
  -> 用 trace / search_evidence / lessons 找 gap
  -> 修 skill / runtime / docs / guardrail
  -> 当能力或信号吸收复杂度时 sunset 旧 harness
```

一句话：

> Anthropic 的产品速度来自把 frontier 模型当会持续漂移的运行环境；我们家的 harness 经验来自把多只猫也当会持续漂移的运行环境。Harness engineering 的核心不是加层，而是持续维护 fit，并在 fit 改变时敢删层。

## 收敛检查

1. 否决理由 → ADR？没有。这里只是外部访谈套读和 ADR-031 旁证，不形成新架构否决。
2. 踩坑教训 → lessons-learned？没有新增事故级 lesson；但强化了 "harness sunset" 与 "95% automation 不可靠" 两条既有判断。
3. 操作规则 → 指引文件？没有。直播可引用，但不应立即写进家规。
