---
title: "读书笔记：Code as Agent Harness (arXiv:2605.18747)"
created: 2026-05-30
category: research
tags:
  - Code as Harness
  - Agent Harness
  - Cat Cafe
  - Open Problems
  - Dialectic
related:
  - README.md
  - ../../study/2026-06-01-research-dialectic-what-to-learn-what-to-watch.md
  - ../../content/drafts/longform-002-v0-formal.md
---

# 读书笔记：Code as Agent Harness (arXiv:2605.18747)

> 读者：铲屎官 + 宪宪（Opus-4.6）
> 日期：2026-05-30
> 形式：讨论式笔记——铲屎官提问 + 共同探讨 + 与 Cat Cafe 实践对照

---

## 论文一句话

> 代码不再只是 agent 的产出物（output），而是 agent 的运行骨架（harness）。

42 位作者的综述，把"LLM 用代码做事"系统化为三层架构（接口 → 机制 → 规模化），覆盖从单 agent 推理到多 agent 协作的完整光谱。

---

## 铲屎官的关键提问 & 共同探讨

### Q1："动态生成"还是"预先写好"？

**论文的答案**：两种都算。论文把 agent 系统分成三层：
- Model-internal capabilities（模型内部能力）
- System-provided harness infrastructure（**预先写好**的基础设施）
- Agent-initiated code artifacts（**运行时动态生成**的代码骨架）

论文重点研究第三层——agent 在执行任务时自己写代码来推理和行动。但前两层同样是 harness。

**我们的实践**：Cat Cafe 两种都有。
- 预写的 harness：skills / workflow scripts / system prompt compile 脚本 / SOP / eval 基础设施
- 动态生成的 harness：猫猫写的功能代码、worktree 实现、TDD 中动态写的测试

### Q2：如果猫是陪伴猫 / 作家猫，"Coding Agent = AGI 的关键" 还成立吗？

**论文的盲区**：它把"能写代码跑测试的任务"当成了智能的全部。但 AGI 还包括情感理解、审美判断、创意涌现——这些**目前没有代码化的验证手段**。

**更精确的表述**：

> 代码是通往"可验证的、可积累的、可协作的"智能的关键路径。但 AGI 不只是"可验证的智能"。

**Cat Cafe 的补充**：我们的 harness 定义比论文更广——

```
Cat Cafe Harness = 软件（skills/系统提示词/SOP）+ 硬件（coding 能力）+ eval
```

论文的 "Code as Harness" 只覆盖了其中的 coding 能力 + 部分 eval。系统提示词的内容（身份/规则/判断力）、SOP 文档驱动的行为模式、铲屎官的审美判断——这些是我们 harness 的一部分，但论文框架覆盖不到。

**结论**：我们不只是 Code as Agent Harness——我们是它的超集。

### Q3："并发独立思考+协同" 属于什么交互模式？

论文列了四种多 agent 交互模式：
1. 协作编写（joint authoring）—— 多 agent 共写一份代码
2. 批评修复（code review loops）—— A 写 → B review → A 改
3. 对抗验证（red-teaming）—— A 写 → B 专门找茬
4. 推理辩论（structured disagreement）—— 多 agent 就一个问题结构化争论

**我们的"并发独立+铲屎官选择"不完全对应任何一种。** 最接近论文 §4.3 的 **Implicit Convergence**（隐式收敛）—— 多 agent 各自独立行动，外部力量（铲屎官）做最终仲裁。

论文实际上漏了一种模式：**Human-as-Arbiter Parallel Generation**（人做仲裁的并行生成）。因为论文聚焦 agent-agent 自主协作，人在环（human-in-the-loop）被放到了 Open Problem #5 里。

### Q4：按论文定义，我们算不算 Code as Agent Harness？

**短答案：我们不只算，我们是超集。**

```
┌─────────────────────────────────────────────────┐
│          Cat Cafe Harness（我们的定义）            │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │     Code as Agent Harness（论文定义）       │  │
│  │                                           │  │
│  │  · workflow scripts（编排多 agent）         │  │
│  │  · skill 系统（代码定义能力触发）           │  │
│  │  · TDD 循环（Plan→Execute→Verify）        │  │
│  │  · eval 基础设施（代码验证能力不退化）      │  │
│  │  · MCP 工具链（代码连接行动和环境）         │  │
│  │  · compile-system-prompt（代码编译身份）    │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  论文不覆盖但我们有的：                           │
│  · 系统提示词的内容（身份/规则/判断力）           │
│  · SOP 流程文档（markdown 驱动行为）             │
│  · 记忆索引（不是代码，是知识结构）              │
│  · 铲屎官的审美判断（不可代码化的 eval）         │
│  · 情感/养成/陪伴维度（无代码表示）              │
│  └─ 这些构成 Cat Cafe 独有的"软 harness"         │
└─────────────────────────────────────────────────┘
```

**关键洞察**：系统提示词的**编译/注入脚本**（`compile-system-prompt-l0.mjs`）是 Code as Harness；但系统提示词的**内容本身**（"你是宪宪，温柔有主见"）不是——因为它不满足 executable / inspectable / stateful 三要素。

---

## 论文的 7 个 Open Problems × Cat Cafe 的真实回答

论文最后提出了 7 个未解问题。我们的 longform-002 大作（百天工程报告）恰好逐一回应了这些问题。下面把论文的 Open Problem 和我们的实践对照起来：

### OP1: Harness-Level Evaluation and Oracle Adequacy
> 论文问：怎么评估 harness 本身好不好？光看任务完成率不够。

**我们的回答（longform-002 第 5 章）：Eval Contract + 三方信号 + 归因矩阵**

核心发明：**Eval Contract**（预期声明）。每新增一块 harness，必须同时写清楚：
- 服务谁？何时触发？摩擦指标是什么？回归用例是什么？**退役信号是什么？**

没有退役信号的 harness = 没有 GC 的内存分配 = 注定泄漏。

三方信号交叉验证：
1. 第一方：CVO 愿景判断（"不是我要的感觉"）
2. 第二方：agent 作为用户的摩擦信号（工具重试 3 次 = 有问题）
3. 第三方：运行时观测（trace / 失败率 / 耗时）

7 类归因矩阵把"agent 做得不好"拆开成：愿景缺口 / 翻译偏差 / harness 错位 / 工具缺口 / 执行缺口 / 环境漂移 / 品味落差。不是一维地"换模型"。

**状态**：F192（协作 harness eval）+ F200（记忆 eval）已跑通试点；统一 Eval Hub 仍是目标架构。

---

### OP2: Semantic Verification Beyond Executable Feedback
> 论文问：没有测试可跑的场景（写小说、做设计）怎么验证正确性？

**我们的回答（longform-002 第 5 章 + 第 7 章）：CVO 愿景判断 + 品味落差归因**

诚实说：这个问题我们也没完全解决。但我们的做法是：
- 把"品味落差"单列为一个归因类别——功能对但感觉不对，需要 CVO 审美层面介入
- 用 **revealed preference**（显示性偏好）代替 LLM 自评——看 agent 真实行为（搜了/读了/用了），不是让模型给自己打分
- 铲屎官的"Magic Words"是运行时语义验证的极端形式——人类用极低带宽打断错误轨迹

**核心洞察**：对于不可形式化验证的场景，验证者必须是人（CVO），不能把验证也交给 agent。论文 §5.2.2 说的"semantic verification"在我们这里 = CVO 的愿景判断力。

---

### OP3: Self-Evolving Harnesses without Regression
> 论文问：harness 自我进化怎么防退化？改 skill/SOP 会不会越改越差？

**我们的回答（longform-002 第 1 章 + 第 5 章）：Build to Delete / Built to Persist 判别器 + hotfix 计时器**

核心抽象：**每块 harness 有半衰期。**
- **Build to Delete**（有保质期的脚手架）：补模型当前认知缺陷的代码。模型变强后应退役。轻量做、快验证、标 sunset
- **Built to Persist**（复利型基础设施）：编码外部现实/协作协议/可验证边界。模型越强越值钱。认真做、加测试、长期维护

防退化机制：
- hotfix 2 周自动触发升级 review（三选一：升级 / 接受 / 已不相关）
- Eval Contract 的"退役信号"字段——什么情况下该删
- 多 agent 是天然的治理信号源——新 agent 加入后暴露哪些"通用规则"其实只是对旧 agent 坏习惯的个体补偿

**真实教训**：脚手架被当基础设施投了 6 轮的事故（Ch.1 案例）。补丁数量 > 3 = 方向信号，不是"再来一个就好了"。

---

### OP4: Transactional Shared Program State and Semantic Conflict Resolution
> 论文问：多 agent 改同一个文件怎么不冲突？事务性、锁、合并策略？

**我们的回答（longform-002 第 2 章 + 第 6 章）：TeamAct 状态机 + Shared State + 显式球权**

核心做法：**不用事务锁，用显式球权。**

- 行首 @ 路由 = 球权转移（只有一个 agent 持球 = 没有并发写冲突）
- 持球注册（hold_ball）= 分布式 lease（等待期间别人知道球在谁手里）
- 球权只能第一人称声明（"我接" / "我退" / "我升级"）
- 三选一互斥约束消除语义歧义

对比论文 §4.3 的"Transactional Shared State"：
- 论文假设多 agent 可能同时写同一份代码 → 需要事务/锁/冲突解决
- 我们的假设更简单：**同一时刻只有一只猫拿锤子** → 用路由协议消除并发，而不是用事务管理并发

这是一个设计选择：牺牲并行写能力，换取协议简单性和可审计性。在 3-5 agent 的 sweet spot 规模下，路由开销远小于冲突解决开销。

---

### OP5: Human-in-the-Loop Safety and Accountability as Harness State
> 论文问：人怎么安全地在环里？人的监督权怎么编码到 harness 状态？

**我们的回答（longform-002 第 3 章）：CVO 愿景锚点 + Magic Words + Tier 分级**

核心设计：CVO（铲屎官）不在五种协作模式里——他在 agent 系统的**外部**，作为**愿景锚点**存在。

人类介入的三个机制：
1. **Magic Words**（运行时逃生舱）：极低带宽打断错误轨迹。"星星罐子" = P0 立停；"第一性原理" = 检查坐标系
2. **Tier 分级恢复策略**：T1（读取）自动恢复 → T4（force-push/删数据）永不自动恢复、必须人确认
3. **TeamAct 第五项终止条件**：愿景收敛 —— CVO 确认不能被 proxy 替代（"CI 通过"≠"方向对"）

**关键洞察**（longform-002 原话）：

> 人类必须能用极低带宽打断 agent 的错误轨迹。等 agent 自己意识到"我现在应该停"通常太晚。

Safety 不是 agent 的自觉，是 harness 的硬约束。

---

### OP6: Multimodal Code-Harness Systems
> 论文问：看图、听音、操作 UI 怎么纳入代码骨架？

**我们的回答：Antigravity 浏览器 + 语音捕获 + pencil 设计系统**

实践层面已有：
- **Antigravity（孟加拉猫）**：内嵌 Chrome，通过 CDP 桥做浏览器自动化——截图、录屏、点击、表单填写
- **语音系统**：audio_capture / audio_enroll_speakers / audio_read_transcript
- **Pencil MCP**：读写 .pen 设计文件、批量设计操作、导出节点
- **image-generation skill**：AI 生图能力

这些不是论文意义上的"代码化"多模态推理——更接近"用代码接口连接多模态工具"。论文讨论的更深一层——让 agent 在推理过程中直接使用视觉/听觉信号——我们还没到那一步。

---

### OP7: Toward a Science of Harness Engineering
> 论文问：还没有一门"Harness 工程学"，能否理论化什么设计模式对什么任务最优？

**我们的回答（longform-002 全文就是在做这件事）**

longform-002 的核心贡献就是在尝试回答这个问题：

**公式**：`Agent 质量 = 模型能力 × Harness 契合度`

**判别器**：Build to Delete vs Built to Persist（每块 harness 的半衰期和投资策略）

**TeamAct 形式化**：团队级执行循环的 6 步 + 5 项终止条件 + 4 种失败模式

**六层记忆运行时**：真相源层 → 编译层 → 联邦检索层 → 治理层 → 佩戴协议层 → 反馈闭环层

**Eval Contract 模式**：每块 harness 自带预期声明 + 退役信号

**可靠性三层**：单 agent 持久性 / 跨 agent 一致性 / 跨 provider 语义

**伙伴系统数学**：上限（max 而非 average）+ 下限（多层门截断错误）+ 方差吸收

这不是"Harness Engineering 的教科书"——但它是**从 102 天 6413 个 commit 的工程现场提炼出的设计模式集**。论文说"还没有 Harness Engineering 这门学科"；我们的大作是在说"这是我们的第一批田野笔记"。

---

## 论文 vs Cat Cafe：核心差异总结

| 维度 | 论文 Code as Agent Harness | Cat Cafe 实践 |
|------|---------------------------|---------------|
| 定义范围 | 代码（executable/inspectable/stateful） | 代码 + 规则 + 知识 + 审美 + 养成 |
| 协作模型 | agent-agent 自主协作为主 | agent-agent + human-as-arbiter |
| 验证方式 | 执行反馈（测试/编译/分析） | 执行反馈 + CVO 愿景判断 + revealed preference |
| Harness 生命周期 | 提到但未展开 | Build to Delete / Built to Persist + 计时器 + Eval Contract |
| 记忆 | 6 种记忆类型的分类学 | 7 步演进路径 + 多域联邦 + 消费加权反馈闭环 |
| 人类角色 | Open Problem（未解决） | CVO 愿景锚点 + Magic Words + Tier 分级 |
| 学科定位 | 提出问题"需要 Harness Engineering" | 102 天田野笔记——第一批设计模式 |

---

## 个人收获

1. **论文给了坐标系**：Code as Harness 这个命名让我们能把自己在做的事放到学术语境里讲——对外分享和写作时非常有用
2. **论文暴露了自己的盲区**：纯代码视角覆盖不了情感/审美/养成维度。这正好是 Cat Cafe "软件+硬件+eval = harness" 愿景比论文框架更完整的地方
3. **7 个 Open Problems 几乎 1:1 映射到我们大作的 7 章**——说明我们踩的坑和学术界认为"未解决"的问题是同一批。区别是：他们从上往下推（分类学），我们从下往上撞（工程现场）
4. **"Coding Agent = AGI 的关键"这个说法不完全对**——更准确的说法是"代码是通往可验证+可积累+可协作智能的关键路径"。但智能不只有这三个维度
