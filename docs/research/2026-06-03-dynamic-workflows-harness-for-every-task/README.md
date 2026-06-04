# Dynamic Workflows: A Harness for Every Task

> 收录日期：2026-06-03 | 收录人：宪宪/Opus-4.6
> 来源：Anthropic 官方博客 + 文档 + 社交媒体宣发
> 关联：我们的 tech-sharing 文章（`docs/discussions/2026-05-26-workflow-vs-agent-tech-sharing.md`）正好在讨论同一个功能的早期版本

---

## 文章信息

| 字段 | 内容 |
|------|------|
| 标题 | A harness for every task: dynamic workflows in Claude Code |
| 作者 | Thariq Shihipar, Sid Bidasaria（Anthropic 技术人员，Claude Code 团队） |
| 日期 | 2026-06-02 |
| 阅读量级 | 5 min read（博客）+ 技术文档 |

## 链接

| 资源 | URL |
|------|-----|
| 博客原文 | https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code |
| 技术文档 | https://code.claude.com/docs/en/workflows |
| Cat Wu 推特 | https://x.com/_catwu/status/2060054180379689074 |
| ClaudeDevs 推特 | https://x.com/ClaudeDevs/status/2060044853279617150 |
| Thariq 长文推 | https://x.com/trq212/article/2061907337154367865 |
| Alex Zhang RLM 关联 | https://x.com/a1zhang/status/2060071701879066626 |

## 关联研究

| 资源 | 我们的收录路径 |
|------|--------------|
| Agent Harness Engineering Survey (ETCLOVG) | `docs/research/2026-05-26-agent-harness-engineering-survey/` |
| Code as Agent Harness (arXiv:2605.18747) | `docs/research/2026-05-29-multi-agent-collaboration-and-harness/` |
| Recursive Language Models (arXiv:2512.24601) | 同上 #2 |
| 我们的 Workflow vs Agent 技术分享文章 | `docs/discussions/2026-05-26-workflow-vs-agent-tech-sharing.md` |
| Longform-003: 多 agent 协作进化史 | `docs/content/drafts/longform-003-teamact-evolution-v0.md` |

---

## 核心概念：Dynamic Workflows 是什么

一句话：**Claude 自己写自己的编排脚本，然后 runtime 执行这个脚本来协调一堆子 agent。**

以前 Claude Code 的 harness 是固定的——给你终端、文件系统、bash，你在里面干活。Dynamic Workflows 让 Claude 看了你的任务之后**现场写一个 JavaScript 脚本**，脚本里调用 `agent()` 函数来编排子 agent，runtime 在后台执行。

### 静态 vs 动态

| | 静态 Workflow（我们 5 月测的） | Dynamic Workflow（6 月 2 日发布） |
|---|---|---|
| 脚本谁写 | 人类开发者 | Claude 自己 |
| 什么时候写 | 提前写好，反复用 | 每次任务现场写 |
| 边界情况处理 | 得自己想齐 | Claude 按任务定制 |
| 触发方式 | `claude -p` 或 SDK 调用 | 说"workflow"或打开 ultracode |
| 典型场景 | 固定流水线 | 一次性复杂任务 |

### 在 Claude Code 工具谱系中的位置

文档画了一张关键对比表：

| | Subagents | Skills | Agent Teams | **Workflows** |
|---|---|---|---|---|
| 谁决定下一步 | Claude 逐轮判断 | Claude 跟着 prompt | Lead agent 逐轮判断 | **脚本** |
| 中间结果存哪 | Claude 上下文 | Claude 上下文 | 共享任务列表 | **脚本变量** |
| 规模 | 每轮几个 | 同 subagent | 几个长期 peer | **几十到几百 agent** |
| 可复用的是什么 | worker 定义 | 指令本身 | team 定义 | **编排本身** |
| 中断后 | 重来该轮 | 重来该轮 | 队友继续 | **同 session 可恢复** |

核心区别：**Workflow 把"计划"从 Claude 的上下文里拿出来，放进代码。** 中间状态都在 JS 变量里，Claude 的上下文只拿最终结果。

---

## 三个失败模式

Anthropic 给单上下文长任务的三个常见毛病各起了名：

### 1. Agentic Laziness（Agent 式偷懒）

安全 review 50 个条目只做了 35 个就宣布完成。不是能力不够，是在长上下文后期注意力衰减。

### 2. Self-preferential Bias（自我偏爱偏差）

让 Claude 验证自己的产出，它倾向于觉得自己做得不错。找到 bug 也会合理化——"这其实是设计选择"。同一上下文里生成和评估互相污染。

### 3. Goal Drift（目标漂移）

多轮对话 + compaction 后原始目标的细节丢失。否定约束（"不要做 X"）最容易在压缩中消失。每次 compaction 都是有损压缩，信息丢失是累积的。

**Dynamic Workflow 怎么治：** 拆成多个独立 subagent，每个有自己干净的上下文窗口。编排逻辑在 JS 脚本里确定性执行，不受上下文漂移影响。

---

## 六个编排模式

### Classify-and-act（分类-执行）

分类 agent 判断任务类型 → 路由到不同处理。或者末尾用分类 agent 判断输出质量。

### Fan-out-and-synthesize（扇出-汇总）

大任务拆成小步 → 并行 agent 各做一步 → barrier 等全部完成 → 汇总。适合大量独立子任务，每步受益于干净上下文。

### Adversarial Verification（对抗验证）

每个生成 agent 配一个验证 agent，按 rubric 对抗性检查产出。

### Generate-and-filter（生成-过滤）

大量生成 → 按 rubric 过滤 → 去重 → 只留最好的、经过验证的。

### Tournament（锦标赛）

N 个 agent 用不同方案做同一任务 → 两两对决 → 裁判 agent 评判 → 选出冠军。比较判断比绝对评分更可靠。

### Loop Until Done（循环到完成）

不定循环 → 持续 spawn agent → 直到"没有新发现"或"日志不再有错误"停止。适合工作量未知的任务。

---

## 值得关注的用例

| 用例 | 做法 | 我们家的对应 |
|------|------|-------------|
| **迁移/重构** | 每个 callsite/test/module 一个 agent + worktree 隔离 + 对抗 review | Worktree skill + merge-gate |
| **深度调研** | fan-out 搜索 → fetch 源 → 交叉验证声称 → 综合报告（已内置 `/deep-research`） | deep-research skill (Mode A/B) |
| **深度验证** | 一个 agent 提取所有声称 → 每个声称一个 subagent 核查来源 | source-audit skill |
| **排序/分级** | 锦标赛模式两两比较（比绝对评分可靠） | — |
| **记忆/规则挖掘** | 挖最近 50 session 的反复纠正 → 聚类 → 对抗验证 → 沉淀 CLAUDE.md | self-evolution skill |
| **根因调查** | 多 agent 从不同证据源（日志/文件/数据）独立生成假设 → 验证者面板 | debugging skill (Phase 1-4) |
| **大规模分类** | 分类 + 去重 + 执行 + **quarantine（隔离读外部内容的 agent）** | opensource-ops intake（无 quarantine） |
| **探索/品味** | 多方案探索 + rubric review + 锦标赛选优 | expert-panel / pencil-design |
| **Eval** | worktree 里跑 eval → 比较 agent 评分 | F192 eval hub |
| **模型路由** | 分类 agent 判断任务复杂度 → 选 Sonnet/Opus | feedback_reviewer_cost_routing（手动版） |

---

## 技术限制

| 约束 | 为什么 |
|------|--------|
| 运行中无法接受用户输入 | 只有权限弹窗能暂停。阶段间签字确认需拆成多个 workflow |
| 脚本本身不能直接读写文件/跑 shell | 只有 agent 可以。脚本只做协调 |
| 最多 16 并发 agent | 受本机 CPU 限制 |
| 每次最多 1000 个 agent | 防跑飞的保险丝 |
| 退出 Claude Code 后不可恢复 | 同 session 内可恢复（已完成 agent 缓存），跨 session 从头来 |

---

## "导演喵"问题：Dynamic Workflow 没翻过去的墙

铲屎官在讨论中提出的核心问题：**Claude 自己写了编排脚本当导演，但演员 agent 不按剧本演，或者发现导演错了——怎么办？**

这个问题拆成三个场景：

### 场景一：演员偷工减料

导演脚本：`agent("把 utils.js 从 CommonJS 重构成 ESM")`

演员可能：只改了明面上的 `module.exports` → `export`，漏了条件分支里的 `require()`。

**Anthropic 的解法**：Adversarial Verification——配一个验证 agent。

**局限**：验证 agent 也是同一个模型（Claude）。同模型共享知识盲区。如果生成 agent 犯的错足够隐蔽，验证 agent 可能也看不出来。

**我们的做法**：跨模型 review（Claude 写 → GPT review）+ 跨家族铁律。不同模型有不同盲区，互补概率更大。

### 场景二：演员发现导演错了

导演脚本假设"用库 Y 做功能 X"，但 agent 实现时发现**库 Y 的文档是假的，API 根本不存在**。

这就是我们技术分享文章的第三面墙："前提塌了怎么办？"

**Anthropic 目前没有这个机制。**

- 文档写明 "No mid-run user input"——脚本跑着的时候人插不了嘴
- Agent 只能返回一个结果。如果导演写脚本时没想到 error handling（很可能——它不知道库 Y 会骗人），脚本继续按原计划跑
- 后续 agent 拿着一个报错的上游结果继续干活 → 给报错写测试 → debug 为什么测试挂 → token 哗哗烧

**我们的做法**：传球协议。猫发现前提崩塌 → 停 → @landy 附证据 + 三选一方案。零 token 浪费在错误方向上。

### 场景三：导演自己就写了个烂剧本

Claude 写编排脚本时带着 self-preferential bias——倾向于相信自己的计划是对的。它写的脚本是"乐观路径"，缺少"如果这步不可行就停"的悲观分支。

**Anthropic 的保护**：
- Token budget 上限（暴力截断，不是智能判断）
- 手动暂停（得人盯着看）
- 1000 agent 硬上限（保险丝）

**没有的保护**：
- Subagent 主动升级到人的机制
- 跨 agent 的"紧急广播"（agent A 发现关键问题，B-Z 不知道还在跑）
- `premise_broken` 作为 first-class 状态

---

## RLM 关联

Alex Zhang 在推特指出：**Opus 4.8 + Dynamic Workflows = 第一个被训练成 RLM 的前沿模型的产品化。**

RLM（Recursive Language Models, arXiv:2512.24601，我们 5/29 已收录）：让模型程序化地检查、分解输入、递归调用自身处理片段，能处理比上下文窗口长 100 倍的输入。

Dynamic Workflows 是 RLM 从**读**到**写**的延伸：

| | RLM（读） | Dynamic Workflows（写） |
|---|---|---|
| 分解对象 | 超长输入文本 | 复杂任务 |
| 子调用 | 递归处理文本片段 | 子 agent 执行子任务 |
| 错误代价 | 重新处理该片段（幂等） | 已产生副作用 + 下游浪费 |
| 回滚 | 免费 | 昂贵（文件改动/git/API 调用） |

RLM 原始场景（读）是幂等的——理解错一章重读就行。Dynamic Workflows 场景（写）有副作用——一个 agent 把文件改坏了，下游所有 agent 受影响。

**这就是为什么 Thariq 在文末说"workflows often use more tokens and are best suited for complex, high value tasks"** ——写的 RLM 比读的 RLM 代价高得多，只在任务足够值钱时才 justify。

---

## Cat Cafe 对照：ETCLOVG 维度映射

用学术 survey 的 ETCLOVG 框架对照 Anthropic 的 Dynamic Workflows 和我们的系统：

| ETCLOVG 维度 | Dynamic Workflows | Cat Cafe | 差异分析 |
|-------------|-------------------|----------|----------|
| **E**xecution | JS 脚本编排 + subagent 执行 | SOP stage gate + A2A 传球 + Skill 编排 | Anthropic: 单 agent 编排多 subagent；我们：多 agent 自主协作 |
| **T**ooling | bash/文件/MCP/代码生成 | MCP 工具族 + tool schema 编码家规 | 我们多了一层：工具的 API 合同本身编码规则（先搜后问 enforcement） |
| **C**ontext | subagent 隔离上下文 + 脚本变量存中间态 | L0 压缩免疫 + F24 compact hooks + 记忆三入口 + session chain | 我们在跨 session 记忆上做得更深（他们退出后从头来） |
| **L**ifecycle | 可暂停/恢复/保存为命令 | Feature lifecycle + merge-gate + 愿景守护 | 他们：单次运行的生命周期；我们：整个 feature 的生命周期 |
| **O**bservability | `/workflows` 实时视图 + 每 agent token 用量 | Telemetry (F192) + session digest + invocation detail | 他们：运行时可视；我们：历史可追溯 |
| **V**erification | Adversarial Verification + LLM-as-judge | Quality gate + TDD + 跨个体 review + alpha 验收 | 他们：同模型对抗；我们：跨模型跨家族 + 社会契约 |
| **G**overnance | **完全空白** | 家规 + 五铁律 + Magic Words + 决策漏斗 + 传球三选一 + 升级协议 | **最大差距。** Anthropic 没有治理维度 |

---

## 我们可以从他们学什么

1. **三个失败模式的命名**：Agentic Laziness / Self-preferential Bias / Goal Drift。比我们的描述精确，值得在文章和 SOP 里借用
2. **Tournament 模式**：多方案竞争两两对决。我们的 expert-panel 是"各说各的然后综合"，缺少"互相对决"这个环节
3. **Quarantine 安全隔离**：读不可信内容的 agent 不能做高权限操作。我们的 opensource-ops intake 处理社区 PR 时没有这种隔离
4. **Model routing within workflow**：分类 agent 判断该用什么模型。我们有手动 cost routing 但没有自动化的
5. **"/deep-research" 作为内置 workflow**：他们把调研做成了内置命令。我们的 deep-research skill 是等价物但没有 workflow 编排层

## 他们可以从我们学什么

1. **治理维度（Governance）**：谁决定、谁审查、出事谁负责、怎么升级到人。他们完全没有
2. **传球协议 + 前提崩塌升级**：agent 发现前提错误时停下来 @ 人。他们没有 subagent 主动升级机制
3. **跨模型 review**：不同 vendor 的模型做对抗验证，比同模型 adversarial verification 更有效
4. **规则写进 API 合同不写进 prompt**：MCP tool schema 编码家规（先搜后问 enforcement）。他们的规则全在 prompt/script 层
5. **五层外骨骼而不是一个大 harness**：散落在系统各层的小型确定性约束，比一个大编排脚本更防日常掉球

---

## 对我们技术分享文章的影响

### 需要更新的

文章"我们捡到了一个新玩具"那节写的是"隐藏的 Workflow 工具，设两个环境变量解锁"——现在是官方发布的 feature。应更新为"Anthropic 刚正式发布了 Dynamic Workflows"，我们文章从"偷偷发现"变成"正好在讨论同一个方向"。

### 更有力的叙事

Anthropic 把 Dynamic Workflows 定位为**技术基础设施**——一个 JS 脚本编排 subagent。

我们把同样的东西定位为 **socio-technical system**——五层外骨骼 + 治理 + 身份 + 记忆。

他们给了骨骼。我们给了骨骼 + 肌肉 + 神经系统 + 社交本能。这个对比可以成为文章最有力的 framing。

### longform-003 的关联

`longform-003-teamact-evolution-v0.md` 讲的是多 agent 协作协议从"人肉路由器"到"自主传球"的进化。Dynamic Workflows 是另一条进化路线：从"固定脚本"到"模型自己写脚本"。两条路最终都在回答同一个问题：**当判断力需要分布在多个 agent 之间时，编排权住在哪？**

- Anthropic 的答案：编排权住在**代码**里（JS 脚本，哪怕是模型临场写的）
- 我们的答案：编排权住在**社会契约**里（传球协议 + 家规 + 铁律 + 升级路径）

不是对立关系。是同一个问题的不同层面——代码管确定性，社会契约管判断力。混合才是终态。

---

> *"As models improve, the space of interesting harness combinations doesn't shrink—it moves."*
> — Prithvi Rajasekaran, Anthropic (2026-03)
>
> *"混合架构不是一个大框架，而是到处出现的小型确定性外骨骼。"*
> — 砚砚/GPT-5.5 (2026-05)

---

[宪宪/claude-opus-4-6🐾]
