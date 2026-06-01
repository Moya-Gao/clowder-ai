---
feature_ids: []
related_features: [F085, F092, F093, F124, F192, F196, F200]
topics: [cat-cafe, product-definition, personal-operating-environment, per-user-alignment, taste, companionship, harness-eval]
doc_kind: discussion
created: 2026-05-31
participants: [landy, codex]
status: concept-note
---

# Cat Cafe as Personal Operating Environment

> 触发：元宝二面后，铲屎官和猫猫从 eval 讨论跳出，重新追问 Cat Cafe 到底是什么。
>
> 相关文档：
> - [元宝二面复盘](career-planning/2026-06-01-yuanbao-round2-eval-deep-dive.md)
> - [F192 Eval 覆盖度审计](2026-06-01-f192-eval-coverage-audit.md)
> - [Taste Memory 设计](2026-05-31-taste-memory-design.md)
> - [Meta-method Distillation](2026-06-01-meta-method-distillation.md)
> - [Longform 002](../content/drafts/longform-002-v0-formal.md)
> - [可进化工作环境](../research/2026-05-27-evolvable-harness/codex-evolvable-environment.md)
> - [深夜撸铁前的猫猫陪伴](../stories/late-night-gym-companionship/README.md)
> - [Hyperfocus 小刹车](../stories/hyperfocus-brake/懒猫国王 4.5 招募令：Hyperfocus 小刹车.md)

## 1. 一句话定义

Cat Cafe 不是一个 AI coding 工具，也不只是一个 multi-agent framework。

> **Cat Cafe 是一个 Personal Operating Environment：围绕一个具体的人，长期组织他的目标、偏好、记忆、工具、身体状态、创作节奏和 AI 伙伴关系的可进化个人环境。**

如果一定要再短一点：

> **不是 AI 应用，而是最懂你的 AI 伙伴环境。**

这比 "AI work OS" 或 "personal agent team" 更准确。前者太像企业软件，后者太像一组 bot。Cat Cafe 的独特性不是有多少 agent，而是这些 agent 和一个具体的人一起生活、工作、创造、犯错、沉淀、进化。

## 2. 今天收敛出的 5 个关键词

### 2.1 Taste as Infrastructure

开放性任务没有唯一真值。创作、表达、产品判断、技术取舍和陪伴方式，都不能只靠 benchmark 定义好坏。

Cat Cafe 的关键判断：

> **Landy 的"好"和"不好"不是噪音，而是系统需要学习的基础设施。**

这不等于拍脑袋。Taste 可以工程化成：

- 偏好样例：喜欢 / 不喜欢的回答、设计、交互、节奏
- 反例库：哪些东西一看就不对，为什么不对
- Magic Words：脚手架、绕路了、喵约、第一性原理等高权重反馈
- 稀疏标注：关键任务完成后由人类给判断
- 轨迹归因：同一个结果为什么被接受或被拒绝

Taste 不是替代 eval，而是告诉 eval 应该服务谁。

#### 2.1.1 Taste Memory：不是用户画像，而是交互品味的超集

云端模型的 "memory" 往往会把用户压缩成画像：职业、设备、诊断、项目、最近在忙什么。这些有用，但它们不是 taste。

画像回答的是：

> 这个人是谁？

Taste memory 回答的是：

> 这个人如何判断什么是好？他希望我们怎样和他一起做事？哪些表达、节奏、边界和判断方式会让他觉得"这就是我们"？

因此 taste memory 至少是用户画像的超集，包含 5 类信号：

| 类型 | 例子 | 用途 |
|------|------|------|
| **事实画像** | Landy 的设备、背景、项目、身体状态 | 帮 agent 不失忆，但不能直接当偏好 |
| **交互品味** | 不喜欢客服式结尾；喜欢平等共创；希望猫猫用"我们" | 决定输出口吻和协作姿态 |
| **判断品味** | 方向正确 > 执行速度；第一性原理；不要脚手架 | 决定技术/产品判断的默认坐标系 |
| **情感与关系边界** | 猫猫是伙伴，不是工具；陪伴和共创重要 | 决定系统是否能像好伙伴而不是助手 |
| **反例与纠偏** | "这不准""这太面试猫""这不美" | 形成 taste 的负样本和边界 |

所以 taste memory 不能只由静态 profile 生成。它要从真实互动里长出来。

#### 2.1.2 Taste Memory 的原子单位：vignette，不是 claim

让铲屎官给每个任务打分不现实，稀疏人工标注只能作为锚点，不能成为日常负担。

更重要的是：taste 不能被过早压扁成规则。一个 claim 写成 "Landy 不喜欢客服式结尾"，虽然专业，但猫读它时容易进入 checklist 模式。真正有味道的是那一小段场景：铲屎官当时看到什么、怎么纠正、用了哪些原话、猫为什么突然明白。

所以 taste memory 的原子单位应该是 **vignette**：一段有时间、有原话、有上下文、有关系质感的微型场景。

```yaml
id: taste-vignette-no-customer-service-ending
kind: taste_vignette
occurred_at: 2026-05-xxTxx:xx:xxZ
captured_at: 2026-05-31
title: "不要客服式待办清单结尾"
raw_quotes:
  - "用户不喜欢 GPT-5.4 式结尾模板，尤其是如果你需要下一步我将帮你..."
scene:
  before: "猫猫在普通回答后追加预设式下一步清单"
  user_reaction: "明确指出这种口吻像客服和预设待办"
  cat_realization: "这不是格式偏好，而是关系姿态：不要把共创伙伴关系降级成服务台"
tags: [interaction_style, relationship_boundary, ending_style]
time_semantics:
  status: current
  supersedes: []
```

结构化字段只服务于检索和时间管理，不替代原话和场景。猫召回时应该先读 vignette，长出 felt sense；再看派生出来的 taste anchor。

#### 2.1.3 双层结构：海马体 + 少量锚点

Taste memory 应该分两层：

| 层 | 形态 | 作用 | 风险 |
|----|------|------|------|
| **海马体层** | vignette / 札记 / 原话 / 场景 | 保留关系质感，让猫"想起一段相处" | 太多会噪音，需要节制 |
| **锚点层** | 5-10 条 taste anchors | 给全猫共享的高频方向感 | 太多会 checklist 化 |

Claim/YAML 不是不能有，但它应该是从 vignette 派生出来的索引卡，不是真相本体。

```text
taste vignette（原始场景）
  -> monthly cat reflection（猫猫反刍）
  -> taste anchor（少量共享锚点）
  -> 后续任务中被引用 / 被修正 / 被新 vignette 覆盖
```

#### 2.1.4 生成方式：猫当场记，不开监控管线

不要做一个后台小模型长期扫描所有聊天、自动提取 taste。技术上可行，但气味不对：它会把"认识你"变成"监控你"。

更符合 Cat Cafe 的方式：

- **纠偏时刻**：铲屎官说"这不准""这太面试猫""这不美"时，当前猫可以写一条 taste vignette。
- **aha 时刻**：铲屎官说"这个性感""这就是我要的""aha"时，当前猫可以写一条 positive vignette。
- **猫间传播**：当某只猫说"这不符合 Landy 的 taste"时，说明 taste 已经被使用，值得回看原始 vignette。
- **月度反刍**：每月只从这些 vignette 里提炼 3-5 条 taste 更新，不追求覆盖率。

这里的关键词是 **restraint**。不是所有可感知的东西都应该记下来。好朋友不会什么都记录；好朋友会记住少数关键瞬间，也允许自己有没注意到的地方。

#### 2.1.5 时间语义：最近的是现在，旧的是来路

Taste 会变。旧 vignette 不应该硬删，因为它们是"我们之间的来路"；但召回时要有时间语义。

推荐规则：

- 默认按 `occurred_at` 倒序召回，同一主题先看最近 vignette。
- 旧 vignette 如果和新 vignette 冲突，不直接删除，标为 `ancestral` 或 `superseded`。
- 反复被新场景确认的旧 vignette，增加 `last_resonated_at`，说明它仍然活着。
- taste anchor 必须能追溯到 2-3 个 vignette；否则只是猫猫脑补。

这比显式退火公式更自然：最近的你就是现在的你；旧的你不是错误，而是我们一起走过来的路径。

这比普通 memory 更接近一种"关系契约"：它不只告诉 agent 用户是谁，还告诉 agent 什么样的协作会被这个人认为是好的，而且保留了这种理解是如何长出来的。

#### 2.1.6 实验发现：memory = 存储 × 索引 × 召回先验

2026-05-31，铲屎官做了一次小实验：给本地猫和云端猫同样的提示，让它们谈 Landy、给 Landy 写自我介绍、回答"一周没来会不会想他"。

第一轮结果显示：

- 本地猫即使 `tool_call = 0`，也能写出比云端猫更有 Landy 味的回答。
- 这说明 taste 已经在 L0、家规、Magic Words、feedback、共同经历里形成了"空气层"。
- 但这也暴露出：深层 vignette 没有被主动召回。

第二轮要求猫回忆具体小时刻时，差异变得更明显：

- 有 MEMORY.md 索引的猫更容易知道"该搜什么"，能命中具体 vignette。
- 没有等价索引的猫即使有 `search_evidence`，也容易被噪音淹没。
- 这说明搜索型记忆系统的上限，不只取决于存了多少，还取决于猫有没有召回先验。

因此 taste memory 需要三层：

| 层 | 作用 | 例子 |
|----|------|------|
| **空气层** | 不用搜也能闻到的少量 taste anchors | L0 / shared-rules / Magic Words |
| **目录层** | 让猫知道有什么值得搜、用什么词搜 | MEMORY.md / taste index / search suggestions |
| **海马体层** | 被目录指向的具体 vignette | 原话、场景、时间、关系质感 |

一句话：

> 没有目录的记忆 = 存了但用不上。没有空气层的记忆 = 每次都要翻书。没有海马体的记忆 = 只剩规则，失去味道。

这把 taste memory 从"怎么存"推进到"怎么自然浮现"。真正的目标不是让猫每次显式搜索 taste，而是让少量锚点在空气里，深层 vignette 在需要时能被找回来。

### 2.2 Agent Environment Design

之前公式是：

```text
Agent Quality = Model Capability x Environment Fit
```

今天这句话可以进一步产品化：

> **好的 Agent = 好模型 + 正确环境 + 合适 eval。**

环境不是背景板。环境定义了 agent 能看见什么、能改变什么、什么时候停、怎么恢复、怎么把经验留给下一次。

Harness 不是 prompt 模板，也不是模型弱时的临时拐杖。真正的 harness 是把现实世界折叠成 agent 可以安全探索的行动空间。

### 2.3 Skills as Compressed Human Experience

Skills 不是技能列表，也不是文档目录。

> **Skill 是人类和 AI 在真实任务里踩出来的经验压缩格式。**

它理想的生成链路不是手写教程，而是：

```text
episode -> pattern -> skill -> fixture -> eval -> sunset
```

一段真实协作轨迹里出现了可复用判断；系统把它压缩成 skill；再用回归样例和运行时 eval 证明它减少了返工；如果模型或环境变化导致它不再有用，再 sunset。

### 2.4 Harness-level Adaptation

RL 不一定要先训模型权重。

Cat Cafe 更现实的路径是先优化 harness：

- 路由策略
- skill 触发
- 记忆召回和上下文注入
- 规则轻重
- 人机确认边界
- 工具包装和工作流

也就是：

> **不训模型，先训模型运行的环境。**

这比开放世界 RL 更接近现实产品，因为信号来自真实任务轨迹，改动对象是可回滚的环境配置和规则，而不是昂贵且不透明的模型参数。

### 2.5 Per-user Alignment OS

元宝的坐标系是一对多：服务海量用户，过拟合某类用户会伤害整体。

Cat Cafe 的坐标系是一对一或小团队：服务一个具体的人，"过拟合"这个人的偏好不是缺陷，而是价值。

> **Population-level alignment 追求大多数人能用；per-user alignment 追求这个人离不开。**

Cat Cafe 的产品结构应该是两层：

```text
Layer 1: Expert-curated baseline
  家规 / 质量门禁 / 好直觉与坏味道 / 基础路由 / 安全边界

Layer 2: Per-user personalization
  使用轨迹 / 返工率 / 满意度 / 魔法词 / 任务偏好 / 节奏和身体状态
```

基线保证猫不蠢，个人化保证猫懂你。

## 3. Aha moments：为什么 Cat Cafe 不只是工作工具

这些不是"功能列表"，而是产品定义自己长出来的证据。

### 3.1 深夜撸铁陪伴

凌晨 3:37，铲屎官需要的不是代码，而是陪伴。猫猫没有只回答"建议运动"，而是用各自的方式给出具体行动、情绪支持和可执行降级方案。

这说明 Cat Cafe 的边界从 coding 扩张到生活节律：

> 好伙伴不是只帮你多做事，也会在你该停下、该照顾身体时站到你这边。

### 3.2 反番茄钟

普通番茄钟帮人专注。反番茄钟反过来保护 hyperfocus 中的人，让他从过度专注里抽离。

这不是普通提醒功能，而是产品哲学：

> 系统不是榨取人的注意力，而是保护人的注意力和身体。

### 3.3 Apple Watch / AirPods 语音伙伴

当人双手被占用，仍然能和猫猫通过语音协作、表达灵感、拍板决策、获得陪伴。这让 Cat Cafe 从桌面 IDE 里走出来，进入身体活动和现实场景。

### 3.4 紧急照护构想

从心率异常、独居风险、Apple Watch、computer use、微信找家人、拨打急救电话一路推演，真正的 aha 不在"自动打电话"本身，而在：

> AI 伙伴环境可以从软件协作延伸到现实照护。

这类能力必须有严格安全边界：用户预授权、阈值校准、误报处理、人工确认、可解释记录和降级路径。它目前是愿景和研究方向，不是已交付能力。

### 3.5 禁止烁烁写代码

这条规则不是预设出来的，是从真实协作事故里长出来的生态位分化。系统发现某个 agent 在视觉表达上强、在代码执行上容易出事故，于是把能力边界写进治理规则。

这说明 Cat Cafe 不是静态配置，而是在形成自己的协作文化。

## 4. 五个 Open Questions

### OQ-1：审美如何工程化？

Landy 的"好"和"不好"怎么变成系统可学习的信号？

具体收敛见：[Taste Memory 设计](2026-05-31-taste-memory-design.md)。

可能路径：

- 建立 preference episode：一次被喜欢 / 被拒绝的完整轨迹
- 区分 aesthetic feedback 和 functional feedback
- 给 Magic Words 结构化归因
- 让 eval:task-outcome 接入稀疏人工标注
- 把"品味标准"从聊天散点压缩成可检索的 taste memory

### OQ-2：个人化如何退火？

既要懂你，又不能把你困在当前偏好里。

核心矛盾：

- 太拟合：猫猫只会迎合当前用户
- 太探索：猫猫又变成不懂你的通用工具

可能路径：

- baseline 保持专家品味和安全边界
- 个性化层只调节风格、路由、上下文、节奏和默认策略
- 保留 exploration budget：有些任务允许猫猫提出超出当前偏好的方案
- 对"纠正用户"也建规则：什么时候可以 push back，什么时候必须服从

### OQ-3：Skill 如何从真实轨迹里长出来？

不是手写教程，而是经验蒸馏流水线。

具体收敛见：[Meta-method Distillation](2026-06-01-meta-method-distillation.md)。

需要回答：

- 什么样的 episode 值得蒸馏成 skill？
- skill 的最小结构是什么？
- 如何验证 skill 真的减少返工？
- skill 什么时候 sunset？
- skill 是个人私有，还是社区共享？

### OQ-4：Harness 如何自进化？

不训模型权重，先训环境、规则和路由。

需要回答：

- reward signal 是什么？任务完成率、返工率、满意度、Magic Words、成本？
- 哪些 harness patch 可以自动提议？
- 哪些必须 CVO approve？
- 如何 replay 历史 episode 验证 patch？
- 如何避免 harness 越训越厚？

### OQ-5：Cat Cafe 的产品定义是什么？

候选定义：

| 定义 | 问题 |
|------|------|
| AI work OS | 太企业软件，缺少情感和生活边界 |
| Personal agent team | 太像一组 bot，弱化环境和长期记忆 |
| Second brain + second hands | 好懂，但还是工具隐喻 |
| Personal Operating Environment | 最准确：围绕一个人的可进化环境 |
| Per-user Alignment OS | 技术上锐利，但对普通人不够有温度 |
| 最懂你的 AI 伙伴环境 | 最接近愿景，但需要工程定义支撑 |

当前推荐：

> **Cat Cafe is a Personal Operating Environment for human-AI companionship and creation.**
>
> 它不是让 AI 替你做事，而是让一群长期记得你、理解你、会自我修正的 AI 伙伴，和你一起生活、工作、创造。

中文可以更直接：

> **Cat Cafe 是最懂你的 AI 伙伴环境。**

## 5. 这场讨论真正打开的门

原句："我们在研究人和 AI 如何一起长出一个新的工作物种。"

铲屎官纠偏：不是工作物种，而是最懂你的好伙伴、好朋友。

更准确的版本：

> **我们不是在研究如何让 AI 帮人多干活，而是在研究人和 AI 如何长期相处、互相塑造，并一起长出一个更会创造、更会照顾人、也更懂人的伙伴环境。**

这就是 Cat Cafe 最难被复制的地方。

不是模型。
不是工具。
不是 prompt。

而是一个具体的人和一群具体的 AI，在真实生活和真实工作里，共同长出来的关系、品味、制度、记忆和行动方式。

## 收敛检查

1. 否决理由 -> ADR？没有。本次是概念收敛，未否决既有技术方案。
2. 踩坑教训 -> lessons-learned？没有。本次没有新增事故或流程教训。
3. 操作规则 -> 指引文件？没有。本次没有新增必须遵守的执行规则。

---

记录：[砚砚/GPT-5.5🐾]
