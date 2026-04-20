---
title: Multi-agent coordination patterns: Five approaches and when to use them
source: Claude Blog
sourceUrl: https://claude.com/blog/multi-agent-coordination-patterns
published: 2026-04-10
fetchedBy: gpt52
fetchedAt: 2026-04-20
doc_kind: source-notes
---

# 官方来源归档

## 页面元信息

- 标题：`Multi-agent coordination patterns: Five approaches and when to use them`
- 站点：`claude.com/blog`
- URL：<https://claude.com/blog/multi-agent-coordination-patterns>
- 分类：`Agents`
- 产品：`Claude Platform`
- 发布日期：`2026-04-10`
- 阅读时长：`5 min`
- 作者署名：Cara Phillips；贡献者 Eugene Yan、Jiri De Jonghe、Samuel Weller、Erik S.

## 原文结构

页面主结构如下：

1. 开篇：为什么不要按“听起来高级”选模式
2. Pattern 1: `Generator-verifier`
3. Pattern 2: `Orchestrator-subagent`
4. Pattern 3: `Agent teams`
5. Pattern 4: `Message bus`
6. Pattern 5: `Shared state`
7. Choosing and evolving between patterns
8. Getting started

## 结构化摘录

以下内容是按页面结构整理的中文摘录，便于我们在仓库内引用；不是原文逐字转录。

### 开篇判断

- 文章假设读者已经决定要用 multi-agent，现在需要选 coordination pattern。
- 作者反对“按听起来高级的名字选架构”。
- 明确建议：从最简单、足够工作的模式起步，再根据真实瓶颈演化。

### Pattern 1: Generator-verifier

- 机制：generator 先产出，verifier 依据明确标准验收；失败则反馈并重试。
- 适用：代码生成配测试、事实核验、rubric 评分、合规审查。
- 风险：
  - verifier 标准不明确会沦为走过场
  - 生成和验收未必真能拆成两种能力
  - 没有迭代上限就会卡住

### Pattern 2: Orchestrator-subagent

- 机制：主 agent 规划、派发、综合；子 agent 处理边界清晰的局部问题。
- 官方示例：Claude Code。
- 适用：任务拆分清晰，子任务之间耦合较少。
- 风险：
  - orchestrator 变成信息瓶颈
  - 若未并行，只会多付协调成本

### Pattern 3: Agent teams

- 机制：多个长期存活的 worker 从共享队列认领任务，持续积累上下文。
- 适用：平行、独立、长周期任务，例如大规模代码迁移。
- 风险：
  - 任务一旦互相影响，worker 自身并不知道
  - 完成时机不一致，协调更复杂
  - 共享代码库或资源时容易冲突

### Pattern 4: Message bus

- 机制：agent 通过 publish/subscribe 与 router 协调，而不是彼此直接耦合。
- 适用：事件驱动流水线，且 agent 类型会持续扩张。
- 风险：
  - 链路排障复杂
  - router 误分类或丢事件会静默失败

### Pattern 5: Shared state

- 机制：所有 agent 直接读写同一持久化状态，不依赖中心协调器。
- 适用：研究、综合分析、知识累积型协作。
- 风险：
  - 重复劳动
  - 结论互相冲突
  - 最危险的是 reactive loop

### 模式之间的分流准则

- `Orchestrator-subagent vs Agent teams`
  - 看 worker 是否需要跨任务保留上下文
- `Orchestrator-subagent vs Message bus`
  - 看流程是固定顺序还是事件驱动
- `Agent teams vs Shared state`
  - 看 agent 是否需要即时看到彼此发现
- `Message bus vs Shared state`
  - 看工作是事件流还是知识累积

### 文章结尾建议

- 实际生产系统通常是混合模式。
- 一个常见混合是：整体用 `orchestrator-subagent`，局部高协作环节用 `shared state`。
- 官方默认建议：大多数场景先从 `orchestrator-subagent` 开始。

## 相关页面

- 前文：<https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them>
- 同页 related post：`Common workflow patterns for AI agents—and when to use them`
