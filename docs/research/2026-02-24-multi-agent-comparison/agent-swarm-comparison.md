---
feature_ids: [F002, F027]
topics: [multi, agent, comparison]
doc_kind: research
created: 2026-02-24
---

# Agent Swarm 协同方式对比报告

> 作者：布偶猫（综合四份调研报告）
> 日期：2026-02-24
> 来源：ChatGPT Deep Research + Claude.ai Deep Research + Gemini Deep Research + GPT-5.2 Pro 审阅

## 核心发现

**四个系统的 "multi-agent" 本质完全不同**：

- Claude Agent Teams / Kimi Swarm = 同一模型的多实例并行（同构）
- oh-my-opencode = 单向编排 + 有限异构（provider 抽象层）
- Cat Cafe = 不同 AI 厂商模型的对等协作（原生异构）

Cat Cafe 是四个方案中**唯一真正做到异构对等协作**的系统。

---

## 1. Claude Code Agent Teams — 星型邮箱制

### 架构拓扑

```
                    ┌──────────┐
                    │ Team Lead │  (中央大脑)
                    └─────┬────┘
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │Teammate │ │Teammate │ │Teammate │
         │ (前端)  │ │ (后端)  │ │ (测试)  │
         └─────────┘ └─────────┘ └─────────┘
```

### Agent Spawn 方式

Team Lead 通过 `config.json` 定义 teammates（角色名、工具权限、目录范围），启动时 fork 出独立 Claude Code 实例，每个有自己的 context window。

### Agent 间通信

**本地磁盘 JSON 邮箱**。路径类似 `~/.claude/teams/<project>/inboxes/<agent>.json`。

Agent 不实时聊天，而是像收邮件一样：
1. 执行一轮任务
2. 检查收件箱（读取 JSON 文件）
3. 处理消息
4. 通过 `SendMessageTool` 追加消息到对方 inbox

### 协同模式

- Team Lead 分配任务到 task list（pending / in_progress / completed 三态）
- Teammates 自行 claim 任务（self-claim）
- 任务完成后通过 mailbox 汇报
- **禁止嵌套**：teammate 不能再 spawn 子 team [已确认] [ChatGPT][Claude]
- **并发控制**：file locking 防多人同时改同一文件 [已确认] [ChatGPT][Gemini]
- **通信延迟高**：必须等一个执行回合结束才能读消息 [推测] [Gemini]

### 异构支持

❌ **同构**。所有 teammates 都是 Claude Code 实例，不支持混入其他 AI 模型。

### 优势与局限

| 优势 | 局限 |
|------|------|
| 简单可靠的通信机制（文件系统=持久化） | 通信延迟高（异步轮询） |
| file locking 防写入冲突 | 不支持异构模型 |
| 禁嵌套避免递归失控 | 不支持 session resume [已确认] [ChatGPT] |
| 任务三态机 + self-claim | shutdown 可能较慢 [已确认] [Claude] |

---

## 2. oh-my-opencode — 单向编排器制

### 架构拓扑

```
         用户请求
            ▼
      ┌─────────────┐
      │ Intent Gate  │  (意图网关)
      └──────┬──────┘
             ▼
      ┌─────────────┐
      │  Sisyphus    │  (中央编排器)
      └──────┬──────┘
         ┌───┼───┬───────┐
         ▼   ▼   ▼       ▼
       Oracle  Librarian  Frontend  ...11个角色
         │       │          │
         └───────┴──────────┘
              ▼ (单向汇报)
           Sisyphus
```

### Agent Spawn 方式

Sisyphus 通过 OpenCode 框架按配置实例化 sub-agents。11 个内置角色，可扩展自定义 agent。角色定义 = prompt template + tool 权限列表。

### Agent 间通信

**单向**。编排器 → 子 agent → 汇报回编排器。子 agent 之间**不能直接对话**。

Sisyphus 负责：
1. 接收 Intent Gate 分类后的请求
2. 制定执行计划
3. 单向委派任务给专用 agent
4. 收集汇报并综合结果

### 协同模式

- Intent Gate 先判断意图类型
- Sisyphus 制定计划，单向委派
- 子 agent 执行后汇报结果
- 两层隔离：prompt 隔离 + tool 权限隔离
- 6 层 provider fallback chain（2026-02 更新，支持 Kimi K2.5 / GLM-5 等可选编排模型）[已确认] [ChatGPT]

### 异构支持

⚠️ **有限异构**。OpenCode 抽象了 provider 层，理论上支持多模型切换。

> [Claude] 报告称社区验证了 GPT-5.3 Codex + Gemini 2.5 Pro + Claude Sonnet 4 混用。
> ⚠️ **GPT Pro 审阅标记此为"高风险断言"**：信息密度极高但缺乏可复现 demo 或 commit 引用 [GPT-Pro Part 2]

即使异构可行，通信仍是**单向编排**，不是对等协作。

### 已知问题

- 后台任务卡死（state machine 是核心痛点）[已确认] [ChatGPT]
- ralph-loop + todo-continuation-enforcer 导致无限循环 [已确认] [Gemini]
- 自定义 agent 对编排器不可见 bug (#1623) [已确认] [ChatGPT][Claude]
- **合规风险**：通过伪造 OAuth 签名使用订阅额度，Anthropic 已明确封禁 [已确认] [GPT-Pro引用 The Register]

### 优势与局限

| 优势 | 局限 |
|------|------|
| 开源社区活跃（133k LOC） | 单向通信，子 agent 缺全局上下文 |
| 11 内置角色开箱即用 | 后台任务稳定性差 |
| Provider 抽象支持模型切换 | OAuth 接入方式有 ToS 违规风险 |
| 6 层 fallback chain | 子 agent 间不能直接协作 |

---

## 3. Kimi Agent Swarm — 模型内生制

### 架构拓扑

```
      ┌─────────────────────────────┐
      │     K2.5 MoE (1.04T 参数)    │
      │  ┌─────────────────────┐    │
      │  │  Trainable          │    │
      │  │  Orchestrator (PARL)│    │
      │  └──────┬──────────────┘    │
      │    ┌────┼────┬────┬────┐    │
      │    ▼    ▼    ▼    ▼    ▼    │
      │  sub1 sub2 sub3 ...sub100   │
      │    │    │    │         │    │
      │    └────┴────┴─────────┘    │
      │         (模型内部并行)        │
      └─────────────────────────────┘
```

### Agent Spawn 方式

完全不同于其他三个——**没有外部进程 spawn**。

K2.5 的 MoE（混合专家）架构在**推理管道内部**直接孵化 sub-agents。通过 PARL（Parallel-Agent Reinforcement Learning）训练出来的编排器，在模型前向传播过程中动态分配子任务。

> ⚠️ **GPT Pro 纠正**：Agent Swarm 是 K2.5 的功能模式（Beta），"k1 + swarm" 在公开材料中未能确认，可能是旧命名或混称。Gemini 报告将其写成 "k1/k2.5 混合" 被标记为 [Critical] 分歧。[GPT-Pro Part 1]

### Agent 间通信

**模型内部**。sub-agents 共享推理管道，不需要 HTTP / 文件 / 消息队列。

- 通信延迟接近零
- Orchestrator 用 PARL 强化学习策略调度
- "Wide Research" 范式：把大任务拆成细粒度并行子任务 [已确认] [ChatGPT]

### 协同模式

- 最多 100 个 sub-agents [已确认] [ChatGPT][Gemini]
- 最多 1,500 tool calls [已确认] [ChatGPT]
- 用 "Critical Steps" 作为资源度量（不是 token）[已确认] [ChatGPT]
- Beta 阶段，常跑 10 分钟到 1 小时
- 启动后**人类无法中途干预** [已确认] [Claude]

> [Gemini] 称存在 "Stored Session 挂起与重连"，但 GPT Pro 审阅认为公开材料不支持此断言，更偏向 [Claude] 的"无中途干预"说法 [GPT-Pro Part 1]

### 异构支持

❌ **完全同构**。所有 sub-agents 都跑在 K2.5 MoE 上，是模型内部的并行计算单元。

### 优势与局限

| 优势 | 局限 |
|------|------|
| 100 agent 大规模并行 | 完全黑箱，不可观测 |
| 零通信延迟（模型内部） | 启动后人类无法干预 |
| PARL 训练出的智能调度 | 不支持异构模型 |
| Critical Steps 资源度量 | Beta 阶段，API 计费 |

---

## 4. Cat Cafe A2A — 去中心化对等制

### 架构拓扑

```
         铲屎官 (Human-in-the-Loop)
        ↕ (权限审批 + 策略棘轮)
   ┌────────┐    @mention    ┌────────┐
   │布偶猫   │ ◄──────────► │缅因猫   │
   │(Claude) │  ping-pong   │(Codex) │
   └────┬───┘    review     └────┬───┘
        │                        │
        │    @mention             │
        └────────┐  ┌────────────┘
                 ▼  ▼
              ┌────────┐
              │暹罗猫   │
              │(Gemini)│
              └────────┘

   通信: MCP 原生 / McpPromptInjector → HTTP callback
   队列: 共享 Worklist (无中央编排器)
```

### Agent Spawn 方式

OS 级 `spawn()` 启动各家**官方 CLI**：

```typescript
// 布偶猫 (Claude)
spawn('claude', ['-p', prompt, '--output-format', 'stream-json', '--chrome'])
// 缅因猫 (Codex)
spawn('codex', ['exec', '--json', task])
// 暹罗猫 (Gemini)
// 双 adapter: gemini-cli (headless) 或 Antigravity (IDE + MCP 回传)
```

**合规说明**：Cat Cafe 使用各家 CLI 的官方 headless 模式（`claude -p`、`codex exec`），这是正常的 CLI 调用，与 OMO 的 OAuth 冒充完全不同。[GPT-Pro Part 1 合规风险需纠正]

### Agent 间通信

**MCP 回传 + @mention 链式调用**：

1. Claude 原生支持 MCP → 直接 callback
2. Codex / Gemini 不支持 MCP → McpPromptInjector 在 system prompt 中注入 HTTP callback 指令
3. Agent 在回复中写 `@猫名` → 系统自动将目标猫加入 worklist

### 协同模式

- **去中心化 worklist**：共享执行队列，无中央编排器
- **Intent 驱动路由**：
  - @mention 1 只猫 → serial（执行模式）
  - @mention 2+ 只猫 → parallel（讨论模式）
  - 可用 `#ideate` / `#execute` 显式控制
- **Ping-pong review**：支持 A→B→A 的链式审查（布偶猫写代码→缅因猫审查→布偶猫修改）
- **最大深度 15 层**：防无限调用循环
- **强人在环**：
  - 敏感操作需铲屎官审批
  - 三级权限：once / thread / global
  - 策略学习棘轮：频繁批准的操作自动升级为永久规则
  - WebSocket + Web Push 双通道通知

### 异构支持

✅ **原生异构**。三个完全不同的 AI 厂商模型对等协作：

| 猫 | 模型 | MCP 支持 | 回传方式 |
|---|---|---|---|
| 布偶猫 | Claude (Anthropic) | 原生 | MCP callback |
| 缅因猫 | Codex (OpenAI) | 无 | McpPromptInjector → HTTP |
| 暹罗猫 | Gemini (Google) | 无 | McpPromptInjector → HTTP |

### 优势与局限

| 优势 | 局限 |
|------|------|
| 唯一真正异构对等协作 | McpPromptInjector 回传有格式漂移风险 [Gemini] |
| 强人在环 + 策略棘轮 | 去中心化缺写入锁，可能并发冲突 [GPT-Pro] |
| 订阅经济学（无 API 费） | 棘轮可能固化错误决策（policy drift）[Gemini][GPT-Pro] |
| Ping-pong review 模式 | CLI spawn 启动开销 ~500ms-2s |

---

## 综合对比表

| 维度 | Claude Agent Teams | oh-my-opencode | Kimi Swarm | Cat Cafe A2A |
|------|-------------------|----------------|------------|-------------|
| **编排模式** | 中心化星型 | 中心化编排器 | 模型内生编排 | 去中心化 worklist |
| **Spawn 方式** | 进程 fork | 框架实例化 | 推理管道内孵化 | OS spawn() CLI |
| **通信机制** | 磁盘 JSON 邮箱 | 单向汇报 | 模型内部共享 | MCP + HTTP callback |
| **通信延迟** | 高（轮询） | 中 | 近零 | 中（HTTP） |
| **异构支持** | ❌ 同构 | ⚠️ 有限 | ❌ 同构 | ✅ 原生异构 |
| **人在环** | 有（审批制） | 弱 | ❌ 无 | ✅ 强（三级棘轮） |
| **最大 agent 数** | 3-16 实测 | 11 内置 | 100 | 3（可扩展） |
| **并发控制** | file locking | 无（已知问题） | 模型内部 | worklist 队列 |
| **成本** | API token | 订阅（ToS 风险） | API token | 订阅（合规） |

---

## 一句话总结

> **Claude Teams = 一个老板带一群克隆人收发邮件**
> **OMO = 一个指挥官单向喊话给士兵**
> **Kimi Swarm = 一个大脑里的并行思维**
> **Cat Cafe = 三个不同物种的猫在同一个家里协商生活，铲屎官拍板**

---

## 引用来源

- `chatgpt-deep-research.md` — ChatGPT Deep Research (11min, 127 searches, 26 citations)
- `claude-ai-deep-research.md` — Claude.ai Opus 4.6 Extended (Web Search)
- `gemini-deep-research.md` — Gemini Deep Research (Pro)
- `gpt-pro-review.md` — GPT-5.2 Pro 交叉审阅
- [Kimi K2.5 Tech Blog](https://www.kimi.com/blog/kimi-k2-5.html)
- [The Register: Anthropic clarifies ban on third-party tool access](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)
