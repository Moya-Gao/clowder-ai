---
feature_ids: []
related_features: [F088, F132, F137, F142, F145]
related_decisions: [ADR-023, ADR-025, ADR-026]
topics: [cli, mcp, skills, tool-integration, enterprise-action, wecom, lark]
doc_kind: decision
created: 2026-04-14
decision_id: ADR-029
---

# ADR-029: External Tool Integration Strategy — CLI + Skills vs MCP 选型准则

> **Status**: draft (pending CVO sign-off)
> **Deciders**: 铲屎官 + 布偶猫(opus) + 缅因猫(gpt52)
> **Date**: 2026-04-14
> **Trigger**: 企微/飞书官方 CLI 接入 + 2026 Q1 CLI + Agent Skills 行业风潮
> **Discussion**: IM Hub thread (2026-04-14 architecture debate)

## Context

### 行业背景

2026 Q1-Q2，CLI + Agent Skills 模式在 AI Agent 生态中快速崛起：

- 企业 IM 厂商（飞书、企微）发布官方 CLI 并附带 Agent Skills
- Claude Code、Codex CLI、Gemini CLI 均以 CLI 为主要交互面
- 社区出现"CLI + Skills 替代 MCP"的声音

但三大厂商的实际策略是**并行推进**，不是二选一：

- **Anthropic**：CLI（Claude Code）+ Skills（slash commands）+ MCP（外部工具/数据源连接）
- **OpenAI**：CLI（Codex）+ Instructions（AGENTS.md）+ MCP（工具协议）
- **Google**：CLI（Gemini CLI）+ Commands + MCP（built-in support）

### Cat Café 现状

我们已有三种集成模式在生产中运行：

| 模式 | 用途 | 例子 |
|------|------|------|
| **MCP** | 访问 Hub 运行时有状态服务 | `cat_cafe_search_evidence`, `cat_cafe_post_message` |
| **CLI 直调** | 调用外部无状态工具 | `pandoc`（via PandocService）, `git`, `pnpm` |
| **CLI 子进程 + 事件流** | Agent 运行时 | `claude`, `codex`, `gemini`（via cli-spawn.ts） |

但这三种模式的**选型准则从未被明确记录**，每次接新工具都要重新讨论。

### 引发讨论的具体需求

企微/飞书官方 CLI 接入。砚砚（GPT-5.4）提出 `CliBackedAdapter` 方案（将 CLI 能力纳入 F088 adapter 体系），宪宪（Opus）挑战后收敛为独立 Tool Layer。铲屎官进一步挑战：为什么不直接用 CLI + upstream Skills，还要加 MCP / Tool Layer？

三轮辩论后共识成型，本 ADR 记录该共识。

### 关键洞察

1. **CLI 改变的是入口形态，不是能力分层。** CLI 是执行器，Skills 是描述，MCP 是协议——三者正交。
2. **F088 的 adapter 模式（parseEvent / formatMessage / sendMessage）专为消息传输设计**，不适合企业操作（创建文档/待办/会议）。这是 Transport Plane 和 Action Plane 的区别。
3. **MCP wrapper 对外部 CLI 工具是净负债。** 上游 CLI 变更时，MCP wrapper 成为额外故障点和维护瓶颈。
4. **ActionService（TypeScript module）已足够作为治理边界**——权限、审计、幂等、dry-run 在 service 层实现，不需要 MCP 进程来提供集中治理。

## Decision

### 核心原则

**ActionService 是必选项。** 不论执行后端和暴露方式如何选择，接入外部工具时都先建 typed ActionService 作为编程接口和治理边界。

ActionService 职责：
- 权限检查（permission gate）
- 审计日志（audit log）
- 幂等控制（idempotency key）
- 预览/干跑（preview / dry-run）
- 资源句柄持久化（resource handle persistence）
- 错误归一化（error normalization）

### Decision 1: Execution Backend — 选执行器

这个决策回答：**ActionService 下面接什么？**

| 条件 | 执行器 | 例子 |
|------|--------|------|
| Vendor 提供成熟 CLI + 官方维护的 Agent Skills | `CliExecutor`（封装 CLI 调用 + 输出解析） | `wecom-cli`, `lark-cli` |
| 本地无状态工具，无 Agent Skills | `direct execFile`（仿 PandocService 模式） | `pandoc`, `ffmpeg` |
| 强状态协议 / 长连接 / 订阅 | SDK 或 API Client | WebSocket 场景、需要保持连接的服务 |

**选型原则**：选离 vendor 真相源最近的执行方式。CLI 有官方 Skills = 用 CLI。只有 SDK = 用 SDK。都有 = CLI 优先（Skills 即文档，维护成本更低）。

### Decision 2: Exposure Surface — 选暴露方式

这个决策回答：**ActionService 上面怎么暴露给调用者？**

| 调用者场景 | 暴露方式 | 说明 |
|-----------|---------|------|
| Hub server 内部逻辑（定时任务、webhook handler） | TypeScript `import` | 直接调方法，零开销 |
| 本机猫通过 Skill 触发 | Skill → CLI 直调 或 callback route → ActionService | 猫读 upstream Skills 知道怎么用，直接执行 |
| Hub 有状态服务（threads, messages, memory） | MCP（现有 `cat_cafe_*` 模式） | 需要 session、auth、discovery |
| 跨进程 / 跨语言 / 远程 agent | MCP tool | 调用者无法 import TypeScript module |

### Decision 3: MCP 不适用的场景

以下情况**不**构成上 MCP 的理由：

- **仅为集中治理**：ActionService 已是治理边界，不需要独立 MCP 进程来提供权限/审计
- **仅为能力发现**：upstream Agent Skills 文件已提供 LLM 可读的能力描述
- **仅因为"MCP 是标准"**：标准是工具，不是目的
- **仅为未来可能**：当前所有猫均有 shell 执行能力，不存在必须通过 MCP 访问外部工具的场景

### Decision 4: 延迟决策 — MCP 升级路径

**当前不为外部 CLI 工具建 MCP server。** 当以下条件**实际出现**时再评估：

- 出现跨进程 / 跨语言 / 远程 agent 需要调用 ActionService 的场景
- 调用者确实无法通过 import、callback route 或 shell 访问

届时 ActionService 的 typed 接口已就绪，包装为 MCP tool 为增量工作，不需要架构重写。

### Decision 5: F088 Adapter 体系的边界

F088 adapter（`IOutboundAdapter`：`sendReply / sendFormattedReply / sendMedia`）专用于**消息传输**（Transport Plane）。企业操作（创建文档/待办/会议）属于 **Action Plane**，不应纳入 adapter 体系。

- Transport Plane：F088 / F132 / F137 的 adapter 模式，继续服务消息收发
- Action Plane：本 ADR 定义的 ActionService + CliExecutor 模式，服务企业操作
- 两层可串联：消息从 F088 connector 进入 → 猫决策 → Action Plane 执行 → 结果通过 F088 outbound 回贴

## Alternatives Rejected

### A1: CliBackedAdapter — 将 CLI 能力纳入 F088 adapter 体系

**拒绝原因**：F088 adapter 接口（`parseEvent / formatMessage / sendMessage`）语义上是消息传输，无法表达"创建文档""派发待办"等企业操作。强行扩展 adapter 接口会污染 F088 已验证的架构。

### A2: 全走 MCP — 为每个外部 CLI 建 MCP server

**拒绝原因**：对外部工具增加无谓维护层。上游 CLI 变更时 MCP wrapper 成为瓶颈。当前所有猫均有 shell 执行能力，MCP 作为远程访问协议在本场景无必要。

### A3: 全走 CLI 裸调 — 不建 ActionService，猫直接 shell 调

**拒绝原因**：缺少治理边界。权限、审计、幂等、dry-run 散落在 prompt 和 skill 里，无法保证一致性。且 Hub runtime 的程序化调用无法通过 shell skill 完成。

### A4: 不区分 Transport / Action — 每次接新工具重新讨论

**拒绝原因**：过去每接一个平台都会引发"走 adapter 还是走 tool"的争论。本 ADR 通过明确两个 Plane 的边界，让后续接入有锚点。

## 首次应用：Enterprise Action Toolkit（企微打样）

| 维度 | 决策 |
|------|------|
| Feature 关系 | `Uses: F088`（触发+回贴），`Related: F132, F142`（同生态）。不是 `Evolved from F088` |
| Execution Backend | `WeComActionService` + `CliExecutor`（调用 `wecom-cli`） |
| Exposure Surface | 猫通过 upstream Agent Skills 直调 CLI；Hub 通过 import WeComActionService |
| MCP | Phase A 不上。未来按 Decision 4 条件评估 |
| Cross-cutting | 权限、审计、幂等、dry-run、resource handle 在 ActionService 实现 |

## Consequences

**正面**：
- 新工具接入有明确选型准则，减少架构争论
- 外部 CLI 集成零 MCP 开销，维护链更短
- ActionService 统一治理边界，不因暴露方式不同而分裂
- 保留 MCP 升级路径，不阻塞未来演化

**负面 / 风险**：
- 上游 CLI 的输出格式变更仍会影响 CliExecutor 的解析逻辑
- 如果未来大量远程 agent 需要接入，需要批量将 ActionService 暴露为 MCP（但为增量工作）
- 猫直调 CLI 的审计依赖 ActionService 被正确使用——如果猫绕过 ActionService 直接 shell 调 CLI，审计链断裂

**缓解措施**：
- CliExecutor 输出解析优先用 JSON mode（`--format json`），降低格式变更影响
- ActionService 方法签名与 CLI 命令解耦，保持稳定的编程接口
- Skill 中明确指导猫通过 ActionService 路径调用，不鼓励裸 shell
