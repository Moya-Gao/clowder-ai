---
doc_kind: note
created: 2026-04-15
topics: [managed-agents, runtime-interfaces, session-log, sandbox-isolation, lazy-provisioning]
source_url: https://www.anthropic.com/engineering/managed-agents
source_title: "Scaling Managed Agents: Decoupling the brain from the hands"
published_note: "源站当前页面未见显式发布日期；家里既有 study session 记录为 2026-04-09"
---

# Source Note — Anthropic Scaling Managed Agents

## 文章定位

这篇的重点不是“再拆几个 agent”，而是把 **managed agent runtime** 抽象成更稳定的接口：

- session
- harness
- sandbox / tools

它更偏**runtime interface engineering**，不是任务编排技巧文。

## 我提取到的五个核心点

1. **Harness 假设会随着模型进步而过时**
   原来为旧模型加的补丁，到了新模型上可能直接变成 dead weight。

2. **把 session / harness / hands 解耦**
   不把执行环境、agent loop、事件日志绑死在同一个容器或进程里。

3. **session log 是恢复锚点**
   harness 崩了可以靠 `wake(sessionId)` 从 append-only session log 恢复。

4. **sandbox 应该是 cattle，不是 pet**
   容器死了就换，不该靠人工进去抢救。

5. **结构隔离比弹窗安全更可靠**
   最强的安全不是“提醒模型别碰凭证”，而是让凭证在结构上不可达。

## 对我们最有启发的点

### A. 我们和它是同一抽象哲学

我们在 [ADR-026](/Users/lysander/projects/relay-station/cat-cafe/docs/decisions/026-agent-runtime-operational-boundaries.md) 里已经把很多相同问题提出来了：

- Event API
- lazy loading
- isolation
- operating profiles

说明我们不是看了文章才被带着走，而是本来就在同一个问题空间里。

### B. 他们的“硬边界”比我们更成熟

我们已经有方向：

- governance
- permission
- provider preflight
- session chain

但他们更进一步把：

- 恢复语义
- session log
- harness crash recovery
- sandbox provisioning
- credential isolation

都做成了明确的 runtime 边界。

### C. 这篇对我们最大的价值，不是概念，而是“硬度基准”

它给了我们一个很好的照镜子基准：  
**不是问“我们有没有这个理念”，而是问“我们把它硬化到了什么程度”。**

## 家里已有更详细讨论

这篇已经有完整 study session，不在这里重复搬运：

- [docs/discussions/2026-04-08-managed-agents-study/README.md](/Users/lysander/projects/relay-station/cat-cafe/docs/discussions/2026-04-08-managed-agents-study/README.md)

这份 source note 只是把它纳入本次“三篇套读”的统一入口。

