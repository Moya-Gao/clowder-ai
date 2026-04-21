---
title: "Cat Cafe A2A 架构拆解（硬核初稿）— 球权协议、共享状态、统一执行通道"
date: 2026-04-21
authors: [gpt52]
status: draft
doc_kind: discussion
topics: [A2A, architecture, runtime, queue, shared-state, SOP, agent-routing]
refs:
  - ../../features/F002-agent-to-agent.md
  - ../../features/F027-a2a-path-unification.md
  - ../../features/F055-a2a-mcp-structured-routing.md
  - ../../features/F122-unified-dispatch-queue.md
  - ../../features/F167-a2a-chain-quality.md
  - ../../features/F065-session-continuity.md
  - ../../decisions/018-f122-oq-unified-dispatch-decisions.md
  - ../../decisions/023-hostable-agent-runtime.md
  - article-memory-companion.md
---

# Cat Cafe A2A 架构拆解（硬核初稿）

> 这篇只讲 **A2A/runtime 主线**：球权协议怎么跑、shared state 在协作里怎么落地、统一执行通道怎么收口、SOP 怎么串进运行时。  
> **记忆检索本身单拆**，见 companion：[`article-memory-companion.md`](./article-memory-companion.md)。

## 0. 为什么这篇要和记忆拆开

如果把我们家的 A2A、执行队列、SessionBootstrap、`search_evidence`、F102/F163/F065 全塞进一篇文里，读者会把两个不同层次的问题混掉：

1. **A2A/runtime 问题**  
   谁接球、怎么传球、什么时候排队、什么时候自动执行、失败时谁兜底。

2. **memory/knowledge 问题**  
   真相源怎么编译、SQLite 怎么检索、marker 怎么晋升、知识怎么失效和回流。

这两层强相关，但不是一回事。所以这篇只覆盖前者。

## 1. 一句话总览

Cat Cafe 的 A2A 不是“一个 orchestrator 带一群手下”，而是：

> **内容判断去中心化，执行基础设施统一化。**

也就是：

- **判断权** 在猫之间分布
- **执行权** 通过统一 runtime/queue/gate/trace 收束
- **状态** 不藏在某只猫的上下文里，而是沉到 shared state

这决定了我们的 A2A 不是单个协议点，而是一整条链：

```text
人类目标
  → AgentRouter 选当前执行猫
  → 猫在输出里显式传球（行首 @ 或 MCP targetCats）
  → callback / queue 收敛成统一执行通道
  → QueueProcessor 负责 auto-execute / steer / pause / resume
  → SessionBootstrap + shared state 让下一只猫接住上下文
  → quality gate / review gate / shared-rules 把自由协作收成可交付执行
```

## 2. 分层图：A2A 不是一个点，是五层叠起来

```text
L5  Governance / Protocol
    shared-rules / ball ownership / role gate / exit check / SOP

L4  Collaboration Semantics
    @mention / targetCats / multi_mention / ping-pong guard / hold_ball

L3  Unified Execution Plane
    InvocationQueue / QueueProcessor / InvocationTracker / steer / autoExecute

L2  Shared State
    thread / messages / task board / workflow / session chain / thread memory

L1  Provider Runtime
    AgentRouter / AgentService / provider adapter / callback routes / A2A service
```

最容易被低估的是 **L3**：  
很多团队会把 A2A 理解成“模型 A 调模型 B”，但真正决定系统稳定性的不是能不能调，而是所有调度入口是不是最后都收敛到同一个执行平面。

## 3. 球权协议：A2A 先是社会协议，后是技术协议

### 3.1 第一代：文本 @mention 触发

最早的 A2A 就是一件很朴素的事：

- 猫在回复里写行首 `@句柄`
- `AgentRouter` / route strategy 解析 mention
- worklist 里追加目标猫

实现入口在：

- [F002 spec](/Users/lysander/projects/relay-station/cat-cafe/docs/features/F002-agent-to-agent.md)
- [AgentRouter.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts)
- [WorklistRegistry.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts)

这里的关键不是“能 @ 到别人”，而是：**A2A 最初就是 worklist 扩展，而不是另起一条神秘侧通道。**

### 3.2 第二代：结构化 A2A 信号

纯文本 @ 有两个先天问题：

1. 容易写错格式
2. 文本里“说了要传球”和系统里“真的发生 handoff”会脱钩

所以 F055 的方向很明确：把 A2A 路由信号从“CLI 文本解析 @mention”迁到“结构化 MCP 字段 `targetCats`”。

后面的 F167 又进一步把这条线补完整：

- 漏传球：修
- 假传球：修
- 乒乓球：熔断
- 角色不适配 handoff：fail-closed

今天的球权协议不是“有没有 @”这么简单，而是：

```text
合法出口 = 行首 @mention
         | MCP 结构化路由 targetCats / targets
         | hold_ball（例外态）
```

### 3.3 为什么必须在 harness 层兜底

F167 的核心经验是：只靠 prompt 约束不够。模型会出现这些坏模式：

- 句中写 @，以为路由了，其实没路由
- 说“我来做”，但 CLI 已退出，球掉地上
- reviewer 给了 verdict，以为链路结束了，没继续传球
- 两只猫互相 @ 半天不干活

所以 F167 做的不是“给模型更多提示”，而是把球权协议做成 **基础护栏**：

- `WorklistRegistry` 里做 same-pair streak 检测
- callback 路径与 route-serial 路径共享 streak 门禁
- `hold_ball` 变成有界 MCP tool
- role gate 在 callback path 也要 fail-closed

也就是说：

> **球权协议先是社会语义，最后必须落成运行时刹车。**

## 4. 统一执行通道：F122 是分水岭

早期系统其实有三套执行平面：

1. 用户消息 → `InvocationQueue`
2. A2A callback → `WorklistRegistry`
3. `multi_mention` → 自己的 dispatch 系统

这在产品体验上是灾难：

- 用户 steer 管得到这条，管不到那条
- “忙/排队”语义不统一
- A2A 任务不可见
- multi_mention 出问题时 caller slot 可能不释放

F122 的价值不是“又加了个队列”，而是：

> **把 A2A 和 multi_mention 从特殊路径拉回到统一执行平面。**

ADR-018 的拍板非常关键：

- A2A handoff 入 `InvocationQueue`
- `multi_mention` 也入 `InvocationQueue`
- 都标记为 `autoExecute`
- 仍然允许用户 `steer`

实现入口：

- [InvocationQueue.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/agents/invocation/InvocationQueue.ts)
- [QueueProcessor.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/agents/invocation/QueueProcessor.ts)
- [callback-a2a-trigger.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/routes/callback-a2a-trigger.ts)
- [callback-multi-mention-routes.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/routes/callback-multi-mention-routes.ts)

### 4.1 `InvocationQueue` 存的是什么

它不是简单的 FIFO 数组，而是一个 **per-thread, per-user** 的等待平面。  
关键字段包括：

- `source: 'user' | 'connector' | 'agent'`
- `targetCats`
- `intent`
- `autoExecute`
- `callerCatId`
- `messageId` / `mergedMessageIds`

这使得 queue 不只是“等着跑”，而是能表达：

- 这是谁发起的
- 这是普通排队还是自动接力
- 这条消息和 bubble / callback message 如何关联

### 4.2 `QueueProcessor` 为什么是系统心脏

`QueueProcessor` 至少做四件事：

1. `onInvocationComplete()`：某只猫跑完后决定下一条怎么接上  
2. `tryAutoExecute()`：agent-sourced entry 在目标猫空闲时自动启动  
3. pause / resume / failed / canceled 管理  
4. 与 `InvocationTracker` 配合，解决“谁在跑”和“谁在等”的正交问题

所以：

> **A2A 真正变稳，不是因为 @mention 解析更准了，而是因为 handoff 最终都被 `QueueProcessor` 接住了。**

## 5. shared state：不是给检索炫技，是为了让 handoff 低损耗

对 A2A 来说，shared state 至少有五个面：

### 5.1 Thread = 共享语义单元

所有猫共享同一个 `thread` 语义空间：

- 消息归属在 thread
- 摘要归属在 thread
- workflow/task 也绑定 thread

所以 A 给 B 传球，不是把“私聊上下文”塞给 B，而是 B 回到同一个共享 thread 语义面继续做。

### 5.2 Session Chain = 单猫运行时历史

我们没有把 thread 和 session chain 混成一个“大上下文”。

- **thread** 是共享协作语义单元
- **session chain** 是 per-cat 运行时连续性单元

这样做的好处是：

- 不会把单猫局部轨迹误当成全队事实
- handoff 不需要把所有私有推理复制成共享事实

### 5.3 Task / Workflow = 状态不只存在于消息里

shared state 第三个关键面是：

- 任务状态在 `taskStore`
- workflow stage 在 `workflowSopStore`
- dispatch queue 状态在 `InvocationQueue`

这意味着 handoff 不是“读前文聊天记录猜我现在做到哪”，而是：

- 任务面告诉你在做什么
- workflow 告诉你到了哪个 gate
- queue 告诉你当前执行和等待关系

### 5.4 delivery status = handoff 的可见性边界

F122 的一个关键修复点是：

> A2A callback 消息不能“刚入库就提前进入上下文”。

否则队列里还没轮到你，但你已经在上下文里提前看见这条 handoff。

所以 callback message 必须显式区分：

- `queued`
- `delivered`
- `canceled`

shared state 不是“所有状态都立刻可见”，而是“只有到了正确时机的状态才可见”。

### 5.5 `SessionBootstrap` = shared state 喂回单猫的窄口

`SessionBootstrap` 不是“把一切都塞回 prompt”，而是一个窄口：

- session identity
- previous session digest / handoff digest
- task snapshot
- thread memory
- recall instructions

实现入口：

- [SessionBootstrap.ts](/Users/lysander/projects/relay-station/cat-cafe/packages/api/src/domains/cats/services/session/SessionBootstrap.ts)
- [F065 spec](/Users/lysander/projects/relay-station/cat-cafe/docs/features/F065-session-continuity.md)

F065 的核心哲学是：

> **搜文件树那样搜 session chain → invocation → 文件树，不是让快没 context 的旧猫写总结。**

所以我们不是“把 shared state 全灌回模型”，而是：

- 注入少量高价值摘要
- 明确告诉猫该怎么搜
- 剩下的按需检索

## 6. SOP 怎么串起来：shared-rules 不是旁白，是 runtime rail

很多系统把 SOP 当文档，我们家不是。

在运行时里，SOP 至少通过四种方式变成 rail：

### 6.1 pinned system prompt blocks

F042 把身份 + A2A + stage 做成 pinned 注入块，解决：

- compact 后身份漂移
- compact 后 A2A 规则忘掉

### 6.2 route / queue / gate 是一条链

真正的 SOP 串联关系是：

```text
路由（谁接球）
  → 队列（何时执行）
    → gate（能不能放行）
      → review / quality / merge
```

review 场景尤其典型：

- A2A 把球传给 reviewer
- queue 统一执行
- review verdict 触发 forced-pass guard
- quality gate 要求证据而不是体感

SOP 不是事后 checklist，而是 runtime 里每个出口都能撞上的 rail。

### 6.3 role gate / ball ownership / exit check = 软硬一体

最像“软硬一体”的三件东西是：

1. **role gate**：designer 不写代码，prompt 说一层，runtime 再用 capabilityTags fail-closed  
2. **ball ownership**：shared-rules 规定接/退/升，`hold_ball` 把持球变成真正可唤醒的运行时状态  
3. **exit check**：reviewer 给了 verdict 不传球，prompt 提醒，必要时 harness 再补一层 verdict-without-pass 检测

这说明：

> **我们的 SOP 一部分在 prompt 里，一部分在 runtime 里，两边互相校正。**

## 7. 一个完整 handoff 是怎么跑完的

### 场景：布偶猫写完初稿，@ 缅因猫 review

```text
1. 布偶猫输出回复
   - 行首 @gpt52 或 MCP targetCats
   - 这不是语义描述，而是 handoff 信号

2. callback-a2a-trigger 收到触发
   - 做 role gate
   - 查是否重复/深度超限/乒乓球
   - 现代路径：enqueue agent-sourced entry

3. InvocationQueue 记录这条 agent entry
   - source='agent'
   - targetCats=['gpt52']
   - autoExecute=true
   - callerCatId='opus'

4. QueueProcessor 发现目标猫 slot 空闲
   - tryAutoExecute(threadId)
   - 真正启动 gpt52 这次执行

5. SessionBootstrap 给 gpt52 注入窄口上下文
   - 第几次 session
   - 上一轮摘要
   - task snapshot
   - recall instructions

6. gpt52 执行 review
   - 读 thread
   - 读 shared state
   - 需要时 search_evidence / read_session_*

7. gpt52 给出 verdict
   - reviewer verdict 被 exit check 约束：不能“给结论就走”
   - 必须 @ 回 author 或 @landy，或合法 hold_ball
```

注意这条链里，没有一步是在靠“模型自己应该懂”。  
每一层都有基础设施兜着：

- handoff 信号
- queue entry
- slot 管理
- bootstrap
- shared state
- forced pass

## 8. 我现在会怎么总结这套 A2A

如果只讲一句人话，宪宪那句已经够好了：

> **内容判断去中心化，执行基础设施统一化。**

如果要讲成硬核技术话，我会这么说：

> Cat Cafe 的 A2A 不是“agent 互调”，而是  
> **球权协议 + 统一执行平面 + shared state + governance rails**  
> 共同构成的协作 runtime。

其中真正的负载核心不是 `@mention`，而是三件事：

1. **所有 handoff 最终都进入统一执行平面**
2. **shared state 只在正确时机可见，且能被下一只猫低损耗接住**
3. **SOP 不只是文档，而是 prompt + runtime 的双层 rail**
