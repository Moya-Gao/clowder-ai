---
feature_ids: [F152]
related_features: [F143, F050, F043, F108]
topics: [agent-runtime, architecture, llm-api, tool-dispatch, context-management]
doc_kind: spec
created: 2026-04-08
---

# F152: CatAgent — Thin Agent Runtime

> **Status**: spike | **Owner**: Ragdoll Opus 4.6 | **Priority**: P1

## Why

Cat Cafe 是多智能体协作平台，但不提供自有 agent runtime。所有猫猫的"大脑"（agent loop）依赖外部 CLI（Claude Code / Codex / Gemini CLI），Cat Cafe 只提供"身体"（协作、记忆、消息路由、MCP 工具）。

这导致三个痛点：

1. **无法控制 context 管理** — compact 策略、身份保护全看外部 runtime，我们记录过"compact 后身份漂移"教训（docs/public-lessons.md:505）
2. **接入成本高** — 每个新 agent = ~450 行适配代码（F143 已指出）
3. **协作工具走桥接** — Cat Cafe MCP 工具通过 HTTP callback 注入外部 CLI，增加延迟和故障点

Claude Code 源码分析（四猫合议 2026-04-08）确认了 5 个可借鉴机制，验证了"薄 agent"方向可行。

## What

### 定位

**Thin CatAgent** — 协作与中等任务闭环执行器。

| 做 | 不做 |
|----|------|
| 80% 日常交互（讨论/分析/review/协作） | 全功能编码代理（文件系统/sandbox/IDE） |
| 原生 Cat Cafe 工具集成 | 1:1 克隆 Claude Code |
| F143 下的 first-party provider | 平行再造架构 |
| LLM API 直连（opt-in，非默认） | 替代 CLI 子进程主路径 |

### 架构约束

- **ADR-001**：CatAgent 走 API key 路径，作为 opt-in runtime，不升格为平台默认（CLI 子进程仍为主路径）
- **安全红线**：没有代码级权限状态机，不给写/exec/跨线程副作用工具
- **F143 关系**：CatAgent 实现 `AgentService.invoke()` 接口，作为 provider 注册到 AgentRegistry

### 从 Claude Code 借鉴的机制

| 机制 | 阶段 | 来源 |
|------|------|------|
| System prompt 每轮重建 | Spike | query.ts + systemPrompt.ts |
| 两层压缩（Micro→Full） | POC | services/compact/ |
| 权限状态机 + decisionReason | MVP | utils/permissions/ |
| StreamingToolExecutor（只读） | Alpha | services/tools/ |
| Deferred tool loading | Alpha | Tool.ts + ToolSearchTool |

### Phase 0: Spike（1 周）

验证"LLM 直连 + 原生 Cat Cafe 工具 + 单猫 agent loop"可行性。

组件：
1. **CatAgentService** — 实现 `AgentService.invoke()` 接口
2. **Agent Loop** — while(hasToolUse) { callLLM → dispatch tools → collect results }
3. **Kernel Prompt Builder** — 每轮重建 system prompt（猫身份 + 铁律 + 线程上下文）
4. **Tool Registry** — Cat Cafe 原生工具定义 + 权限白名单
5. **Message Adapter** — 将 Anthropic API 响应转为 `AgentMessage` yield

验收标准：
- [ ] AC-S1: CatAgent 可注册为 provider 并通过 AgentRegistry 被路由
- [ ] AC-S2: 完成一个完整任务链（读文件 → 分析 → post_message）
- [ ] AC-S3: System prompt 每轮重建，3 轮后身份无漂移
- [ ] AC-S4: 工具白名单生效（Cat Cafe 工具放行，其余 deny）

### Phase 1: POC（+1 周）— Go/No-Go

在 Spike 基础上增加：
1. **MicroCompact** — 剥离旧 tool output，控制 token 增长
2. **多轮稳定性** — 10 轮任务不 OOM，上下文连贯

Go/No-Go 闸门：
- ✅ Go：10 轮稳定 + 零 P1 安全事故 + 审计链可回放
- ❌ No-Go：权限无法闭环 或 压缩后身份漂移不可控

### Phase 2: MVP（+2-3 周）

- 两层压缩完整化（micro + full summary）
- 权限决策状态机 + decisionReason 审计
- 接入 F143 宿主层
- 压缩摘要模板强制保留"身份/铁律/未完成任务"槽位

### Phase 3: Alpha（+4-6 周）

- 只读工具并行执行
- 写/exec 工具（需权限状态机完备）
- MCP deferred loading
- Resume/cancel + 失败恢复

## 安全风险

| 级别 | 风险 | 缓解 |
|------|------|------|
| P1 | 并发工具副作用竞态 | Spike 串行执行，只读工具才可并行 |
| P1 | 权限绕过 | 默认 deny + 白名单 + decisionReason |
| P1 | 压缩后身份漂移 | kernel prompt 每轮重建 + 槽位保留 |
| P2 | API key 成本失控 | Token budget + 用量监控 |
| P2 | 复杂度外溢 | 以 provider 接入，禁止新增北向接口 |

## 参与者

四猫合议（2026-04-08）：
- 宪宪/Opus-46：主架构 + 源码分析
- Sonnet：快速原型 + UX 视角
- GPT-5.4：架构完整性 + ADR-001 约束
- 砚砚：实现可行性 + 安全风险 + Go/No-Go 闸门
