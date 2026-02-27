---
feature_ids: [F002, F027]
topics: [multi, agent, comparison]
doc_kind: research
created: 2026-02-24
---

# Multi-Agent 架构对比：Cat Cafe vs 业界方案

> 作者：布偶猫（Coder Cat 综合）
> 日期：2026-02-24
> 方法：WebSearch + WebFetch 初步调研（非 Deep Research 深度）
> 状态：初稿，待铲屎官审阅 + 可选 Web Deep Research 补充

---

## 一、四方案总览

| 维度 | Claude Code Agent Teams | oh-my-opencode (OMO) | Kimi K2.5 Agent Swarm | Cat Cafe A2A |
|------|------------------------|---------------------|----------------------|-------------|
| **出品方** | Anthropic（官方） | 社区（code-yeongyu） | Moonshot AI（官方） | 我们 |
| **发布时间** | 2026-02 (experimental) | 2025 持续迭代 | 2026-01-27 | 2025-12 ~ 今 |
| **编排模式** | 中心化（Team Lead） | 中心化（Sisyphus） | 中心化（训练出的 Orchestrator） | **去中心化（Worklist）** |
| **最大 agent 数** | 建议 3-5 | ~4-6 专门角色 | 最多 100 | 3（按设计，可扩展） |
| **Agent 异构性** | 同模型（Claude only） | 多模型（有 fallback chain） | 同模型（K2.5 only） | **跨平台异构（Claude/Codex/Gemini）** |
| **人在环程度** | 中（hooks + 权限继承） | 低（自动化优先） | 低（研究预览，自主运行） | **高（权限棘轮 + 双通道推送）** |
| **开源** | 否（CLI 闭源） | 是（OpenCode 插件） | 模型开源，Swarm 架构半开源 | 否（私有） |
| **成熟度** | Experimental | 生产可用但不稳定 | Research Preview | 生产自用 |

---

## 二、逐维度对比

### Q1: 架构模式

#### Claude Code Agent Teams — 中心化 Lead + 共享 Task DAG

- **Team Lead** 是唯一能创建 team、spawn teammates、管理 task list 的角色
- Teammates 之间可以直接 message / broadcast，但**不能 spawn 新 teammates**（禁止嵌套）
- Task list 是 DAG 结构，支持依赖关系，依赖完成后自动 unblock
- Task claiming 使用 **file locking** 防竞态
- 用户可以直接跟任何 teammate 对话（不必经过 lead）
- Team 配置存储在 `~/.claude/teams/{team-name}/config.json`，纯本地

**来源**: [Claude Code Agent Teams 官方文档](https://code.claude.com/docs/en/agent-teams)

#### oh-my-opencode — 中心化 Sisyphus + 角色隔离

- **Sisyphus** 是超级编排器，通过 `delegate-task` 工具向下委托
- 专门角色：**Hephaestus**（自主深度执行者）、**Oracle**（只读架构顾问）、**Librarian**（跨仓库研究）、**Explore**（代码导航）、**Prometheus**（战略规划）
- 通信是**单向的**——编排器→子 agent→汇报，不是点对点
- 子执行器（Sisyphus-Junior）**禁止再委托**——严格的层级隔离
- 角色隔离两层：prompt 约束 + tool 权限（Oracle 无法写代码、Librarian 是唯一有外部搜索权的）

**来源**: [oh-my-opencode 官网 agents 页](https://ohmyopencode.com/agents/)、[DeepWiki](https://deepwiki.com/code-yeongyu/oh-my-opencode)、我们 2026-02-13 调研报告

#### Kimi K2.5 Agent Swarm — 训练出来的动态编排器

- **核心创新**：编排器不是写规则，而是通过 PARL（Parallel-Agent Reinforcement Learning）**训练出来**的
- Orchestrator 动态决定：spawn 多少 sub-agent、何时实例化、每个 sub-agent 的专业化方向
- Sub-agents 是**冻结的策略检查点**，不参与梯度优化——只有 orchestrator 被训练
- 奖励函数三项：`r_parallel`（鼓励并行）+ `r_finish`（防止虚假并行）+ `r_perf`（任务成功率）
- **Serial Collapse 防御**：如果 orchestrator 退化为单 agent 串行，`r_parallel` 会惩罚
- **Spurious Parallelism 防御**：如果 spawn 一堆 agent 但不干实事，`r_finish` 会惩罚
- 随训练推进，λ₁ 和 λ₂ 退火到 0，最终只优化主目标

**关键指标**：最多 100 sub-agents、1500 tool calls、BrowseComp 78.4%（单 agent 60.6%）、延迟减少 3-4.5×

**来源**: [arXiv 2602.02276](https://arxiv.org/html/2602.02276v1)、[InfoQ](https://www.infoq.com/news/2026/02/kimi-k25-swarm/)

#### Cat Cafe — 去中心化 Worklist

- **没有编排器**——cat 通过在回复中 @mention 其他 cat 触发 A2A 链式调用
- Worklist 是共享执行队列，当前运行的 cat 可以追加目标
- 支持 A→B→A ping-pong（review 模式）、最大深度 15
- `routeSerial` 支持 A2A chain extension；`routeParallel` 不链接（MVP 安全边界）
- Intent 驱动：@2+ cats → parallel（ideate），@1 cat → serial（execute）

**独特之处**：Cat Cafe 是四个方案中唯一一个**没有中央编排器**的。Agent 自主决定是否需要协作，而不是被上层调度。

---

### Q2: Human-in-the-Loop 设计

| 维度 | Agent Teams | OMO | Kimi Swarm | **Cat Cafe** |
|------|------------|-----|-----------|-------------|
| 人的角色 | 监督 + 偶尔干预 | 基本不需要 | 基本不需要 | **主动审批 + 实时干预** |
| 权限系统 | 继承 lead 权限 + hooks | 无显式权限 | Inbox 通知（beta） | **三级审批棘轮** |
| 审批粒度 | PreToolUse hook（全局） | 无 | 未知 | **once/thread/global** |
| 策略学习 | 静态（配置文件） | 无 | 无 | **动态棘轮**（频繁批准→永久规则） |
| 通知渠道 | Terminal only | Terminal only | Inbox（web beta） | **WebSocket + Web Push** |
| 实时干预 | 可（直接跟 teammate 对话） | 有限 | 不可（swarm 自主运行） | **可（中断+重定向）** |

**Cat Cafe 在人在环维度是明显领先的。** 其他三个方案都倾向于"让 agent 自己跑"，Cat Cafe 是唯一一个把人在环作为核心设计原则的。

**Agent Teams 的 hooks 机制值得关注**：
- `TeammateIdle`: teammate 即将闲置时触发
- `TaskCompleted`: task 标记完成时触发
- `PreToolUse`: 每次工具调用前触发，可 allow/deny
- `PermissionRequest`: 权限请求 hook，可自定义逻辑

这些 hook 是代码级别的（shell 脚本/可执行文件），不是 UI 审批流。和 Cat Cafe 的 WebSocket + Web Push UI 审批是不同的设计哲学。

---

### Q3: Agent 异构性

| 方案 | 异构支持 | 详情 |
|------|---------|------|
| Agent Teams | **不支持** | 只能用 Claude，但 teammates 可以选不同 Claude 模型（Opus/Sonnet） |
| OMO | **支持** | 有 fallback chain，rate limit 时自动切模型。但本质都是 OpenCode 的 session |
| Kimi Swarm | **不支持** | Sub-agents 都是 K2.5 自身的冻结检查点 |
| **Cat Cafe** | **原生异构** | Claude/Codex/Gemini 各自 CLI，McpPromptInjector 统一回传 |

Cat Cafe 在异构性上是独特的——三个不同平台、不同能力、不同经济模型的 agent 共存。但这也带来了复杂度（不同 CLI 格式、MCP 支持差异、session 管理差异）。

---

### Q4: 任务分解与并行

| 方案 | 分解方式 | 并行模型 | 并发控制 | 依赖管理 |
|------|---------|---------|---------|---------|
| Agent Teams | Lead 分解 + 人工指定 | Teammates 并行执行 | 建议 3-5 teammates | Task DAG + file locking |
| OMO | Sisyphus 自动分解 | parallel-by-default | 通过 delegate-task | 未知 |
| Kimi Swarm | **Orchestrator 自动（训练学会的）** | **最多 100 并行 sub-agents** | CriticalSteps 指标 | 隐式（训练学会的） |
| Cat Cafe | **用户 @mention 驱动 + intent 推断** | ideate 模式（parallel）/ execute（serial） | MAX_A2A_DEPTH=15 | Worklist 顺序 |

**Kimi Swarm 在并行规模上碾压**——100 个 sub-agents、1500 tool calls，这是训练出来的能力。但它是为搜索和信息聚合类任务设计的，不是代码协作。

Cat Cafe 目前并行能力偏弱（ideate 模式是最基础的并行），这是可以向其他方案学习的地方。

---

### Q5: Session / Context / Memory

| 方案 | 上下文模型 | 跨 session 记忆 | 窗口满了怎么办 | 多 agent 上下文 |
|------|-----------|----------------|-------------|---------------|
| Agent Teams | 每个 teammate 独立上下文窗口 | **不支持 session resume**（已知限制） | Claude 内部压缩 | 隔离（只能通过 message 传递） |
| OMO | Hook 管理上下文压力 | Sisyphus 无状态设计（"STATELESS"） | pre-compression + truncation | 单向传递（委托时注入） |
| Kimi Swarm | Sub-agents 冻结策略，不维护状态 | 无（每次从零开始） | "Context sharding not truncation" | 隔离（orchestrator 分发） |
| **Cat Cafe** | **Session 链式管理** | **Transcript 存档 + Bootstrap 注入** | **seal + 新 session + 摘要** | 隔离 + MCP callback 共享 |

**Cat Cafe 的 Session 链是独特且领先的设计。** 其他三个方案都没有解决"session 满了怎么延续"的问题——Agent Teams 明确说不支持 resume，OMO 声明 stateless，Kimi Swarm 根本不维护 session。

Cat Cafe 的 active → sealing → sealed 链式生命周期 + transcript archival + bootstrap injection 是一个真正解决长期对话延续性的设计。

---

### Q6: 开发者体验与可扩展性

| 方案 | 加新 agent | Plugin 机制 | 配置 vs 代码 | 社区 |
|------|-----------|-----------|-----------|------|
| Agent Teams | 自然语言描述即可 spawn | Hooks（shell 脚本） | 自然语言 + settings.json | Anthropic 官方，刚发布 |
| OMO | 放 `.opencode/agents/` 目录 | Skills + MCP + Hooks（44个） | 配置文件 + prompt 文件 | GitHub 社区，活跃但不稳定 |
| Kimi Swarm | 不适用（模型能力，非框架） | 无 | 无（模型内置） | 研究社区 |
| Cat Cafe | 需改 CatId 类型 + AgentService | MCP tools + Skills | 代码驱动 | 内部项目 |

**Agent Teams 的开发者体验最好**——自然语言 spawn，不需要写代码。但也最不可定制。

**OMO 的扩展性最强**——44 个 lifecycle hooks、26 个 tools、skill/command/MCP 系统。但复杂度也最高，稳定性是问题。

---

### Q7: 已知问题与社区反馈

#### Agent Teams
- **No session resume**：resume/rewind 不能恢复 in-process teammates
- **Task status can lag**：teammates 有时忘记标记完成
- **No nested teams**：不能嵌套
- **Lead is fixed**：不能更换 lead
- **Token 成本高**：每个 teammate 独立 context window
- 社区反馈：刚发布（2 月），还在探索阶段

#### oh-my-opencode
- **后台任务卡住数小时**（GitHub issues）
- **并行任务竞态导致 Atlas 挂起**
- **无限通知循环**
- **订阅用量飙升**
- Anthropic 限制第三方 OAuth，直接点名此项目
- 自定义 agents 对 orchestrator 不可见（Issue #1623）

#### Kimi Swarm
- **Research Preview 状态**，不是生产 ready
- 超过 8-10 小时连续运行时出现协调问题
- 25 个 agents 时仍有等待瓶颈
- Serial collapse 是训练时的常见失败模式
- 595GB 模型大小，部署门槛极高

#### Cat Cafe
- CLI 启动开销 500ms-2s/次
- NDJSON 格式脆弱性
- 异构 agent 维护复杂度高
- 并行能力相对弱
- CatId 硬编码（F32 正在解决）

---

## 三、Q8: 对 Cat Cafe 的借鉴价值

### 每个方案最值得学习的设计点

| 方案 | 借鉴 #1 | 借鉴 #2 |
|------|---------|---------|
| Agent Teams | **Task DAG + 依赖管理** — 我们目前没有任务间依赖的概念 | **Quality Gate Hooks** (`TeammateIdle`, `TaskCompleted`) — 结构化的质量门禁 |
| OMO | **Strict role isolation**（Oracle 只读、Junior 不能再委托）— 我们可以给猫猫更细粒度的权限 | **Background tasks as first-class citizens** — 有 session_id, metadata, 通知, continuation |
| Kimi Swarm | **PARL 训练范式** — 用 RL 学编排策略而不是手写规则 | **Context sharding vs truncation** — 把任务分片给 sub-agents，避免单点上下文压力 |

### Cat Cafe 当前缺失但别人做得好的

1. **结构化任务管理**：Agent Teams 的 Task DAG 和 OMO 的 todo-driven workflow 都有明确的任务实体（ID, 状态, 依赖, owner）。Cat Cafe 的 worklist 是临时的执行队列，缺少持久化任务跟踪。→ 建议参考 BACKLOG #某项
2. **大规模并行**：Kimi Swarm 100 agents 并行是另一个量级。Cat Cafe 的 ideate 模式只是基础并行。→ 不一定需要 100 agents，但可以考虑更灵活的并行策略
3. **Quality Gate Hooks**：Agent Teams 在 task 完成时有结构化的质量检查。Cat Cafe 的质量检查依赖 Skills 和人工 review。→ 可以考虑自动化质量门禁

### Cat Cafe 做得独特/更好的

1. **人在环权限系统**：三级审批棘轮（once/thread/global）+ 策略学习 + 双通道推送。**没有任何竞品有这个设计。** 这不只是"能否审批"，而是一个随时间进化的权限边界系统。
2. **异构 Agent 共存**：真正跨平台（Claude/Codex/Gemini），通过 McpPromptInjector 统一回传。其他方案都是单模型或同质化的。
3. **Session 链式管理**：active → sealing → sealed + transcript 归档 + bootstrap 注入。**唯一一个真正解决了长期对话延续性的方案。**
4. **去中心化协作**：Agent 自主决定协作（@mention），而不是被编排器调度。更接近人类团队的协作模式。
5. **订阅经济学**：用订阅额度而非 API 计费，经济约束驱动架构创新。

### 具体改进建议

1. **引入 Task 实体**（借鉴 Agent Teams）：在 worklist 之上加一层持久化 Task（ID, 状态, 依赖, owner, 描述），让猫猫可以拆解任务并跟踪进度。这和现有的 `update-task` MCP tool 可以整合。
2. **考虑 Quality Gate Hook**（借鉴 Agent Teams + OMO）：cat 完成一个 task 时自动触发检查（lint、test、spec compliance），不通过则打回。目前靠 Skills 手动检查。
3. **Context Sharding 思路**（借鉴 Kimi Swarm）：面对大任务时，不是让一只猫处理所有上下文，而是把上下文切片分给不同猫。这和 ideate 模式的理念一致，但可以更结构化。

---

## 四、对比矩阵总览

```
              中心化程度    人在环     异构性    并行规模    Session 管理    稳定性
              ─────────    ─────     ──────    ────────    ──────────    ──────
Agent Teams   ████████░░   ███░░░    ░░░░░░    ████░░░░    ██░░░░░░░░    ████████░░
OMO           █████████░   █░░░░░    ████░░    ██████░░    ██░░░░░░░░    ████░░░░░░
Kimi Swarm    █████████░   █░░░░░    ░░░░░░    ██████████  ░░░░░░░░░░    ███░░░░░░░
Cat Cafe      ██░░░░░░░░   ██████    ██████    ██░░░░░░    ██████████    ████████░░
```

---

## 五、结论

四个方案代表了 multi-agent 设计的四种不同哲学：

| 方案 | 设计哲学 |
|------|---------|
| **Agent Teams** | "给开发者最低门槛的多 agent 体验"——自然语言 spawn，Anthropic 控制一切 |
| **OMO** | "把 OpenCode 变成多 agent 工厂"——最大化配置和扩展，代价是稳定性 |
| **Kimi Swarm** | "用 RL 训练出编排能力"——模型层面解决协调问题，开创性但不实用 |
| **Cat Cafe** | "三只异构猫的去中心化家庭"——人在环 + 订阅经济 + 长期记忆 |

Cat Cafe 不该去追 Kimi 的 100 agents 规模，也不该照搬 Agent Teams 的中心化 lead 模式。我们的独特价值在于：**异构 + 人在环 + 去中心化 + 长期记忆**。

最值得借鉴的是 Agent Teams 的 **Task DAG + Quality Gate Hooks**——这两个不需要改变我们的核心架构，但能让协作更结构化。

---

## Sources

- [Claude Code Agent Teams 官方文档](https://code.claude.com/docs/en/agent-teams)
- [Kimi K2.5 技术论文 (arXiv 2602.02276)](https://arxiv.org/html/2602.02276v1)
- [Kimi K2.5 Agent Swarm — InfoQ](https://www.infoq.com/news/2026/02/kimi-k25-swarm/)
- [Kimi K2.5 Agent Swarm — VentureBeat](https://venturebeat.com/orchestration/moonshot-ai-debuts-kimi-k2-5-most-powerful-open-source-llm-beating-opus-4-5)
- [oh-my-opencode 官网 agents 页](https://ohmyopencode.com/agents/)
- [oh-my-opencode GitHub](https://github.com/code-yeongyu/oh-my-opencode)
- [oh-my-opencode DeepWiki](https://deepwiki.com/code-yeongyu/oh-my-opencode)
- [PARL GitHub (Swarm Corporation)](https://github.com/The-Swarm-Corporation/PARL)
- [Multi-agent comparison — NxCode](https://www.nxcode.io/resources/news/opencode-vs-claude-code-vs-cursor-2026)
- [Porting Agent Teams to OpenCode — DEV](https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol)
- 内部调研：`docs/research/oh-my-opencode-research.md`（2026-02-13）
- 内部调研：`docs/archive/2026-02/research/2026-02-06-agent-teams-compare.md`
