# OpenFlow 拆解

> 调研日期：2026-05-22
> 来源：铲屎官朋友的项目
> 仓库：https://github.com/xmkid/OpenFlow
> 本地：/Users/lysander/projects/ref/OpenFlow
> Commit：bf7db0116ae40e5d0f8505dfda0aec07192a227e
> 最后更新：2026-05-22
> 语言：JavaScript (Node.js) | 文件：612 | 源码：~84k 行 | 测试：183 个
> Stars: 2 | 早期阶段，活跃开发中（2026-03 创建，每 2-3 天提交）

## 一句话

**OpenFlow = 多角色 AI 协作平台，核心创新是三模式执行（ad-hoc / workflow_suggested / workflow_bound），让"自由聊天"和"硬流程管控"共存于同一会话中。**

## Claims Ledger

| # | Claim | Evidence Files | Verdict | Caveat |
|---|-------|----------------|---------|--------|
| C1 | Skill 驱动的多角色 AI 协作 | `config/skills/` (17 个 Skill)、`ai-roles.example.json` (5 角色 + 2 通用) | **实证** | Skill 是 prompt 级纪律，非运行时强制 |
| C2 | 多角色在同一会话中协同 | `src/orchestration/router.js`、`src/worker/worker-manager.js` | **实证** | 每角色是独立 worker 进程，靠 @ 路由 |
| C3 | Web UI 实时协作 | `src/master/master.js` (Express+Socket.io)、`public/` | **实证** | 前端是原生 HTML+JS，非 React SPA（仅 workflow modeler 用 React） |
| C4 | 自由协作或流程管控 | `config/driver/workflow-activation-guidance.md` (三模式)、`src/orchestration/workflow-runtime-service.js` (1397 行) | **实证，核心创新** | workflow_suggested 只是 proposal，需用户确认才绑定 |
| C5 | 18 个内置 Skill | `config/skills/` 目录 | **实证**（实数 17） | 每个 Skill 含 SKILL.md + artifacts（YAML 模板+写作指南+review 指南） |
| C6 | 内置 Issue 跟踪和 Backlog | `src/mcp/` (MCP servers: issue-tracker, backlog-center) | **实证** | MCP server 实现，SQLite 存储 |
| C7 | 多模型后端支持 | `src/agent-runtime/adapters/` (claude-cli, codex-cli, opencode-cli) | **实证** | 适配器模式，每个 adapter 独立实现 |
| C8 | SQLite 零配置 | `src/db/database.js` | **实证** | 单文件存储，简洁 |
| C9 | 节点、门禁、交棒 | `config/workflow-templates/default-dev/workflow.yaml` (293 行) | **实证** | 完整 DAG：requirements→architecture→plan→code→quality-gate→review→test→closure→end |

## 架构地图

```
┌─────────────────────────────────────────────────────────────┐
│  Master Server (Express + Socket.io)                        │
│  src/master/master.js                                       │
│  ├── Conversation Model (messages, members, workflow binding)│
│  ├── Message Queue (per-conversation FIFO)                  │
│  ├── Worker Events (IPC listener)                           │
│  └── Socket Handlers (WebSocket → UI)                       │
├─────────────────────────────────────────────────────────────┤
│  Orchestration Layer                                        │
│  src/orchestration/                                         │
│  ├── Router ─── resolve @mentions / defaults / workflow     │
│  │   ├── SERIAL mode (单目标)                               │
│  │   └── FANOUT mode (多目标并行)                            │
│  ├── Scheduler ─── execution slots (1 slot/conv-agent pair) │
│  ├── Invocation Service ─── lifecycle tracking              │
│  │   └── queued → running → succeeded/failed/cancelled      │
│  ├── Workflow Runtime Service ─── state machine (1397 行)   │
│  │   ├── flow states: active/blocked/recovering/await_user  │
│  │   ├── node transitions: skill→gate→__end__               │
│  │   └── baton/handoff: continue/await_user/reassign/hard   │
│  ├── Artifact Registry ─── produced→review→approved         │
│  └── Context Assembler ─── session summaries + memory facts │
├─────────────────────────────────────────────────────────────┤
│  Worker Layer (forked child processes)                      │
│  src/worker/                                                │
│  ├── AI Worker ─── per-agent process (idle/thinking)        │
│  ├── Worker Manager ─── fork/shutdown/force-kill lifecycle  │
│  ├── Prompt Builder ─── template + context + history        │
│  └── Runtime Session Manager ─── resume capsules            │
├─────────────────────────────────────────────────────────────┤
│  Agent Runtime Adapters                                     │
│  src/agent-runtime/                                         │
│  ├── claude-cli ─── Claude Code CLI                         │
│  ├── codex-cli ─── OpenAI Codex CLI                         │
│  └── opencode-cli ─── OpenCode CLI (Kimi 等)                │
├─────────────────────────────────────────────────────────────┤
│  MCP Layer                                                  │
│  src/mcp/                                                   │
│  ├── MCP Client ─── JSON-RPC 2.0 over stdio                │
│  ├── issue-tracker server                                   │
│  ├── backlog-center server                                  │
│  ├── agent-memory server                                    │
│  ├── playwright server                                      │
│  └── filesystem server                                      │
├─────────────────────────────────────────────────────────────┤
│  Storage: SQLite (messages, workflows, artifacts, invocations)│
└─────────────────────────────────────────────────────────────┘

Config Layer (non-code):
  config/driver/        ← shared-rules, SOP, skill-routing, coding-principles
  config/skills/        ← 17 Skill definitions (SKILL.md + artifact YAMLs)
  config/workflow-templates/ ← YAML workflow definitions (nodes + edges + gates)
  config/system-prompt.md   ← prompt fragments (group/private/mcp/workspace)
```

## 明星特性深挖

### 1. 三模式执行（核心创新）

这是 OpenFlow 对 "agent vs workflow" 问题的回答：

```
ad-hoc ──────── workflow_suggested ──────── workflow_bound
 (自由聊天)        (agent 建议启用)         (硬流程管控)
```

**链路追踪**：

```
用户发消息
  → router.routeUserMessage()
    → 检查 conv.workflowBinding
      → 无绑定 → ad-hoc 模式，@ 路由或默认目标
      → 有绑定 → workflow_bound 模式
        → workflow-runtime-service 读 currentNode
        → 确定 batonHolder（当前节点 owner）
        → 注入节点 prompt + 出口条件 + gate 规则
  → agent 执行完毕
    → 解析 response 中的 a2a-callback 块
      → {"type":"handoff", "workflowRuntimePatch": {...}}
      → workflow-runtime-service.applyPatch()
        → 验证目标节点在模板中合法
        → 更新 currentNode, batonHolder, flowState
        → 如果是 gate → 检查 on_pass/on_fail
```

**关键设计决策**：
- Agent 不能自动绑定 workflow，只能发 `workflow_activation_proposal`，用户确认后才绑定
- Workflow 状态变更通过 agent response 中的结构化 `a2a-callback` 块表达
- 节点转移必须在模板定义的合法跳转范围内（`exits` 列表）
- Gate 节点是阻塞门，`on_pass`/`on_fail` 二选一

### 2. Skill-Artifact 合约

每个 Skill 不只是一份 prompt，还附带**结构化 artifact 定义**：

```
config/skills/coding/
  ├── SKILL.md                              ← prompt 级纪律
  └── artifacts/
      ├── implementation-change-set.yaml    ← artifact schema
      ├── implementation-change-set-template.md   ← 填写模板
      ├── implementation-change-set-writing-guide.md ← 写作指南
      └── implementation-change-set-review-guide.md  ← review 指南
```

每个 artifact 有 4 份文档（schema + template + writing guide + review guide），形成一个**质量合约**：作者知道怎么写，reviewer 知道怎么审。

**链路**：Workflow runtime 的 Artifact Registry 追踪每个 artifact 的状态（`produced → ready_for_review → approved`），可选启用强制校验（`enforcementEnabled`）。

### 3. 可视化 Workflow Modeler

`workflow-modeler/` 是一个 React 组件（基于 @xyflow/react），提供拖拽式 workflow 编辑：
- `templateToCanvas()`: YAML 模板 → React Flow 画布
- `canvasToTemplate()`: 画布 → YAML 模板
- `validateCanvasGraph()`: 图验证（连通性、无孤儿节点等）
- 支持 skill 节点和 gate 节点的可视化编辑

### 4. Resume Capsule（上下文压缩）

长 workflow 跨越多轮对话时，不重放全部历史，而是构建 **resume capsule**：
- `goal`: 当前任务目标
- `doneItems`: 已完成项
- `currentFocus`: 当前关注点

Agent 冷启动时只需读 capsule + 最近几条消息，不需要完整历史。

### 5. A2A Callback 协议

Agent 回复中嵌入结构化块来驱动系统行为：

```
```a2a-callback
{
  "type": "handoff",           // handoff | workflow_activation_proposal | ...
  "targets": ["reviewer"],     // 交给谁
  "handoffKind": "hard_handoff",
  "progressNote": "...",       // 给人看的推进日志
  "workflowRuntimePatch": {    // 状态变更
    "currentNode": "code_review",
    "batonHolder": "reviewer",
    "flowState": "active"
  }
}
```　
```

Agent 通过文本中的 fenced block 来表达系统级操作——不依赖 tool call，也不依赖特殊 API。

## 算法剥皮表

| 被宣传为 | 实际是 | 分类 |
|----------|--------|------|
| Skill 路由 | 基于关键词的路由表 + agent 自主判断 | 规则 |
| Workflow 状态机 | 确定性 DAG 状态机（YAML 定义） | 规则 |
| 三模式切换 | 用户手动绑定 + agent proposal | 规则 + 人工确认 |
| 质量门禁 | Skill prompt 要求 + 可选 artifact 校验 | 规则（软约束为主） |
| Context 压缩 | Resume capsule（goal + done + focus） | 启发式 |
| Artifact 校验 | 可选的 artifact 存在性检查 | 规则 |
| Agent memory | MCP server + 搜索 | 外部服务 |

没有 LLM judge、RL、eval 循环或自动进化。系统的"智能"全在 agent（LLM）本身，框架负责**结构和纪律**。

## 与 Cat Café 的对比

### 惊人的相似性

OpenFlow 和 Cat Café 在 **Skill 系统设计** 上高度趋同：

| 相同点 | Cat Café | OpenFlow |
|--------|----------|----------|
| Skill 名称 | feat-lifecycle, writing-plans, coding, quality-gate, request-review, receive-review, merge-gate, cross-cat-handoff, self-evolution | 完全相同 |
| 五件套交接 | What/Why/Tradeoff/Open/Next | 完全相同 |
| 禁止表演性同意 | shared-rules 明确写 | shared-rules 明确写 |
| 用户确认是阻塞门 | shared-rules | shared-rules |
| Review 必须独立 | 跨个体/跨族 | 非原作者 |
| 先写测试再实现 | tdd skill | coding skill |

这说明两个项目独立地从**软件工程第一性原理**收敛到了相似的 Skill 分类和协作纪律。

### 核心差异

| 维度 | Cat Café | OpenFlow |
|------|----------|----------|
| **Agent 身份** | 每只猫是独立个体（有名字、性格、签名） | 角色是职能槽位（pm/architect/coder/reviewer/tester） |
| **Agent 实例** | 1 猫 = 1 独立 CLI 进程（Claude Code / Codex / Antigravity） | 1 角色 = 1 forked worker 进程，由 Master 统一管理 |
| **Workflow 绑定** | 隐式——SOP 是约定，Skill 是纪律，猫自主判断何时遵循 | 显式——三模式切换，workflow YAML 定义硬状态机 |
| **状态管理** | 分布式——消息传递 + Redis + 记忆系统 + Git | 集中式——SQLite + 内存状态 + Workflow Runtime Service |
| **前端** | 定制 Web UI（React + Lark/飞书集成） | 原生 HTML+JS + Socket.io + React workflow modeler |
| **MCP** | Cat Café MCP server（自研，协作+记忆+信号） | 内置 MCP servers（issue-tracker, backlog, memory, filesystem, playwright） |
| **Workflow 定义** | 没有显式 YAML workflow，靠 Skill 组合 + SOP 文档 | YAML 定义 DAG：节点类型（skill/gate）、出口条件、artifact 合约 |
| **部署** | 多猫分布在不同机器/进程 | 单 Master 进程管理所有 Worker |

### Learn（值得学的）

1. **三模式执行的显式化**：我们的 ad-hoc vs SOP-bound 是隐式的（猫自主判断），OpenFlow 把它变成了显式的系统状态，这让"什么时候该遵循流程"成为一个可观测、可审计的决策
2. **Skill-Artifact 四件套**：每个 Skill 附带 artifact schema + template + writing guide + review guide 的做法，让质量合约具体化了——我们的 Skill 主要是 SKILL.md，artifact 约束分散在各处
3. **Workflow YAML 模板化**：可视化编辑 + 模板复用 + 用户自定义 workflow 的路径清晰
4. **A2A Callback 协议**：用文本 fenced block 表达系统操作，不依赖 tool call——简洁且 provider-agnostic
5. **Resume Capsule**：对长 workflow 的上下文管理是个好思路

### Gap（我们的缺口）

1. 我们没有显式的 workflow YAML 定义——SOP 是人类可读文档，不是机器可执行的状态机
2. 我们没有 artifact 生命周期追踪（produced → review → approved）
3. 我们的三模式（自由聊天 / SOP 引导 / 硬门禁）是隐式的，没有系统级状态

### Do Not Follow（不跟的，含理由）

1. **角色 = 职能槽位**：我们的猫是有名字和性格的个体（W1: 猫猫是 Agent 不是 API）。角色化降低了 agent 的自主判断力和人格连续性
2. **集中式 Master**：我们的分布式架构（每猫独立进程）虽然复杂，但更接近真实的多 agent 协作——不依赖单点
3. **Worker 进程隔离**：OpenFlow 的 worker 是 master 的子进程，master 挂了全军覆没。我们的猫互相独立存活
4. **Prompt-level 软约束**：OpenFlow 的 gate/artifact 校验目前大部分是软约束（agent 自觉遵守），硬校验标注为"未来增强"——和我们的 `pnpm gate` 等硬门禁相比，可执行性弱

## 与 Bridgic AmphiFlow 的对比

| 维度 | Bridgic AmphiFlow | OpenFlow |
|------|-------------------|----------|
| **融合层次** | 单 agent 内部（on_agent + on_workflow） | 多 agent 编排层（workflow binding） |
| **切换触发** | 异常驱动自动降级 | 用户确认显式绑定 |
| **Workflow 定义** | Python 代码（async generator） | YAML 模板 |
| **Agent 数量** | 单 agent | 多角色多 agent |
| **Fallback** | Workflow 失败 → agent 自动接管 | 无自动 fallback，gate on_fail 回退到前序节点 |

**互补关系**：Bridgic 解决的是"一个 agent 内部怎么融合 workflow 和 agent 模式"；OpenFlow 解决的是"多个 agent 之间怎么在自由聊天和硬流程之间切换"。Cat Café 两个层次都涉及但都是隐式的。

## 特别关注

这个项目和 Cat Café 的 Skill 系统**高度趋同**（连五件套交接、表演性同意都一样），但架构选择不同：

- Cat Café：Agent-first，Workflow 是纪律约定
- OpenFlow：Workflow-first，Agent 在 workflow 框架内执行

两者从不同方向走向同一个终态：**让 agent 和 workflow 自然共存**。差异在于"谁先谁后"和"软约束还是硬约束"。
