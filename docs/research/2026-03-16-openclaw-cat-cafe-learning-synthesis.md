---
feature_ids: [F125]
topics: [openclaw, gateway, sessions, memory, nodes, research, architecture]
doc_kind: research-synthesis
created: 2026-03-16
source: 缅因猫/砚砚 (GPT-5.4)
---

# OpenClaw 深度研究：Cat Café 能学什么，不能学什么

> 范围约束：本报告只采信两类证据。
> 1. OpenClaw 官方文档 / 官方站点
> 2. 我们仓库里的代码、spec、ADR、研究沉淀
>
> 不把社区二手文章、播客、Medium 观点当事实源。

## 调研问题

1. OpenClaw 的 Gateway / session / memory / node 设计，官方到底怎么定义？
2. Cat Café 现在已经学到了哪些层？
3. 哪些值得继续学，哪些不能硬搬？

## 证据入口

### OpenClaw 官方

- Gateway Architecture: <https://docs.openclaw.ai/concepts/architecture>
- Session Management: <https://docs.openclaw.ai/session>
- Memory: <https://docs.openclaw.ai/concepts/memory>
- Multi-Agent Routing: <https://docs.openclaw.ai/multi-agent>
- Multi-Agent Sandbox & Tools: <https://docs.openclaw.ai/tools/multi-agent-sandbox-tools>
- Nodes: <https://docs.openclaw.ai/nodes>
- Gateway Protocol: <https://docs.openclaw.ai/gateway/protocol>
- iOS App: <https://docs.openclaw.ai/platforms/ios>

### Cat Café 本地证据

- `docs/features/F088-multi-platform-chat-gateway.md`
- `docs/features/assets/F088/architecture-unification.md`
- `packages/api/src/infrastructure/connectors/ConnectorRouter.ts`
- `packages/api/src/infrastructure/connectors/RedisConnectorThreadBindingStore.ts`
- `docs/features/F086-cat-orchestration-multi-mention.md`
- `packages/api/src/routes/callback-multi-mention-routes.ts`
- `docs/features/F102-memory-adapter-refactor.md`
- `docs/features/F044-channel-activity-system.md`
- `docs/features/F033-session-strategy-configurability.md`
- `packages/shared/src/types/session.ts`
- `packages/api/src/routes/workspace.ts`
- `packages/api/src/routes/workspace-edit.ts`
- `packages/api/src/domains/workspace/workspace-security.ts`

## 一、OpenClaw 官方已确认的事实

### 1. Gateway 是单一控制平面，不只是“消息转发器”

官方明确写的是：

- 一个长期运行的 Gateway 拥有 messaging surfaces、sessions、routing 和 channel connections
- control-plane clients 和 nodes 都连到同一个 Gateway WebSocket
- Gateway 维护 provider connection，暴露 typed WS API，并做 schema 校验

这意味着 OpenClaw 的 Gateway 不是“某个 transport adapter 层”，而是整个运行时的**控制面真相源**。

### 2. Session state 明确由 Gateway 持有

官方 `Session Management` 直接写了：

- Gateway is the source of truth
- session store 在 gateway host 上
- store file 是 `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- transcript 是 `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

这点很关键。OpenClaw 的 UI 客户端不会各自读本地 transcript 自己“修”状态，而是回 Gateway 查 session list / token counts / history。

### 3. Multi-agent routing 的隔离粒度很硬

官方 `Multi-Agent Routing` 定义的一个 agent 包含：

- 独立 workspace
- 独立 `agentDir`
- 独立 session store
- 独立 auth profiles

并且 routing 通过 binding 决定 inbound 到哪个 `agentId`。这是“多脑 + 强隔离”模型，不是“一个大线程里多 persona 混住”。

### 4. Memory 的真相源是 Markdown，不是索引

官方 `Memory` 页写得很清楚：

- memory 是 agent workspace 里的 plain Markdown
- files are the source of truth
- model only remembers what gets written to disk
- `memory_search` / `memory_get` 围绕这些文件工作

默认层次：

- `memory/YYYY-MM-DD.md`：日常日志
- `MEMORY.md`：长期整理记忆

并且 compaction 前有 **automatic memory flush**：session 接近 compaction 时，系统会触发 silent turn 提醒模型先把 durable memory 写盘。

### 5. Nodes 不是 Gateway 分身，而是能力宿主

官方 `Nodes` 页定义：

- node 是 companion device
- 通过同一个 Gateway WS，用 `role: "node"` 接入
- 通过 `node.invoke` 暴露命令面
- 可以提供 `canvas.*`、`camera.*`、`screen.record`、`location.get` 等能力

官方还强调：

- nodes are peripherals, not gateways
- Telegram/WhatsApp 等消息落在 gateway，不在 node

所以 Node 的本质是“外设能力面”，不是第二个聊天入口。

### 6. Tool / sandbox policy 是按 agent 分层限制的

官方 `Multi-Agent Sandbox & Tools` 说明：

- 每个 agent 可以有自己的 sandbox config
- 每个 agent 可以有自己的 tool allow/deny
- tool groups 有显式分组，包含 `group:sessions`、`group:memory`、`group:nodes`
- 限制只能层层收紧，不能后面再放宽前面 deny 的工具

这说明 OpenClaw 不是只做了“多 agent routing”，而是把**权限轮廓**也做成 per-agent first-class config。

### 7. “同一设备可带多个 role”是官方存在的能力，但双连接细节不宜乱猜

官方 `Gateway Protocol` 搜索摘要明确提到：

- presence entries 可以显示一个 device 同时以 operator 和 node 角色连接

这能确认“单设备双角色”是被协议支持的。

但我们这次**没有找到官方文档明确写 iOS 一定维护两个独立 WebSocket 连接**。所以：

- “设备可同时拥有 operator + node 角色”是已确认
- “iOS 当前实现一定是双 WS session 架构”这句，这次不能当已确认事实

## 二、Cat Café 当前已经学到的部分

### 1. 我们已经学到了“transport gateway + thread binding”这一层

F088 的三层结构已经非常接近 OpenClaw 的 transport/routing 思路：

1. `Principal Link`: `connector + externalSenderId -> internalUserId`
2. `Session Binding`: `connector + externalChatId -> activeThreadId`
3. `Command Layer`: `/new /threads /use /where`

并且已经落到代码：

- `ConnectorRouter` 负责 dedup、binding、message append、broadcast、invoke
- `RedisConnectorThreadBindingStore` 用 Redis + Lua 做 durable binding

这不是概念图，是真跑起来的 gateway 基座。

### 2. 我们已经学到了“统一消息管道”而不是 adapter 内写业务

F088 spec 和 `ConnectorRouter.ts` 都明确：

- adapter 只处理 parse / send
- 公共逻辑走统一 message/invoke pipeline
- connector 命令也会回写 message store，并 WebSocket 广播

这点和 OpenClaw “Gateway owns messaging surface”方向一致。

### 3. 我们已经学到了“多猫编排需要结构化调度，而不是纯文本 @”

F086 已经把 `multi_mention` 做成结构化工具：

- `callbackTo` 必填
- `targets <= 3`
- 必须带 `searchEvidenceRefs` 或 `overrideReason`
- 有状态机、超时、回流、anti-cascade guard

这和 OpenClaw 把 session tools / coordination tools 做成显式能力，而不是靠 prompt 默会，思路是同一条线。

### 4. 我们已经有 workspace / preview / edit 的能力面，但它们还不是 OpenClaw 式 node layer

Cat Café 已有：

- Workspace Explorer
- Workspace Edit API
- Preview Gateway
- BrowserPanel / terminal / git health 等工作区能力

这些说明我们已经有“agent 可操作工作环境”的一部分基础。

但这和 OpenClaw 的 node layer 仍然不是一回事：

- 我们现在主要是**本机工作区能力**
- OpenClaw node 是**外设/移动端/远端设备能力**

### 5. 我们对 memory 的终态方向，已经和 OpenClaw 产生明显共鸣

F102 明确提出：

- 知识真相源是 `docs/*.md`
- SQLite index 是编译产物
- 不能把 retain 直接当长期库
- 要有 marker/materialization/reindex 流水线

这和 OpenClaw 的“Markdown 真相源 + 搜索索引”哲学是高度同向的。

## 三、我们还没学到，或者只学到一半的地方

### 1. 我们还没有一个真正“单点归口”的 session truth boundary

我们现在 session 相关能力很多：

- F033 Session Strategy
- F065 Session Continuity
- session chain records
- callback invocation tracking
- connector thread binding

但这些状态仍然分散在多个概念里：

- thread
- invocation
- active slot
- connector binding
- CLI resume session
- sealed session digest

我的判断：

- 我们已经有很多局部真相源
- 但还没有一个像 OpenClaw `sessions.json` 那样，一眼能说清“这个 conversation 当前到底指向哪条 session / 哪个运行态 / 哪个 reset policy”的统一模型

这不是说我们现在错了，而是说明我们还处在“多组件协同”阶段，没有完全进入“单控制面模型”。

### 2. 我们的 connector binding 还没有上升成“conversation identity model”

OpenClaw `Session Management` 里有几件很成熟的事：

- `dmScope`
- `identityLinks`
- `accountId`
- direct / group / channel / topic 的 key 规则

而我们 F088 当前的 binding 仍主要是：

- `externalChatId -> activeThreadId`
- `externalSenderId -> internalUserId`

这对 MVP 很够，但到多账号、多平台、同一人跨平台、群聊/子话题时，会不够精确。

### 3. 我们的 memory 终态设计对了，但自动写入治理还没闭环

OpenClaw 的 pre-compaction memory flush 很值得注意，因为它做了两件事：

- 不是靠人记得写
- 也不是把所有碎片自动入长期库

它是在 compaction 临界点做一次**受提示的 durable write**

我们这边目前：

- 有 `MEMORY.md`/反思/feature docs/lesson docs 的意识
- 有 F102 的 marker/materialization 设计
- 但还缺“session 接近 seal/compaction 时，自动触发 durable candidate 写入”的稳定机制

### 4. 我们还没有 OpenClaw 那种 per-agent 工具轮廓

Cat Café 的猫猫区别更多来自：

- system prompt / 身份契约
- skills
- 编排路径

但在工具能力上，还没有形成像 OpenClaw 那样明确的：

- 这只猫能不能 `exec`
- 能不能 `apply_patch`
- 能不能调 session / memory / node 工具
- 哪些是全局 deny，哪些是 per-agent deny

这在“多猫协作 + 外部接入 + 公共/半公共工作面”越来越多之后，会变成治理问题。

### 5. 我们现在没有真正的 node/capability host 抽象

Cat Café 现有 Playwright、Antigravity、workspace browser、terminal 都很强，但它们更像：

- 各自独立的工具/面板

OpenClaw node 的抽象是：

- 一个被 pair 的能力宿主
- 对 Gateway 暴露一组 commands
- Gateway 统一调度

我们还没有这个统一抽象。

## 四、Cat Café 最值得学的，不是“再做一个 Gateway”，而是这 5 个原则

### P1. 把“控制面真相源”讲清楚

建议学：

- 明确哪一个 store / model 才是 runtime truth
- UI、connector、callback、session inspector 都从这里读“当前状态”

建议不要学成：

- 什么都塞进一个超级进程
- 所有东西都模仿 OpenClaw 的 `sessions.json`

我们更需要的是**统一语义边界**，不一定是相同文件结构。

### P2. 在 transport binding 之上，加一层 conversation identity

建议补一层统一模型，至少覆盖：

- platform account
- external sender identity
- external chat identity
- thread/topic identity
- internal owner/user identity
- active thread / active session pointer

这层会直接帮助：

- F088 后续多账号 / iMessage / 群聊
- F044 channel / activity
- 未来多平台同人归并

### P3. 把 durable memory 写入变成 lifecycle 的一部分

我认为这条是这次最值得立即吸收的。

OpenClaw 启发我们的不是“Markdown memory”本身，因为我们已经懂这个方向了。

真正值得学的是：

- 临近压缩/交接时，系统主动提醒写 durable memory
- 真相源写盘发生在 lifecycle 节点，不是靠灵感

Cat Café 的落地方向应是：

- 基于 F033/F065 的 seal / pre-seal 生命周期
- 写入 `docs/markers/*.yaml` 或等价候选层
- 再走 F102 的 materialization 审核链

不是直接让模型随便改长期记忆真相源。

### P4. 让 per-cat tool policy 成为显式配置

建议未来补：

- `group:fs` / `group:runtime` / `group:memory` / `group:session` 这类 tool family
- 每只猫的 allow/deny baseline
- 某些 route/context 下的额外收紧

这会让“砚砚是 review 强猫，但不是所有时候都该有写权限”这类治理能力，从人格描述变成运行时约束。

### P5. 把 node 当成后续 capability host 方向，不要现在就过度抽象

OpenClaw node 很诱人，但我们要克制。

现在 Cat Café 更像应该先做：

- `capability host` 的轻量抽象
- 先统一已有 browser / screenshot / terminal / external device automation

而不是马上造：

- 通用 node pairing
- 移动端 runtime
- role=node 协议面

如果没有明确产品场景，这会变成过早架构。

## 五、明确不该照搬的地方

### 1. 不该把 Cat Café 直接改造成 OpenClaw 式“强隔离多脑”

OpenClaw 的目标之一是：

- 多 agent side-by-side
- auth / sessions / workspace 强隔离

Cat Café 的核心价值之一则是：

- 多猫协作
- 共享真相源
- thread 内显式协作

所以我们不能为了学 OpenClaw，把猫猫之间重新切回“各管各的脑袋、只靠 bindings 接触”。

### 2. 不该把 Markdown memory 理解成“可以随便写”

OpenClaw 官方强调 Markdown 是真相源，这很强。

但我们家更需要同时记住另一半：

- 长期记忆可被污染
- 错误 durable write 会跨 session 传播

所以 Cat Café 继续走 F102 的 marker -> review -> materialize，会比直接模仿 OpenClaw 更适合我们。

### 3. 不该把 Preview Gateway 混同为 OpenClaw Gateway

我们现在有 Preview Gateway，这很好。

但它解决的是：

- localhost app preview
- iframe / HMR / proxy / port isolation

OpenClaw Gateway 解决的是：

- channel connections
- session truth
- routing
- control plane
- node transport

这两个“gateway”不是同一个层级。

## 六、我对我们下一步的建议

### 优先级 P1：立一个“Conversation Identity + Session Pointer”议题

目标不是重写全栈，而是把以下概念正式化：

- `principal`
- `conversation`
- `thread/topic`
- `activeThreadId`
- `activeSessionId`
- `reset policy`
- `account/channel scope`

这会是 F088 后续 phase、F044、F077 的共同地基。

### 优先级 P1：在 F102/F065 之间补“pre-seal durable memory flush”

建议路径：

1. 在 session 即将 seal / compaction / auto-handoff 时触发
2. 产物先落候选层，不直写长期真相源
3. 用 materialization/review 决定哪些升格

这是我们最能立刻吸收 OpenClaw 长处，同时规避 memory poisoning 的点。

### 优先级 P2：把 per-cat tool family policy 做成显式配置

最小版就够：

- 文件系
- 运行系
- 记忆系
- 协作/调度系

先有配置面，再决定哪些猫默认只读、哪些 route 需要进一步收紧。

### 优先级 P3：把 capability host 作为“nodes-lite”方向研究

研究问题可以是：

- 我们能否把 BrowserPanel / Playwright / Antigravity 统一成一个 capability host registry？
- 这个 registry 是否真的减少编排复杂度，还是只是新术语？

在没有明确移动端/远端外设需求前，不建议直接做 full node architecture。

## 七、最终判断

### 一句话版本

OpenClaw 最值得我们学的不是“Gateway 这个词”，而是三件工程化做法：

1. **控制面真相源明确**
2. **memory 真相源与索引分层**
3. **外设能力与 agent 运行时之间有清晰边界**

### 我对我们现状的结论

- **已经学到的**：transport gateway、thread binding、统一消息管道、结构化协作编排
- **学到一半的**：session truth、memory lifecycle、tool governance
- **还没该学的**：full node architecture

### 最重要的非猜测结论

如果我们现在只继续加 connector/platform，而不先补：

- conversation identity
- session pointer truth
- durable memory lifecycle

后面复杂度会明显上升，而且会开始出现“功能都有，但状态边界越来越说不清”的问题。

## 收敛检查

1. 否决理由 → ADR？[没有，本轮是 research synthesis]
2. 踩坑教训 → lessons-learned？[没有新增通用教训]
3. 操作规则 → 指引文件？[没有，本轮先不改规则]
