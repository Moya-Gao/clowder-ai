---
feature_ids: []
topics: [agent, teams, compare]
doc_kind: research
created: 2026-02-06
---

# Claude Code Agent Teams 对 Cat Café 的借鉴研究

> 日期：2026-02-06  
> 研究者：缅因猫（Codex）  
> 目的：基于官方资料与本仓库实现，评估 Cat Café 可借鉴点

---

## TL;DR

Cat Café 当前已经具备 Agent Teams 的若干核心雏形（独立会话、跨 Agent 回传、共享上下文接口），但缺少 **Team Lead 显式编排层**、**共享任务清单（可追踪状态）**、**并行调度与成本治理**。  
建议在 Phase 3 增加“任务层 + 编排层”，把现有“消息驱动协作”升级为“任务驱动协作”。

---

## 1. Cat Café 当前工程快照（基于代码）

### 1.1 已实现能力

1. 三猫独立服务接入（CLI 子进程）：
   - `packages/api/src/domains/cats/services/ClaudeAgentService.ts`
   - `packages/api/src/domains/cats/services/CodexAgentService.ts`
   - `packages/api/src/domains/cats/services/GeminiAgentService.ts`
2. 统一路由与串行协作：
   - `AgentRouter` 支持中英文 @ 提及、默认路由、多猫串行链式上下文传递
   - 文件：`packages/api/src/domains/cats/services/AgentRouter.ts`
3. 回调鉴权与跨 Agent 回传：
   - `InvocationRegistry` 生成并校验 `invocationId + callbackToken`
   - 回调端点：`/api/callbacks/post-message|pending-mentions|thread-context`
   - 文件：`packages/api/src/domains/cats/services/InvocationRegistry.ts`、`packages/api/src/routes/callbacks.ts`
4. 共享 MCP 工具：
   - 文件读写 + 回调工具（主动发言/取提及/取上下文）
   - 文件：`packages/mcp-server/src/index.ts`、`packages/mcp-server/src/tools/callback-tools.ts`

### 1.2 当前短板

1. 协作仍以“消息链”为主，而非“任务链”：
   - 无 `task` 实体、无 owner/status/dependency。
2. 多猫仍是串行优先：
   - 缺少“可并行任务调度 + 并发上限 + 预算控制”。
3. 会话与编排状态未完全持久化：
   - `AgentRouter` 中 session 仍为内存 Map。
4. 广播粒度偏粗：
   - WebSocket 当前直接全局 `io.emit`，缺少按用户/线程隔离。

---

## 2. 外部事实核验（Agent Teams）

> 说明：以下“已证实”优先使用 Anthropic 官方文档/博客；“社区观察”标注为非官方。

### 2.1 已证实（官方）

1. Agent Teams 为 Team Lead + Teammates 模式，teammates 拥有独立上下文，并通过共享 task list + inbox 通讯。
2. 用户可直接与任意 teammate 对话，不必经 Team Lead 中转。
3. 当前限制包括：不支持 team session resume、不支持嵌套 teams、仅本地 teammate 通讯。
4. token 成本会随 teammates 与 plan mode 上升，官方给出典型范围约 1x 到 7x。
5. Anthropic 官方工程案例：16 agents、约 2000 sessions、约 $20,000 API 成本，从零实现可编译 Linux kernel 的 C 编译器（Rust）。

### 2.2 社区观察（非官方）

1. 社区有人通过二进制字符串发现 `TeammateTool` 痕迹，包含多种操作（“13 operations”说法来自社区整理）。
2. HN 存在“宁可单 Agent 更可靠，不想并行刷大量 PR”的质疑，核心焦点是可靠性与成本。

---

## 3. 和 Cat Café 的对照结论

### 3.1 同源点（方向正确）

1. 都强调“Agent 不是 API 调用函数”，而是有状态协作者。
2. 都在做“用户-代理-代理”三方协同，而非单轮问答。
3. 都需要专门的通信面（messages/inbox/task context），而不是把所有信息塞进同一个 prompt。

### 3.2 差异点（Cat Café 的机会）

1. Agent Teams 强在“任务编排对象化”；Cat Café 目前主要是“消息编排”。
2. Agent Teams 有显式 Team Lead；Cat Café 当前由用户提及顺序隐式决定流程。
3. Cat Café 的独特优势是跨模型（Claude + Codex + Gemini），这点比同族 team 更有上限，但也更需要标准化协议层。

---

## 4. 建议路线（按优先级）

### P1（建议优先，1-2 周）

1. 引入 `Task` 领域模型：
   - 字段：`taskId`, `ownerCatId`, `status(todo|doing|blocked|done)`, `dependsOn`, `createdBy`, `updatedAt`。
   - 新 API：`POST /api/tasks`, `PATCH /api/tasks/:id`, `GET /api/tasks?threadId=...`。
   - MCP 新工具：`cat_cafe_create_task`, `cat_cafe_update_task`, `cat_cafe_list_tasks`。
2. 引入显式编排策略：
   - `routeMode = serial | parallel | lead`
   - 默认 `serial`，用户可切换；`lead` 由主猫负责拆解和分发。
3. WebSocket 按 user/thread 分房间广播，避免跨用户串流泄露。

### P2（中期，2-4 周）

1. Session/Invocation 持久化到 Redis：
   - 解决重启丢状态、支持更稳定的长会话。
2. 提及 inbox 增加 ACK/cursor：
   - 避免重复消费 `pending-mentions`。
3. 增加协作审计日志：
   - 记录 task 分配、状态变更、回调来源、错误归因。

### P3（进阶）

1. 并行成本治理：
   - 并发上限、每轮 token 预算、超预算降级到串行。
2. 冲突治理：
   - 每猫 worktree/branch 隔离 + 自动 merge gate（lint/test/review）。

---

## 5. 可直接执行的下一步

1. 先做一个最小 `Task` 实体（内存版）和任务面板 API，不动现有消息链。  
2. 在 `AgentRouter` 加一个 `lead` 模式（由 @布偶拆任务给 @缅因/@暹罗）。  
3. 完成后再迁移 Redis 持久化与并行调度，避免一次性大改。

---

## 参考资料

### 官方

- Anthropic 发布（Opus 4.6，提及 Agent Teams）：<https://www.anthropic.com/news/claude-opus-4-6>
- Claude Code 文档（Agent Teams setup）：<https://code.claude.com/docs/agent-teams/set-up>
- Claude Code 文档（Agent Teams costs）：<https://code.claude.com/docs/agent-teams/costs>
- Claude Code 文档（Agent Teams task list）：<https://code.claude.com/docs/agent-teams/task-list>
- Anthropic 工程案例（C compiler with agent teams）：<https://www.anthropic.com/engineering/building-c-compiler-with-agent-teams>

### 社区

- HN 讨论（关于并行 agent 成本与价值）：<https://news.ycombinator.com/item?id=45152897>
- 社区二进制观察（TeammateTool）：<https://gist.github.com/kurtextrem/0877ea7cf683e2813f90ba3f4e3dfda5>
