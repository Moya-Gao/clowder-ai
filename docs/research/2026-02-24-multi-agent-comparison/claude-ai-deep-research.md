---
feature_ids: [F002, F027]
topics: [multi, agent, comparison]
doc_kind: research
created: 2026-02-24
---

# Multi-Agent 架构对比调研报告

**委托人**: 铲屎官 + 布偶猫宪宪  
**日期**: 2026-02-24  
**方法**: Web Search + 官方文档 + 社区反馈交叉验证

---

## 一、方案概览

| 维度 | Claude Code Agent Teams | oh-my-opencode (OMO) | Kimi K2.5 Agent Swarm | Cat Cafe A2A |
|------|------------------------|---------------------|----------------------|-------------|
| **发布方** | Anthropic（官方） | code-yeongyu（社区） | Moonshot AI（官方） | 铲屎官（自研） |
| **发布时间** | 2026-02-05（随 Opus 4.6） | 持续迭代，最新 2026-02-19 | 2026-01-27（Beta） | Phase 0-5 已完成 |
| **编排模式** | 中心化 Team Lead | 中心化 Sisyphus 编排器 | 中心化 Trainable Orchestrator | 去中心化 Worklist |
| **Agent 数量** | 实测 3-16 个 teammates | 11 内置 agent（可扩展） | 最多 100 个 sub-agents | 3 只猫（可扩展） |
| **代码规模** | Claude Code 内置功能 | 133k LOC TypeScript, 1161 文件 | 模型内置能力（非框架代码） | ~20k LOC TypeScript, 500+ 测试 |
| **成本模型** | API token 计费（1x-7x） | 订阅额度（~$60/月三订阅） | API 计费（$0.60/M in, $3/M out） | 订阅额度（三订阅） |
| **开源** | 否（Claude Code 闭源） | 是（npm 包） | 模型权重开源（Modified MIT） | 否（自研） |

**来源**: [Claude Code 官方文档](https://code.claude.com/docs/en/agent-teams)、[OMO GitHub](https://github.com/code-yeongyu/oh-my-opencode)、[Kimi K2.5 技术博客](https://www.kimi.com/blog/kimi-k2-5.html)、[Kimi K2.5 HuggingFace](https://huggingface.co/moonshotai/Kimi-K2.5)

---

## 二、Q1: 架构模式对比

### Claude Code Agent Teams
**已确认**: Team Lead + Teammates 星型拓扑。Lead 创建团队、分配任务、汇总结果。Teammates 各自拥有独立 context window，通过 JSON 文件 inbox 通信（`~/.claude/<teamName>/inboxes/<agentName>.json`）。共享 task list 使用文件锁防止竞态。支持三种 spawn 后端: in-process、tmux split-pane、iTerm2 split-pane。

通信方向: Teammate → Lead 为主路径，但 teammates 之间也可以直接 message（对比 subagents 只能向上汇报，这是关键升级）。Lead 可启用 delegate mode，限制自己只做协调不写代码。

**来源**: [Anthropic 官方文档](https://code.claude.com/docs/en/agent-teams)、[OpenCode 社区移植分析](https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol)

### oh-my-opencode (OMO)
**已确认**: Sisyphus 作为主编排器，可委派给 10+ 专业 agent（Hephaestus 深度执行、Prometheus 规划、Oracle 架构咨询、Librarian 文档搜索、Atlas 计划执行等）。通信仍为单向：编排器→子agent→汇报。2026-02 重大更新包括:

- **Gemini 优化 prompt**（实验性）: Sisyphus/Prometheus/Atlas 现在有 Gemini 专用 prompt
- **模型 fallback chain**: 6 层 provider 自动切换（Anthropic → OpenAI → Google → Copilot → OpenCode Zen → Z.ai）
- **Agent 通知**: 当 agent 需要用户输入或权限时推送通知
- **Background agent 重构**: 后台任务管理模块化
- **Kimi K2.5 / GLM-5 编排支持**: Sisyphus 现在可运行在 Kimi K2.5 和 GLM-5 上
- **deep parallel delegation**: Sisyphus prompt 新增深度并行委派章节

**已知持续问题**: 自定义 agent 对编排器不可见（Issue #1623，2026-02-07 报告）——用户定义的 agent 可通过 @name 调用但编排器无法自主委派。

**来源**: [OMO GitHub Releases](https://github.com/code-yeongyu/oh-my-opencode/releases)、[DeepWiki 分析](https://deepwiki.com/code-yeongyu/oh-my-opencode)、[Issue #1623](https://github.com/code-yeongyu/oh-my-opencode/issues/1623)

### Kimi K2.5 Agent Swarm
**已确认**: 编排能力直接烘焙进模型权重，而非外部框架。通过 PARL（Parallel-Agent Reinforcement Learning）训练出一个 trainable orchestrator，能自主决定何时并行、怎样并行。核心架构:

1. **Orchestrator**（可训练）: 分解任务为可并行子任务
2. **Sub-agents**（冻结）: 从固定中间检查点动态实例化，执行具体子任务
3. **通信**: Orchestrator → Sub-agents 单向分派 + 结果聚合。Sub-agents 之间无直接通信

训练关键: PARL 仅更新 orchestrator，sub-agent 的执行轨迹不参与优化目标。用 staged reward shaping 对抗 serial collapse（编排器退化为单 agent 执行的倾向）。

**推测**: Agent Swarm 的 sub-agents 之间似乎没有 peer-to-peer 通信机制，是严格的 fan-out + aggregation 模式。这与 Cat Cafe 的 ping-pong review 模式有本质区别。

**来源**: [Kimi K2.5 arXiv 论文](https://arxiv.org/html/2602.02276v1)、[InfoQ 报道](https://www.infoq.com/news/2026/02/kimi-k25-swarm/)、[DataCamp 教程](https://www.datacamp.com/tutorial/kimi-k2-agent-swarm-guide)

### Cat Cafe A2A
**已确认（团队自述）**: 去中心化 worklist，无中央编排器。Cat 通过 @mention 触发链式调用，支持 A→B→A ping-pong review。Intent 驱动路由: @2+ 猫 → parallel (ideate), @1 猫 → serial (execute)。最大调用深度 15。

---

## 三、Q2: Human-in-the-Loop 设计

| 维度 | Agent Teams | OMO | Kimi Swarm | Cat Cafe |
|------|-------------|-----|------------|----------|
| **人类角色** | 启动者+旁观者 | 启动者+审批者 | 纯启动者 | 全程审批者 |
| **权限系统** | 全 teammates 继承同一权限 | agent 通知系统（新增） | 无 | 三级审批（once/thread/global） |
| **实时干预** | Shift+Up/Down 切换，直接与任意 teammate 对话 | 通过 TUI 交互 | 无中间干预 | WebSocket + Web Push 双通道 |
| **策略学习** | 无 | 无 | 无 | 棘轮机制（频繁批准→永久规则） |

**关键发现**: Kimi Agent Swarm 是四个方案中人在环最弱的——一旦启动就完全自主运行，用户无法在执行中途干预或审批。Claude Code Agent Teams 提供了不错的观察能力（split-pane 可同时看所有 teammate 工作），但权限粒度较粗。Cat Cafe 的三级审批 + 策略棘轮在四个方案中独一无二。

---

## 四、Q3: Agent 异构性支持

| 维度 | Agent Teams | OMO | Kimi Swarm | Cat Cafe |
|------|-------------|-----|------------|----------|
| **混用不同模型** | ❌ 仅 Claude | ✅ 6 provider tier | ❌ 仅 Kimi K2.5 | ✅ Claude/Codex/Gemini |
| **非 Claude agent** | 不支持 | Opus/Kimi/GLM/GPT/Gemini/Minimax | 同构 sub-agents | Codex + Gemini via CLI |
| **统一回传** | N/A（同构） | 编排器统一管理 | N/A（同构） | McpPromptInjector 注入 |

**关键发现**: 真正支持异构混用的只有 OMO 和 Cat Cafe。OMO 走的是 provider fallback chain + 按 agent 配模型的路线，但通信仍然是编排器→子 agent→汇报的单向流。Cat Cafe 的挑战在于非 Claude 模型不原生支持 MCP，需要 prompt injection 模拟——这是一个工程上的巧妙解法但也是一个脆弱点。

值得注意的是 OpenCode 社区（OMO 的上游）已经实现了跨 provider Agent Teams，验证了 GPT-5.3 Codex + Gemini 2.5 Pro + Claude Sonnet 4 在同一个 message bus 上的协作。

---

## 五、Q4: 任务分解与并行

| 维度 | Agent Teams | OMO | Kimi Swarm | Cat Cafe |
|------|-------------|-----|------------|----------|
| **分解方式** | 自然语言描述 → Lead 分配 | Sisyphus 自动分析 + Prometheus 规划 | PARL 训练出的分解能力 | @mention 手动 + Intent 自动 |
| **并行执行** | ✅ 独立 context window | ✅ parallel delegation | ✅ 最多 100 并行 | ✅ @2+ → parallel |
| **依赖管理** | Task dependency（pending 直到依赖完成） | 编排器负责顺序 | Orchestrator 内部调度 | Worklist 链式队列 |
| **失败处理** | 手动 nudge（task 状态可能滞后） | 模型 fallback chain（自动换 provider） | Orchestrator 重试（推测） | Session seal + 新 session bootstrap |
| **最大规模** | 实测 16 agents（理论无上限） | 理论无上限 | 100 sub-agents, 1500 tool calls | 最大深度 15 |

**Kimi Swarm 独特优势**: 并行度是学习出来的，不是手工配置的。PARL 训练让模型自己学会"什么时候该并行、并行几个、怎么合并结果"。这种 learned parallelism 是其他三个方案都没有的。Moonshot 报告在 wide-search 场景下执行时间减少 4.5 倍，F1 从 72.8% 提升到 79.0%。

**Cat Cafe 独特优势**: ping-pong review 模式（A→B→A）允许 agent 间的迭代审查，这是其他方案不直接支持的深度协作模式。

---

## 六、Q5: Session / Context / Memory 管理

| 维度 | Agent Teams | OMO | Kimi Swarm | Cat Cafe |
|------|-------------|-----|------------|----------|
| **上下文隔离** | 每个 teammate 独立 window | 每个 agent 独立 | Sub-agent 冻结+独立 context | 每只猫独立 CLI session |
| **跨 session** | ❌ 不支持 resume teammates | Session recovery hooks | 无（sub-agents 即用即弃） | ✅ seal→transcript→bootstrap |
| **窗口满处理** | Teammate 自然结束 | Session compacting hook | **Context sharding**（关键创新） | Seal + 摘要注入新 session |
| **共享记忆** | CLAUDE.md 作为共享上下文 | 文件系统 + hook 系统 | 无持久记忆 | Shared worklist + transcript |

**Kimi Swarm 的 Context Sharding**: 这是论文中提到的一个重要创新。Agent Swarm 不做 context truncation（截断），而是通过将任务分配给多个 sub-agent 来实现 context sharding（分片）——每个 sub-agent 只持有自己子任务相关的上下文，orchestrator 只保留高层协调信号。这本质上是用并行来扩展有效上下文长度，比 Cat Cafe 的 seal + bootstrap 更优雅。

**来源**: [arXiv 论文 Section 5](https://arxiv.org/html/2602.02276v1)

---

## 七、Q6: 开发者体验与可扩展性

| 维度 | Agent Teams | OMO | Kimi Swarm | Cat Cafe |
|------|-------------|-----|------------|----------|
| **添加新 agent** | 自然语言描述即可 spawn | 配置文件 + .opencode/agents/ | 不可自定义 sub-agent 角色 | 需接入新 CLI + 配置 |
| **Plugin 机制** | Hooks (TeammateIdle, TaskCompleted) | 44 lifecycle hooks + 26 tools | 无（模型自主决定） | MCP server + worklist API |
| **学习曲线** | 低（自然语言驱动） | 中（配置项多但有默认值） | 极低（一个 prompt 完事） | 高（需理解完整架构） |
| **社区规模** | 大（Claude Code 生态） | 1.1k stars, Discord 社区 | 大（Kimi 用户群） | 内部项目 |

---

## 八、Q7: 已知问题与社区反馈

### Claude Code Agent Teams
- ❌ **No session resume**: Lead 重启后 teammates 丢失，需要重新 spawn
- ❌ **No nested teams**: Teammate 不能创建自己的子团队
- ❌ **Leadership 不可转移**: 不能中途换 lead
- ⚠️ **Task 状态滞后**: Teammate 有时忘记标记 task 完成，阻塞依赖链
- ⚠️ **Token 成本高**: 5 个 teammate ≈ 5 倍 token 消耗
- ⚠️ **Split-pane 限制**: 只支持 tmux/iTerm2，不支持 VS Code Terminal

**来源**: [Anthropic 官方 limitations](https://code.claude.com/docs/en/agent-teams)、[社区实测](https://darasoba.medium.com/how-to-set-up-and-use-claude-code-agent-teams-and-actually-get-great-results-9a34f8648f6d)

### oh-my-opencode
- ⚠️ **自定义 agent 不可见**: 编排器无法自主委派用户定义的 agent（#1623，截至 2026-02-19 仍存在）
- ⚠️ **后台任务问题**: 竞态挂起、无限循环——已通过 2 月 background-agent 重构部分缓解
- ⚠️ **Gemini prompt 仍实验性**: 不推荐生产使用
- ✅ **改善**: Agent 通知系统（等待用户输入时通知）、模型 fallback chain

**来源**: [GitHub Issues](https://github.com/code-yeongyu/oh-my-opencode/issues/1623)、[Releases](https://github.com/code-yeongyu/oh-my-opencode/releases)

### Kimi K2.5 Agent Swarm
- ⚠️ **Beta 状态**: 仅限高级付费用户免费体验
- ⚠️ **Token 成本不透明**: 100 个 sub-agent 并行的总 token 消耗可能远超单 agent
- ⚠️ **本地部署门槛极高**: 4-bit 量化版需 192-256GB VRAM，全精度更不用说
- ❌ **无 Human-in-the-Loop**: 启动后无法中途干预
- ❌ **不可自定义 sub-agent 行为**: 角色由模型自主决定
- ⚠️ **Modified MIT License**: 月收入 > $20M 需显著标注 "Kimi K2.5"

**来源**: [VentureBeat 分析](https://venturebeat.com/orchestration/moonshot-ai-debuts-kimi-k2-5-most-powerful-open-source-llm-beating-opus-4-5)、[i-scoop 批评分析](https://www.i-scoop.eu/kimi-k2-5-agent-swarm/)

---

## 九、Q8: 对 Cat Cafe 的借鉴价值

### 从 Claude Code Agent Teams 学习

**最值得学习**: **Shared Task List + File Locking**
- Agent Teams 的共享任务列表用文件锁防竞态，task 有依赖关系图（pending 直到依赖完成）
- Cat Cafe 当前的 worklist 是否有类似的依赖管理？如果没有，这是一个值得加入的特性
- **delegate mode**（Lead 只协调不执行）也值得考虑——让某只猫专门做协调

**改进建议**: 考虑为 Cat Cafe worklist 增加 task dependency graph 和 self-claim 机制（teammate 完成当前任务后自动认领下一个未阻塞的任务）。

### 从 oh-my-opencode 学习

**最值得学习**: **Model Fallback Chain + Lifecycle Hooks**
- 6 层 provider 自动切换在 rate limit 或服务故障时保持工作不中断——Cat Cafe 也用订阅制，遇到 rate limit 是真实问题
- 44 个 lifecycle hooks 提供了极强的可扩展性，Cat Cafe 的 session 生命周期管理可以参考这种 hook-driven 架构

**改进建议**: 在 Cat Cafe 的 session 管理中引入类似 OMO 的 PreCompact / PostCompact hooks，让第三方逻辑在 session seal 前后介入。

### 从 Kimi Agent Swarm 学习

**最值得学习**: **Context Sharding（上下文分片）**
- 这是最有借鉴价值的设计理念。Swarm 不是在一个 agent 内做 context 压缩，而是通过分任务到多个 sub-agent 来天然分片上下文
- Cat Cafe 已经有 session seal + bootstrap 的机制，但可以更主动地利用多猫并行来分散上下文压力

**次要借鉴**: PARL 的 staged reward shaping 思想——虽然 Cat Cafe 不训练模型，但"先鼓励并行探索，再优化任务成功率"的渐进策略可以体现在 worklist 的路由逻辑中。

**改进建议**: 考虑增加一个"自动分片模式"——当单猫 session 接近上下文上限时，自动将未完成子任务分派给空闲猫，而不是只做 seal + bootstrap。

---

## 十、综合推荐与风险

### 推荐方向

1. **短期（1-2 周）**: 引入 task dependency graph 和 self-claim 机制，参考 Agent Teams
2. **中期（1 月）**: 实现 model fallback chain，当某只猫 rate limited 时自动排队/切换模型
3. **长期（探索性）**: 研究 context sharding 模式，将其融入 Cat Cafe 的 session 管理

### Cat Cafe 的核心差异化优势

Cat Cafe 在四个方案中有三个独特优势是其他方案都不具备的:

1. **去中心化 + 强人在环** 的组合——Kimi Swarm 和 Agent Teams 都是中心化的，OMO 也是。Cat Cafe 的 @mention 驱动 + 三级审批是唯一真正做到"猫猫自主协作但铲屎官保留最终决定权"的方案。

2. **异构 Agent 原生支持** + **订阅经济学**——OMO 虽然也支持多 provider，但是基于 API token 计费；Cat Cafe 利用订阅额度，在成本结构上有天然优势。

3. **策略学习棘轮**——其他方案都没有"频繁批准→自动升级为永久规则"的机制，这让人在环的开销随时间递减。

### 风险提醒

| 风险 | 说明 | 缓解 |
|------|------|------|
| Kimi Swarm 范式扩散 | 如果 "learned parallelism" 成为主流，手工编排的框架可能显得笨拙 | Cat Cafe 的价值在治理而非编排，不同赛道 |
| Agent Teams 成熟化 | 一旦 Anthropic 解决 session resume + nested teams，对 Cat Cafe 的替代威胁增大 | 加速异构+审批的差异化 |
| OMO 生态扩张 | 133k LOC + 44 hooks 的生态位已经很大 | Cat Cafe 定位不同（不是 coding harness） |
| 订阅制成本变动 | Claude Max / ChatGPT Pro 的额度政策可能收紧 | 预留 API fallback 能力 |

---

## 附录: 信息来源汇总

| 来源 | 类型 | URL |
|------|------|-----|
| Claude Code 官方文档 | 官方 | https://code.claude.com/docs/en/agent-teams |
| OMO GitHub | 官方 | https://github.com/code-yeongyu/oh-my-opencode |
| OMO DeepWiki 分析 | 社区 | https://deepwiki.com/code-yeongyu/oh-my-opencode |
| Kimi K2.5 技术博客 | 官方 | https://www.kimi.com/blog/kimi-k2-5.html |
| Kimi K2.5 arXiv 论文 | 官方 | https://arxiv.org/html/2602.02276v1 |
| Kimi K2.5 HuggingFace | 官方 | https://huggingface.co/moonshotai/Kimi-K2.5 |
| InfoQ 报道 | 媒体 | https://www.infoq.com/news/2026/02/kimi-k25-swarm/ |
| VentureBeat 分析 | 媒体 | https://venturebeat.com/orchestration/moonshot-ai-debuts-kimi-k2-5-most-powerful-open-source-llm-beating-opus-4-5 |
| DataCamp 实测教程 | 社区 | https://www.datacamp.com/tutorial/kimi-k2-agent-swarm-guide |
| OpenCode Agent Teams 移植 | 社区 | https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol |
| ClaudeFast 完整指南 | 社区 | https://claudefa.st/blog/guide/agents/agent-teams |
| 社区实测 (Dára Sobaloju) | 社区 | https://darasoba.medium.com/ |
