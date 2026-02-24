# 讨论：跨 Provider 上下文压缩检测机制

> 日期：2026-02-24
> 参与者：布偶猫（宪宪）、缅因猫（砚砚）、铲屎官
> 触发：F-BLOAT PR #63 合入后，铲屎官追问"Codex/Gemini 怎么检测上下文压缩？"

## 背景

PR #63 实现了 resume-aware systemPrompt 注入，核心逻辑在 `invoke-single-cat.ts`：
- 用 module-level Map 记录每个 `userId:catId:threadId` 的 `usedTokens`
- 当本轮 `usedTokens < 上轮 * 0.4`（骤降 >60%）时标记 `_needsReinjection`
- 下一轮即使是 resume，也强制重注入 systemPrompt

## 三猫检测能力分析

### Claude（布偶猫）—— 完全覆盖

| 层级 | 机制 | 说明 |
|------|------|------|
| 原生保护 | `--append-system-prompt` | 写入 session 的 system prompt 独立 slot，跨压缩存活 |
| 额外保险 | `lastTurnInputTokens` 骤降检测 | 从 `message_start.usage` 提取，用于非 system-prompt 内容（MCP 指令等）的重注入 |

**结论**：Claude 的 identity 不会丢，MCP 指令靠检测补回。

### Codex（缅因猫）—— 部分覆盖，1 轮空窗

| 层级 | 机制 | 说明 |
|------|------|------|
| Token 来源 | `turn.completed` + `contextSnapshotResolver` | `contextUsedTokens` 会覆盖粗粒度的 `input_tokens` |
| 检测能力 | 同一套 >60% 骤降 | 能检测到压缩 |
| systemPrompt 保护 | prepend 到 session history | 无独立 slot，压缩时可能被摘要化 |

**盲区**：检测是反应式 — 压缩发生在本轮，re-injection 在下一轮。**中间有 1 轮身份空窗**。

### Gemini（暹罗猫）—— 不需要检测

| 层级 | 机制 | 说明 |
|------|------|------|
| `sessionChain` | `false` | 每轮独立，无 persistent session |
| systemPrompt | 每轮都注入 | `isSessionChainEnabled('gemini') === false` → 永远 inject |

**结论**：不存在上下文被压缩的场景，不需要检测。

## 砚砚的判断

> "在不加额外请求成本的前提下算是'够用且可控'，但它是启发式，不是 100% 精准的硬信号。"

同意。当前 tradeoff：
- **零额外 RPC 成本** — 纯后端自检，不需要 preflight 查询
- **误判代价低** — 最多多塞一次 systemPrompt（损失一些 token）
- **漏判代价中** — 1 轮空窗期猫可能丢失 identity（但非致命）

## 升级方向（如果未来需要）

| 方向 | 描述 | 成本 | 收益 |
|------|------|------|------|
| **持久化 prevFill** | 将 `_prevContextFill` 从内存 Map 移到 Redis/SessionRecord | 低 | 解决 API 重启后丢失基线的问题 |
| **Codex preflight 读 context snapshot** | invoke 前先查一次 contextUsedTokens | 中（+1 RPC） | 主动检测，消灭 1 轮空窗 |
| **Codex system prompt slot** | 等 Codex CLI 支持独立 system prompt 参数 | 零（等上游） | 根治 |

## 决策

**当前接受现状** — Codex 压缩在实际使用中不频繁，1 轮空窗的实际影响有限。记入 BACKLOG 作为 P3 跟踪。

如果观察到实际的误判/漏判事故，再升级到"持久化 prevFill"方案。

## 关联文档

- Bug report: [`docs/bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md`](../../bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md)
- PR #63: `bca8b7e` fix(prompts): reduce system prompt token bloat ~73% per session
- 代码位置: `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` L29-43, L379-387
