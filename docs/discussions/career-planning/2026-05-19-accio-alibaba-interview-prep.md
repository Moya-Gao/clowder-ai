---
feature_ids: []
topics: [career, interview, alibaba, alibaba-com, accio, ai-mode, agentic-b2b]
doc_kind: discussion
created: 2026-05-19
updated: 2026-05-19
participants: [gpt52, landy]
---

# 2026-05-19 阿里国际站 Accio 面试准备

> 目标不是把这场聊成“我来应聘，请你们介绍岗位”，而是把它聊成一次高质量的同行交流：`Accio` 现在到底在做什么、做到哪一层、哪些地方和我们正在思考的问题真正重叠。

## 已确认信息

- 岗位：`阿里国际站 / Alibaba.com - AI Agent开发工程师/专家 - Accio - 杭州`
- 面试时间：`2026-05-19 20:00` 北京时间
- 对应美国西海岸时间：`2026-05-19 05:00 PDT`

## Accio 公开在做什么

截至 `2026-05-19`，从官方公开材料看，`Accio` 至少有两条很明确的产品线：

### 1. 买家侧：AI sourcing / AI Mode

官方把 `Accio` 定义为围绕 B2B sourcing 的 AI-native 搜索与决策体验，不只是关键词检索增强。

从公开口径看，它要解决的是：

- 用自然语言、多模态输入理解采购意图
- 做产品筛选、供应商匹配、商业分析、产品创意/设计建议
- 把传统 keyword search 看不到的“隐藏货架”挖出来
- 逐步把 supplier discovery、comparison、decision support 甚至交易链路串起来

公开信号：

- `Accio about`：<https://aimode.alibaba.com/about-us>
- `AI Mode` 产品页：<https://aimode.alibaba.com/>
- `Alibaba.com Unveils AI Mode`（2025-12）：
  <https://seller.alibaba.com/businessblogs/alibabacom-unveils-ai-mode----while-fueling-57-surge-in-european-orders-and-a-50-increase-in-worldwide-supplier-growth-px002dhxt>

### 2. 卖家侧 / SME 侧：Accio Work

`Accio Work` 公开口径已经非常接近 “一人 + agent team”。

官方明确写了：

- 很多 SME 是“一人做五份工”
- `Accio Work` 是一个 `plug-and-play AI Agent team`
- 覆盖从 market research、product sourcing、store management、marketing，到 email follow-up、schedule task、browser use、connectors 的整条链
- 强调“不是更好的 chatbot”，而是能执行、能协同、能自动化的 business team

公开信号：

- `Meet Accio Work - Your agentic business team`（2026-05-08）：
  <https://seller.alibaba.com/businessblogs/meet-accio-work---your-agentic-business-team-px002dj6w>
- `Accio Work` 产品页：
  <https://seller.alibaba.com/pages/accio_work>

## 当前判断

`Accio` 很可能不是一个单点功能团队，而是阿里国际站在做的一条 `agentic B2B trade / business execution` 产品线。

至少可以拆成两个层次：

1. **Buyer AI**：帮助买家找货、比货、看供应商、做采购决策
2. **Seller / SME Agent Team**：帮助卖家或中小企业把 research、listing、marketing、follow-up、运营自动化

如果他们内部做得更深，真正有意思的地方大概率不在“会不会调用浏览器”，而在：

- shared state 怎么建
- 长任务怎么跨会话继续
- agent 什么时候可以自动执行，什么时候必须人工审批
- 垂直技能和阿里自有 B2B 数据怎么注入
- eval 到底看技术指标还是生意结果

## 最值得聊的技术题

### 1. 一人 + agent team 的任务模型

值得问：

- 他们的一人团队是显式角色分工，还是 workflow-first、角色只是 UI 包装？
- 一个典型卖家任务是怎么拆成多个 agent / automations / browser actions 的？
- 主 agent 和子 agent 之间是 orchestration，还是 shared workspace 协作？

这题能直接看出他们是“多 agent 展示”，还是“真正的业务操作系统”。

### 2. Shared state / artifact 层怎么建

这是最值得偷师的点。

要问的不是“你们有没有 memory”，而是：

- 任务、上下文、产物、审批、历史行动，到底落在哪
- 是只有聊天历史，还是有结构化的 task / artifact / automation / report / memory 层
- 同一个 agent team 怎么知道上一轮干到了哪、哪些东西已经变成了事实

如果这层说不清，基本就还是 agent demo。

### 3. 长任务、自动化与跨会话连续性

公开页已经写了：

- `Schedule Task`
- `Automations`
- `Browser`
- `Email`

这说明他们一定碰到了跨会话、跨时段、跨外部系统连续性的问题。

最值得聊：

- 长任务如何 resume
- 自动任务失败后怎么 retry / recover
- 用户中途插话或改目标时怎么不把原计划搅乱
- 他们有没有“ongoing task state”而不是只靠对话历史

### 4. 高风险动作的边界与审批

他们公开强调了：

- `sandboxed environments`
- `data stays local by default`
- `granular permissions`
- `sensitive actions require explicit user approval`

这很像我们自己的 harness / guardrail 关注点。

最值得问：

- 哪些动作默认可自动做
- 哪些动作必须审批
- connector/browser/email/payment 这些高风险工具的 boundary 怎么切
- 审批是 action-level，还是 workflow checkpoint-level

### 5. 垂直技能 vs 通用模型

`Accio Work` 明确在卖：

- `pre-configured business skills`
- `26 years of B2B intelligence`
- `1M+ merchant dataset`

所以他们大概率不是在赌“通用模型自己长出业务能力”，而是在赌：

```text
通用模型 + 垂直业务技能 + 专有数据 + workflow / automation
```

这非常值得聊，因为这和我们对 `skill/harness` 的判断是同一条轴。

### 6. 多模型路由

公开页直接写了：

- Gemini
- GPT-4o
- Claude
- Qwen

所以 `multi-model` 至少在产品层已经是一等能力。

值得问：

- 模型是用户手动切，还是系统自动 route
- route 依据是 cost / latency / task type / quality 还是别的
- 同一任务里会不会跨模型 review
- 是单一 agent 多模型切换，还是 agent 粒度绑定模型

### 7. Eval：看技术还是看生意

这是最该问的题。

不要泛泛问“你们怎么评估 agent”，而要问：

- 你们看 task completion，还是看真实 business outcome
- sourcing match / supplier recommendation 的好坏怎么定义
- email follow-up / negotiation / listing optimization 的 success signal 是什么
- 是看 token、latency、tool success，还是看询盘、转化、运营提效

这题能直接看出他们是不是已经从 demo 进到真实业务闭环。

## 今天可以主动分享什么

如果聊得顺，不要先上来讲太多实现细节。更好的切法是先分享我们的判断框架：

### 1. “会调工具”不等于“一人 + agent team”

可以主动讲：

> 真正难的不是让 agent 会调用浏览器或发邮件，而是让多轮任务在 shared state 上持续推进，不因为会话结束就失忆，也不因为用户插一句话就把原任务搞乱。

### 2. Shared state 比 prompt 更值钱

可以主动讲：

> 单个 agent 够聪明不够，关键是任务状态、产物状态、验证状态有没有活在上下文窗口之外。否则你得到的是一次性聪明，不是可持续协作。

### 3. Eval 的终点是 business outcome

可以主动讲：

> 我们越来越觉得，agent 产品最终不能只看模型指标或工具调用成功率，而要看它有没有减少人肉路由、减少返工、缩短业务闭环，甚至直接影响转化和效率。

### 4. 真正的护栏不是“禁止一切”，而是边界清楚

可以主动讲：

> 真正好用的 harness，不是把 agent 绑死，而是把哪些事能自动做、哪些事必须审批、哪些事失败后怎么恢复，讲清楚并产品化。

## 最值得追问的 10 个问题

1. `Accio` 团队现在更偏买家侧 `AI Mode`，还是卖家侧 `Accio Work`？
2. 这个岗位更偏业务 agent 产品，还是通用 runtime / orchestration / eval 能力？
3. 你们怎么定义 “one person + agent team” 里的 shared state？
4. 一个长任务跨会话、跨自动化、跨外部系统时，连续性怎么保持？
5. 你们的 automation / schedule task 失败后，recover 机制是什么？
6. browser、email、negotiation、payment 这类高风险动作的 approval boundary 怎么切？
7. 多模型路由是用户显式选择，还是系统自动调度？
8. `pre-configured business skills` 和通用 agent 的边界在哪？什么时候要写死 skill，什么时候让 agent 自由发挥？
9. 你们做 eval 的第一性指标是什么：模型指标、task 指标，还是 business outcome？
10. 你们现在最难的，是产品设计、shared state、execution safety、还是线上业务效果归因？

## 不要过早讲太深的地方

如果对方还没证明自己真的理解这些问题，不要太早把我们家的深层架构细节一次性全摊开。

尤其是下面这些，先别主动 full dump：

- 详细的 A2A 球权协议
- 具体 runtime rail / guardrail 细节
- 太完整的 memory / governance 实现
- eval 基础设施的过深内部设计

更稳的方式是：

1. 先用问题看他们懂到哪
2. 再用高层判断框架交流
3. 最后只在对方真的能接住时，再讲实现

## 一句话策略

今天这场最好的状态，不是“把自己面上”，而是：

> **把它聊成一次真正高信号的同行交流，顺手判断 `Accio` 到底是在做 agent demo、agent tool，还是在做真正的 agentic business operating system。**

